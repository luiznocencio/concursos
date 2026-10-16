import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { calcularPrioridades } from "@/core";
import { contarFilaItens, criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { custoIaDoMes, situacaoDaFila } from "@/db/repositorios/moderacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { diasAte, tabelaDesempenho } from "@/estudo/painel";
import { Evolucao } from "@/components/painel/evolucao";
import { Tendencia } from "@/components/painel/tendencia";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, data, dataDaProva, dataEHora, nota, percentual, plural } from "@/lib/formato";
import { treinarTopicos } from "../acoes";
import { exigirCargo } from "../contexto";

async function dadosDoModerador(agora: Date) {
  try {
    const db = criarClienteServico();
    const [custos, fila] = await Promise.all([custoIaDoMes(db, agora), situacaoDaFila(db)]);
    return { custos, fila, erro: null };
  } catch (e) {
    return { custos: [], fila: null, erro: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Painel() {
  const { db, cargo, moderador } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const agora = new Date();
  const [estrutura, historico, simulados] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 10 }),
  ]);
  const prioridades = calcularPrioridades(estrutura.topicosAlvo, historico, agora);
  const tabela = tabelaDesempenho(estrutura.topicosAlvo, prioridades, historico, agora);
  const entregues = simulados
    .flatMap((s) => (s.resultado?.tipo === "completo" ? [{ id: s.id, em: s.finalizadaEm!, r: s.resultado }] : []))
    .reverse();
  const mod = moderador ? await dadosDoModerador(agora) : null;
  const filaItens = moderador ? await contarFilaItens(db) : 0;
  const dias = diasAte(estrutura.concurso.dataProva, agora);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className={titulo.pagina}>Painel</h1>
        <p className={textoApoio}>
          {estrutura.concurso.nome}, {estrutura.cargo.nome}. Faltam {plural(dias, "dia", "dias")} para a prova, em{" "}
          {dataDaProva(estrutura.concurso.dataProva)}.
        </p>
      </div>

      <section className={`${cartao} mt-8`}>
        <h2 className={titulo.secao}>Simulados</h2>
        {entregues.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>
            Entregue um <Link href="/simulado" className="text-azul hover:underline">simulado completo</Link> para ver a
            evolução em relação aos cortes.
          </p>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            {estrutura.provas.map((p) => (
              <Evolucao
                key={p.slug}
                nome={p.nome}
                maximo={p.nItens}
                corte={entregues.at(-1)!.r.provas.find((x) => x.slug === p.slug)?.corte ?? null}
                pontos={entregues.map((e) => ({
                  id: e.id,
                  rotulo: data(e.em),
                  nota: e.r.provas.find((x) => x.slug === p.slug)?.nota ?? 0,
                }))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className={cartao}>
          <h2 className={titulo.secao}>10 tópicos prioritários</h2>
          <ol className="mt-4 flex flex-col">
            {prioridades.slice(0, 10).map((t, i) => (
              <li key={t.chave} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-sm tabular-nums text-pedra">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2" title={t.titulo}>{t.titulo}</span>
                  <span className="block text-sm text-pedra">
                    {estrutura.disciplinas[t.disciplina]} · {t.n === 0 ? "nunca praticado" : aproveitamento(t.aproveitamento)}
                  </span>
                </span>
                <form action={treinarTopicos}>
                  <input type="hidden" name="canonico" value={t.canonico} />
                  <input type="hidden" name="total" value="10" />
                  <button type="submit" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ol>
        </div>

        <div className={cartao}>
          <h2 className={titulo.secao}>Desempenho por disciplina</h2>
          <div className="mt-4 divide-y divide-borda">
            {tabela.map((d) => (
              <details key={d.disciplina}>
                <summary className="flex cursor-pointer list-none items-center gap-4 py-3">
                  <span className="flex-1 font-medium">{estrutura.disciplinas[d.disciplina]}</span>
                  <span className="text-sm tabular-nums text-grafite">
                    {d.n === 0 ? "sem respostas" : `${aproveitamento(d.aproveitamento)} · ${plural(d.n, "resposta", "respostas")}`}
                  </span>
                </summary>
                <div className="overflow-x-auto pb-4">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-pedra">
                      <tr>
                        <th className="py-1 font-medium">Tópico</th>
                        <th className="py-1 text-right font-medium">Aproveit.</th>
                        <th className="py-1 text-right font-medium">Brancos</th>
                        <th className="py-1 text-right font-medium">Resp.</th>
                        <th className="py-1 pl-4 font-medium">4 semanas</th>
                        <th className="py-1 text-right font-medium">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topicos.map((t) => (
                        <tr key={`${t.disciplina}:${t.codigo}`}>
                          <td className="max-w-[260px] truncate py-1.5" title={t.titulo}>
                            <span className="text-pedra">{t.codigo}</span> {t.titulo}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{t.n ? aproveitamento(t.aproveitamento) : "-"}</td>
                          <td className="py-1.5 text-right tabular-nums">{t.n ? percentual(t.taxaBrancos) : "-"}</td>
                          <td className="py-1.5 text-right tabular-nums">{t.n}</td>
                          <td className="py-1.5 pl-4">
                            <Tendencia valores={t.tendencia} />
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{nota(t.prioridade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {mod && (
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className={cartao}>
            <h2 className={titulo.secao}>Custo de IA no mês</h2>
            {mod.erro ? (
              <p className="mt-3 text-sm text-vermelho">Indisponível: {mod.erro}</p>
            ) : mod.custos.length === 0 ? (
              <p className={`${textoApoio} mt-3`}>Nenhuma chamada neste mês.</p>
            ) : (
              <table className="mt-4 w-full text-left text-[15px]">
                <tbody className="divide-y divide-borda">
                  {mod.custos.map((c) => (
                    <tr key={c.finalidade}>
                      <td className="py-2">{c.finalidade}</td>
                      <td className="py-2 text-right text-pedra">{plural(c.chamadas, "chamada", "chamadas")}</td>
                      <td className="py-2 text-right tabular-nums">US$ {c.custoUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-medium">Total</td>
                    <td />
                    <td className="py-2 text-right font-medium tabular-nums">
                      US$ {mod.custos.reduce((s, c) => s + c.custoUsd, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <div className={`${cartao} flex flex-col gap-4`}>
            <h2 className={titulo.secao}>Geração e revisão</h2>
            {mod.fila && (
              <p className={textoApoio}>
                {plural(mod.fila.abertos, "pedido de geração em aberto", "pedidos de geração em aberto")}.
              </p>
            )}
            {mod.fila && mod.fila.falhas.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {mod.fila.falhas.map((f) => (
                  <li key={f.id} className="rounded-lg bg-vermelho-claro px-3 py-2 text-vermelho-tinta">
                    {f.canonico} falhou em {dataEHora(f.em)}: {f.erro}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/itens" className={`${botao.secundario} self-start`}>
              Revisar itens ({filaItens})
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

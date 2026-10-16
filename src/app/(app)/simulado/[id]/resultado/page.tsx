import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao, resultadoGuardado } from "@/db/repositorios/estudo";
import { redacaoDoSimulado } from "@/db/repositorios/redacao";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota } from "@/lib/formato";
import { rotuloStatus } from "@/lib/redacao";
import { revisarErros } from "../../../acoes";
import { exigirCargo } from "../../../contexto";
import { BotaoEnviar } from "@/components/botao-enviar";

const RECOMENDACAO = {
  arriscar_mais: "Seus chutes com dúvida mais acertam do que erram: vale arriscar mais nesta disciplina.",
  deixar_mais_em_branco: "Com dúvida você mais erra do que acerta: deixe mais itens em branco nesta disciplina.",
  neutro: "Acertos e erros com dúvida se anulam: tanto faz arriscar ou deixar em branco.",
  dados_insuficientes: "Menos de 10 itens com dúvida: ainda não dá para recomendar.",
} as const;

export default async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await exigirCargo();
  const sessao = await criarRepositorioEstudo(db).sessao(id);
  if (!sessao || sessao.config.tipo !== "completo") notFound();
  if (!sessao.finalizadaEm) redirect(`/simulado/${id}`);
  const [r, itens, redacao] = await Promise.all([
    resultadoGuardado(db, id),
    itensDaSessao(db, id, () => true),
    redacaoDoSimulado(db, id),
  ]);
  if (!r || r.tipo !== "completo") notFound();
  const statusRedacao = redacao ? rotuloStatus(redacao.status) : null;

  return (
    <>
      <section className={`${cartao} flex flex-col gap-6 p-8`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={r.aprovado ? pilula.azul : pilula.erro}>{r.aprovado ? "Aprovado nos cortes" : "Eliminado"}</span>
          <span className="text-sm text-pedra">Entregue em {dataEHora(sessao.finalizadaEm)}</span>
        </div>
        <div>
          <h1 className={titulo.pagina}>
            {nota(r.total)} pontos
            {r.corteConjunto !== null && <span className="text-pedra"> / corte {r.corteConjunto}</span>}
          </h1>
          {r.motivos.length > 0 && (
            <ul className={`${textoApoio} mt-3 list-disc pl-5`}>
              {r.motivos.map((m) => (
                <li key={m}>{m.replace(/^([^:]+):/, (_, slug: string) => `${r.provas.find((p) => p.slug === slug)?.nome ?? "Conjunto"}:`)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {r.provas.map((p) => (
            <div key={p.slug} className="rounded-lg border border-borda p-4">
              <p className="text-sm text-pedra">{p.nome}</p>
              <p className={`mt-1 text-[28px] font-semibold tabular-nums tracking-tight ${p.aprovada ? "" : "text-vermelho"}`}>
                {nota(p.nota)}
                {p.corte !== null && <span className="text-base font-normal text-pedra"> / corte {p.corte}</span>}
              </p>
              <p className="mt-1 text-sm text-grafite">
                {p.certos} certos · {p.errados} errados · {p.brancos} em branco
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={revisarErros}>
            <BotaoEnviar pendente="Montando a revisão…" className={botao.primario}>
              Revisar erros
            </BotaoEnviar>
          </form>
          <Link href="/simulado" className={botao.texto}>
            Voltar aos simulados
          </Link>
        </div>
      </section>

      {redacao && statusRedacao && (
        <section className={`${cartao} mt-4 flex flex-col gap-4`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={titulo.secao}>P3 – Prova discursiva</h2>
            <span className={pilula[statusRedacao.tom]}>{statusRedacao.texto}</span>
          </div>
          {redacao.status === "corrigida" && redacao.npd !== null ? (
            <p className="text-[28px] font-semibold tabular-nums tracking-tight">
              {nota(redacao.npd)}
              <span className="text-base font-normal text-pedra">
                {" "}
                / {redacao.config.pontuacaoMaxima} · mínimo {redacao.config.notaMinima}
              </span>
            </p>
          ) : redacao.status === "rascunho" ? (
            <p className={textoApoio}>A redação não foi entregue (ficou sem texto). Você pode terminá-la e entregar agora.</p>
          ) : (
            <p className={textoApoio}>A correção leva cerca de 1 minuto. A nota aparece aqui e em Redação.</p>
          )}
          {!r.aprovado && (
            <p className="rounded-lg bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
              Na prova real, sua redação não seria corrigida: só é corrigida a discursiva de quem passa nos cortes das objetivas
              (edital, item 9.7.1). Corrigimos mesmo assim, para treino.
            </p>
          )}
          <Link href={`/redacao/${redacao.id}`} className={`${botao.secundario} self-start`}>
            {redacao.status === "rascunho" ? "Continuar a redação" : "Ver a redação"}
          </Link>
        </section>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className={cartao}>
          <h2 className={titulo.secao}>Por disciplina</h2>
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-sm text-pedra">
              <tr>
                <th className="pb-2 font-medium">Disciplina</th>
                <th className="pb-2 text-right font-medium">Certos</th>
                <th className="pb-2 text-right font-medium">Errados</th>
                <th className="pb-2 text-right font-medium">Brancos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {r.porDisciplina.map((d) => (
                <tr key={d.disciplina}>
                  <td className="py-2">{d.nome}</td>
                  <td className="py-2 text-right tabular-nums">{d.certos}</td>
                  <td className="py-2 text-right tabular-nums">{d.errados}</td>
                  <td className="py-2 text-right tabular-nums">{d.brancos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cartao}>
          <h2 className={titulo.secao}>Análise de dúvida</h2>
          {r.duvidas.length === 0 ? (
            <p className={`${textoApoio} mt-3`}>Você não marcou nenhum item com dúvida.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {r.duvidas.map((d) => (
                <li key={d.disciplina}>
                  <p className="flex justify-between gap-4 font-medium">
                    <span>{d.nome}</span>
                    <span className="tabular-nums">
                      saldo {d.saldo > 0 ? `+${d.saldo}` : d.saldo} em {d.itens}
                    </span>
                  </p>
                  <p className="text-sm text-grafite">{RECOMENDACAO[d.recomendacao]}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <h2 className={`${titulo.secao} mt-12 mb-4`}>Correção item a item</h2>
      <ListaCorrecao itens={itens} />
    </>
  );
}

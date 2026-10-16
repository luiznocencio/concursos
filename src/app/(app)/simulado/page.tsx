import Link from "next/link";
import { criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { listarTemas } from "@/db/repositorios/redacao";
import { DURACAO_DISCURSIVA_MIN, previaSimulado } from "@/estudo/servico";
import { Aviso } from "@/components/aviso";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota, plural } from "@/lib/formato";
import { comecarSimulado, gerarFaltantes } from "../acoes";
import { exigirCargo } from "../contexto";

export default async function Simulado({ searchParams }: { searchParams: Promise<{ aviso?: string; pedidos?: string }> }) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const [estrutura, previa, abertos, entregues, temas] = await Promise.all([
    repo.estrutura(cargo.id),
    previaSimulado(repo, cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 20 }),
    listarTemas(db, cargo.concursoSlug),
  ]);
  const total = estrutura.provas.reduce((s, p) => s + p.nItens, 0);
  const aberto = abertos[0];
  const horas = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  const comRedacao = previa.config.duracaoMin + DURACAO_DISCURSIVA_MIN;

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className={`${cartao} flex flex-col gap-6 p-8`}>
          <div>
            <h1 className={titulo.pagina}>Simulado completo</h1>
            <p className={`${textoApoio} mt-3 max-w-[56ch]`}>
              {total} itens de {estrutura.provas.map((p) => p.nome).join(" e ")}, na distribuição do edital, em{" "}
              {horas(previa.config.duracaoMin)}
              {estrutura.temDiscursiva && `, ou ${horas(comRedacao)} com a redação`}. A correção sai só no final, com as regras e
              os cortes da banca.
            </p>
          </div>
          {aberto ? (
            <Link href={`/simulado/${aberto.id}`} className={`${botao.primario} self-start`}>
              Continuar simulado ({aberto.respondidos} de {aberto.total})
            </Link>
          ) : previa.faltantes.length === 0 ? (
            <form action={comecarSimulado} className="flex flex-col gap-4">
              {estrutura.temDiscursiva && (
                <label className="flex items-start gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    name="discursiva"
                    value="sim"
                    defaultChecked={temas.length > 0}
                    disabled={temas.length === 0}
                    className="mt-1 size-4 accent-azul"
                  />
                  <span>
                    Incluir a prova discursiva ({horas(comRedacao)} no total)
                    {temas.length === 0 && (
                      <span className="block text-sm text-pedra">
                        Ainda não há tema de redação. Gere um em <Link href="/redacao" className="text-azul hover:underline">Redação</Link>.
                      </span>
                    )}
                  </span>
                </label>
              )}
              <button type="submit" className={`${botao.primario} self-start`}>
                Começar simulado
              </button>
            </form>
          ) : (
            <p className="text-sm text-pedra">Ainda faltam itens para montar a prova inteira.</p>
          )}
        </div>

        {previa.faltantes.length > 0 && !aberto && (
          <div className={cartao}>
            <h2 className={titulo.secao}>Itens que faltam</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {previa.faltantes.map((f) => (
                <li key={`${f.prova}:${f.disciplina}`} className="flex justify-between gap-4 text-[15px]">
                  <span>{f.nome}</span>
                  <span className="text-pedra">{plural(f.faltam, "item", "itens")}</span>
                </li>
              ))}
            </ul>
            <form action={gerarFaltantes} className="mt-6">
              {[...new Set(previa.faltantes.flatMap((f) => f.canonicos))].map((c) => (
                <input key={c} type="hidden" name="canonico" value={c} />
              ))}
              <button type="submit" className={botao.secundario}>
                Pedir itens à IA
              </button>
            </form>
            <p className="mt-3 text-sm text-pedra">Até 3 pedidos em aberto por vez; cada pedido gera 5 itens.</p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className={titulo.secao}>Simulados entregues</h2>
        {entregues.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhum ainda. O primeiro vira a sua linha de base.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead className="text-sm text-pedra">
                <tr className="border-b border-borda">
                  <th className="py-2 font-medium">Data</th>
                  {estrutura.provas.map((p) => (
                    <th key={p.slug} className="py-2 font-medium">
                      {p.nome.split(" ")[0]}
                    </th>
                  ))}
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {entregues.map((s) =>
                  s.resultado?.tipo === "completo" ? (
                    <tr key={s.id} className="border-b border-borda">
                      <td className="py-3">
                        <Link href={`/simulado/${s.id}/resultado`} className="text-azul hover:underline">
                          {dataEHora(s.finalizadaEm!)}
                        </Link>
                      </td>
                      {estrutura.provas.map((p) => {
                        const r = s.resultado?.tipo === "completo" ? s.resultado.provas.find((x) => x.slug === p.slug) : undefined;
                        return (
                          <td key={p.slug} className={`py-3 tabular-nums ${r && !r.aprovada ? "text-vermelho" : ""}`}>
                            {r ? `${nota(r.nota)} / ${r.corte ?? "-"}` : "-"}
                          </td>
                        );
                      })}
                      <td className="py-3 tabular-nums">
                        {nota(s.resultado.total)}
                        {s.resultado.corteConjunto !== null ? ` / ${s.resultado.corteConjunto}` : ""}
                      </td>
                      <td className="py-3">
                        <span className={s.resultado.aprovado ? pilula.azul : pilula.erro}>
                          {s.resultado.aprovado ? "Aprovado" : "Eliminado"}
                        </span>
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao, resultadoGuardado } from "@/db/repositorios/estudo";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota } from "@/lib/formato";
import { revisarErros } from "../../../acoes";
import { exigirCargo } from "../../../contexto";

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
  const [r, itens] = await Promise.all([resultadoGuardado(db, id), itensDaSessao(db, id, () => true)]);
  if (!r || r.tipo !== "completo") notFound();

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
            {r.corteConjunto !== null && <span className="text-black/40"> / corte {r.corteConjunto}</span>}
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
            <button type="submit" className={botao.primario}>
              Revisar erros
            </button>
          </form>
          <Link href="/simulado" className={botao.texto}>
            Voltar aos simulados
          </Link>
        </div>
      </section>

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

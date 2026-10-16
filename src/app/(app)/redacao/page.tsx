import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Evolucao } from "@/components/painel/evolucao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { configDaDiscursiva, listarRedacoes, listarTemas } from "@/db/repositorios/redacao";
import { data, nota } from "@/lib/formato";
import { resumoDoTema, rotuloStatus } from "@/lib/redacao";
import { exigirCargo } from "../contexto";
import { novaRedacao, pedirNovoTema } from "./acoes";

export default async function Redacoes({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const [temas, redacoes, config] = await Promise.all([
    listarTemas(db, cargo.concursoSlug),
    listarRedacoes(db),
    configDaDiscursiva(db, cargo.concursoSlug),
  ]);
  const corrigidas = redacoes.filter((r) => r.status === "corrigida" && r.npd !== null).slice(0, 8).reverse();

  return (
    <>
      <Aviso codigo={aviso} />
      <h1 className={titulo.pagina}>Redação</h1>
      <p className={`${textoApoio} mt-3 max-w-[62ch]`}>
        Escreva na folha de {config?.linhasMax ?? 30} linhas ou envie a foto da folha manuscrita. Duas bancas de IA corrigem o
        conteúdo, como na Cebraspe, e a revisão de língua aponta cada erro.
      </p>

      {config && corrigidas.length >= 2 && (
        <section className={`${cartao} mt-8`}>
          <Evolucao
            nome="Nota na discursiva"
            maximo={config.pontuacaoMaxima}
            corte={config.notaMinima}
            pontos={corrigidas.map((r) => ({ id: r.id, rotulo: data(r.corrigidaEm ?? r.criadaEm), nota: r.npd ?? 0 }))}
          />
        </section>
      )}

      <section className="mt-12">
        <h2 className={titulo.secao}>Suas redações</h2>
        {redacoes.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhuma redação ainda. Escolha um tema abaixo para começar.</p>
        ) : (
          <ul className="mt-4 divide-y divide-borda rounded-xl border border-borda bg-superficie">
            {redacoes.map((r) => {
              const s = rotuloStatus(r.status);
              return (
                <li key={r.id}>
                  <Link href={`/redacao/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-realce">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2" title={r.tema}>
                        {resumoDoTema(r.tema)}
                      </span>
                      <span className="text-sm text-pedra">{data(r.criadaEm)}</span>
                    </span>
                    <span className={pilula[s.tom]}>{s.texto}</span>
                    {r.npd !== null && <span className="w-12 text-right font-semibold tabular-nums">{nota(r.npd)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={titulo.secao}>Escolha um tema</h2>
          <form action={pedirNovoTema}>
            <button type="submit" className={botao.secundario}>
              Gerar tema novo
            </button>
          </form>
        </div>
        {temas.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhum tema ainda. Gere um tema novo: fica pronto em cerca de 1 minuto.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {temas.map((t) => (
              <li key={t.id} className={`${cartao} flex flex-col gap-4`}>
                <div className="flex flex-wrap gap-2">
                  {t.origem === "real" && <span className={pilula.azul}>Tema real{t.provaOrigem ? ` · ${t.provaOrigem}` : ""}</span>}
                  {t.feito && <span className={pilula.neutra}>Já feito</span>}
                </div>
                <p className="line-clamp-3 font-medium" title={t.enunciado}>
                  {resumoDoTema(t.enunciado)}
                </p>
                <form action={novaRedacao} className="mt-auto">
                  <input type="hidden" name="tema" value={t.id} />
                  <button type="submit" className={botao.contorno}>
                    Escrever sobre este tema
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { calcularPrioridades } from "@/core";
import { contarRevisoesVencidas, criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { diasAte } from "@/estudo/painel";
import { Aviso } from "@/components/aviso";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, data, dataDaProva, plural } from "@/lib/formato";
import { nomeDaSessao, rotaDaSessao } from "@/lib/modos";
import { escolherCargo, estudarAgora, revisarErros, treinarTopicos } from "./acoes";
import { contextoDoUsuario } from "./contexto";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ aviso?: string; pedidos?: string }> }) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo, cargos } = await contextoDoUsuario();
  if (!cargo) {
    return (
      <>
        <Aviso codigo="sem-concurso" />
        <h1 className={titulo.pagina}>Nenhum concurso carregado</h1>
        <p className={`${textoApoio} mt-3 max-w-[60ch]`}>Carregue um edital pelo guia em docs/deploy.md.</p>
      </>
    );
  }

  const agora = new Date();
  const repo = criarRepositorioEstudo(db);
  const [estrutura, historico, abertas, recentes, vencidas] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { limite: 5 }),
    contarRevisoesVencidas(db, agora),
  ]);
  const foco = calcularPrioridades(estrutura.topicosAlvo, historico, agora).slice(0, 5);
  const aberta = abertas[0];
  const dias = diasAte(estrutura.concurso.dataProva, agora);

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className={`${cartao} flex flex-col gap-6 p-8`}>
          <div className="flex flex-col gap-3">
            <h1 className={titulo.pagina}>Estudar agora</h1>
            <p className={`${textoApoio} max-w-[52ch]`}>
              20 itens escolhidos pelos seus pontos fracos: a maior parte dos tópicos que mais precisam, mais revisões
              vencidas e alguns tópicos fortes para não esquecer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={estudarAgora}>
              <button type="submit" className={botao.primario}>
                Começar sessão
              </button>
            </form>
            {aberta && (
              <Link href={rotaDaSessao(aberta.id, aberta.config)} className={botao.secundario}>
                Retomar {nomeDaSessao(aberta.config).toLowerCase()} ({aberta.respondidos} de {aberta.total})
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-xl bg-meia-noite p-8 text-white">
          <div>
            <p className="text-sm text-white/70">{estrutura.concurso.nome}</p>
            <p className="mt-2 text-[56px] font-semibold leading-none tracking-[-0.035em]">{dias}</p>
            <p className="mt-2 text-white/80">
              {dias === 1 ? "dia" : "dias"} até a prova, em {dataDaProva(estrutura.concurso.dataProva)}
            </p>
          </div>
          {cargos.length > 1 && (
            <form action={escolherCargo} className="flex flex-wrap gap-2" aria-label="Cargo">
              {cargos.map((c) => (
                <button
                  key={c.id}
                  type="submit"
                  name="cargo"
                  value={c.id}
                  aria-pressed={c.id === cargo.id}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                    c.id === cargo.id ? "bg-white text-meia-noite" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </form>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className={`${cartao} flex flex-col justify-between gap-6`}>
          <div>
            <h2 className={titulo.secao}>Revisão de erros</h2>
            <p className={`${textoApoio} mt-2`}>
              {vencidas > 0
                ? `${plural(vencidas, "item errado ou em branco está", "itens errados ou em branco estão")} no dia de voltar.`
                : "Nada vencido. Os erros voltam 1, 3, 7 e 15 dias depois."}
            </p>
          </div>
          <form action={revisarErros}>
            <button type="submit" disabled={vencidas === 0} className={botao.contorno}>
              Revisar agora
            </button>
          </form>
        </div>

        <div className={cartao}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={titulo.secao}>Onde focar</h2>
            <Link href="/painel" className="text-sm font-medium text-azul hover:underline">
              Ver painel
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-borda">
            {foco.map((t) => (
              <li key={t.chave} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium" title={t.titulo}>{t.titulo}</p>
                  <p className="text-sm text-pedra">
                    {estrutura.disciplinas[t.disciplina]} ·{" "}
                    {t.n === 0 ? "nunca praticado" : `${aproveitamento(t.aproveitamento)} em ${plural(t.n, "resposta", "respostas")}`}
                  </p>
                </div>
                <form action={treinarTopicos}>
                  <input type="hidden" name="canonico" value={t.canonico} />
                  <input type="hidden" name="total" value="10" />
                  <button type="submit" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    Treinar
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {recentes.length > 0 && (
        <section className="mt-12">
          <h2 className={titulo.secao}>Sessões recentes</h2>
          <ul className="mt-4 divide-y divide-borda border-t border-borda">
            {recentes.map((s) => (
              <li key={s.id}>
                <Link
                  href={rotaDaSessao(s.id, s.config)}
                  className="flex items-center gap-4 py-3 transition-colors duration-200 hover:bg-realce"
                >
                  <span className="w-16 shrink-0 text-sm text-pedra">{data(s.iniciadaEm)}</span>
                  <span className="flex-1 font-medium">{nomeDaSessao(s.config)}</span>
                  <ResumoSessao s={s} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ResumoSessao({ s }: { s: Awaited<ReturnType<typeof listarSessoes>>[number] }) {
  if (!s.finalizadaEm) return <span className={pilula.alerta}>{s.respondidos} de {s.total}</span>;
  if (s.resultado?.tipo === "completo")
    return <span className={s.resultado.aprovado ? pilula.azul : pilula.erro}>{s.resultado.aprovado ? "Aprovado" : "Eliminado"}</span>;
  if (s.resultado?.tipo === "treino")
    return (
      <span className="text-sm text-grafite">
        {s.resultado.certos} certos · {s.resultado.errados} errados
      </span>
    );
  return null;
}

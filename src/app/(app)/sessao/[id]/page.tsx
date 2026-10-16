import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao } from "@/db/repositorios/estudo";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { PlayerTreino } from "@/components/sessao/player-treino";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import { nomeDaSessao } from "@/lib/modos";
import { estudarAgora } from "../../acoes";
import { contextoDoUsuario } from "../../contexto";
import { encerrar } from "./acoes";
import { BotaoEnviar } from "@/components/botao-enviar";

export default async function PaginaSessao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await contextoDoUsuario();
  const sessao = await criarRepositorioEstudo(db).sessao(id);
  if (!sessao) notFound();
  if (sessao.config.tipo === "completo") redirect(`/simulado/${id}`);

  const encerrada = sessao.finalizadaEm !== null;
  const itens = await itensDaSessao(db, id, (respondido) => encerrada || respondido);

  if (!encerrada) {
    return (
      <>
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className={titulo.secao}>{nomeDaSessao(sessao.config)}</h1>
          <form action={encerrar.bind(null, id)}>
            <BotaoEnviar pendente="Encerrando…" className={botao.texto}>
              Encerrar sessão
            </BotaoEnviar>
          </form>
        </div>
        <PlayerTreino sessaoId={id} itens={itens} />
      </>
    );
  }

  const respondidos = itens.filter((i) => i.resposta);
  const certos = respondidos.filter((i) => i.resposta!.resposta === i.correcao?.gabarito).length;
  const brancos = respondidos.filter((i) => i.resposta!.resposta === "branco").length;
  const errados = respondidos.length - certos - brancos;
  return (
    <>
      <section className={`${cartao} flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between`}>
        <div>
          <p className="text-sm text-pedra">{nomeDaSessao(sessao.config)} encerrada</p>
          <h1 className={`${titulo.pagina} mt-2`}>
            {certos} de {respondidos.length} certos
          </h1>
          <p className={`${textoApoio} mt-2`}>
            {errados} errados e {brancos} em branco. Os erros e brancos voltam na revisão de amanhã.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={estudarAgora}>
            <BotaoEnviar pendente="Montando a sessão…" className={botao.primario}>
              Nova sessão
            </BotaoEnviar>
          </form>
          <Link href="/" className={botao.texto}>
            Voltar ao início
          </Link>
        </div>
      </section>
      <h2 className={`${titulo.secao} mt-12 mb-4`}>Itens da sessão</h2>
      <ListaCorrecao itens={itens.filter((i) => i.resposta)} />
    </>
  );
}

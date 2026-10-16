import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Andamento } from "@/components/redacao/andamento";
import { ConferenciaFoto } from "@/components/redacao/conferencia-foto";
import { EnvioFoto } from "@/components/redacao/envio-foto";
import { FolhaEscrita } from "@/components/redacao/folha-escrita";
import { ResultadoRedacao } from "@/components/redacao/resultado";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { carregarRedacao, urlsDasFotos } from "@/db/repositorios/redacao";
import { passosDoAndamento, rotuloStatus } from "@/lib/redacao";
import { contextoDoUsuario } from "../../contexto";
import { tentarDeNovo } from "../acoes";
import { BotaoEnviar } from "@/components/botao-enviar";

const transcricaoSchema = z.object({ linhas: z.array(z.object({ texto: z.string(), ilegivel: z.boolean() })) });

export default async function PaginaRedacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { db, user } = await contextoDoUsuario();
  const r = await carregarRedacao(db, id);
  if (!r) notFound();
  const s = rotuloStatus(r.status);

  return (
    <>
      <Link href="/redacao" className={`${botao.texto} -ml-4 mb-4`}>
        ← Redações
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={titulo.secao}>Redação</h1>
        <span className={pilula[s.tom]}>{s.texto}</span>
        {r.tema.origem === "real" && <span className={pilula.azul}>Tema real{r.tema.provaOrigem ? ` · ${r.tema.provaOrigem}` : ""}</span>}
      </div>

      <details className={`${cartao} mt-6`} open={r.status === "rascunho"}>
        <summary className="cursor-pointer font-semibold">Proposta</summary>
        <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line">{r.tema.enunciado}</p>
        {r.tema.textosApoio.map((t, i) => (
          <blockquote key={i} className="mt-4 border-l-2 border-borda-forte pl-4 text-[15px] text-grafite">
            {t.titulo && <p className="font-medium text-tinta">{t.titulo}</p>}
            <p className="whitespace-pre-line">{t.texto}</p>
            {t.fonte && <p className="mt-1 text-sm text-pedra">{t.fonte}</p>}
          </blockquote>
        ))}
      </details>

      {(r.aviso || erro) && (
        <p role="status" className="mt-6 rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          {erro ?? r.aviso}
        </p>
      )}

      <div className="mt-8">
        <Conteudo r={r} usuarioId={user.id} />
      </div>
    </>
  );
}

async function Conteudo({ r, usuarioId }: { r: NonNullable<Awaited<ReturnType<typeof carregarRedacao>>>; usuarioId: string }) {
  const { db } = await contextoDoUsuario();
  switch (r.status) {
    case "rascunho":
      return (
        <div className="flex flex-col gap-10">
          <FolhaEscrita redacaoId={r.id} textoInicial={r.texto} config={r.config} />
          <section className={`${cartao} flex flex-col gap-3`}>
            <h2 className="font-semibold">Prefere escrever no papel?</h2>
            <p className={textoApoio}>
              Escreva à mão numa folha de {r.config.linhasMax} linhas e envie a foto. A IA transcreve linha por linha e você
              confere antes da correção.
            </p>
            <EnvioFoto redacaoId={r.id} usuarioId={usuarioId} />
          </section>
        </div>
      );
    case "aguardando_confirmacao": {
      const t = transcricaoSchema.safeParse(r.correcoes.find((c) => c.papel === "transcricao")?.resposta);
      const duvidosas = t.success ? t.data.linhas.flatMap((l, i) => (l.ilegivel ? [i + 1] : [])) : [];
      return (
        <ConferenciaFoto
          redacaoId={r.id}
          fotos={await urlsDasFotos(db, r.fotos)}
          linhasIniciais={r.linhas}
          duvidosas={duvidosas}
          linhasMax={r.config.linhasMax}
        />
      );
    }
    case "corrigida":
      return <ResultadoRedacao r={r} />;
    case "falhou":
      return (
        <section className={`${cartao} flex flex-col gap-4`}>
          <p className={textoApoio}>A correção não terminou. Seu texto está salvo e pode ser corrigido de novo.</p>
          <form action={tentarDeNovo.bind(null, r.id)}>
            <BotaoEnviar pendente="Entregando…" className={botao.primario}>
              Tentar de novo
            </BotaoEnviar>
          </form>
        </section>
      );
    default:
      return (
        <section className={`${cartao} flex flex-col gap-6`}>
          <Andamento
            passos={passosDoAndamento(r.status, r.correcoes.map((c) => c.papel))}
            desde={r.status === "transcrevendo" ? r.atualizadoEm : (r.entregueEm ?? r.atualizadoEm)}
          />
          <p className={textoApoio}>Leva cerca de 1 minuto. Pode sair desta página: a correção continua e fica salva em Redações.</p>
        </section>
      );
  }
}

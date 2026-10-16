import { ErroIa, type ProvedorIa } from "../../ai/tipos";
import { contarTL } from "../../core/discursiva/linhas";
import { ErroPipeline } from "../gerar-lote";
import { consolidarCorrecao, resultadoSemTexto, type ResultadoCorrecao } from "./consolidar";
import { promptConteudo, promptLingua, SISTEMA_EXAMINADOR, SISTEMA_REVISOR_LINGUA } from "./prompts";
import { correcaoConteudoSchema, correcaoLinguaSchema, type CorrecaoConteudo, type CorrecaoLingua } from "./schemas";
import type { DepsDiscursiva, PapelCorrecao, RedacaoParaProcessar } from "./tipos";

export type ResumoCorrecao =
  | { status: "corrigida"; npd: number; terceiraCorrecao: boolean }
  | { status: "ignorada"; motivo: string };

interface Etapa {
  papel: PapelCorrecao;
  provedor: ProvedorIa;
  finalidade: string;
  pedir(p: ProvedorIa): ReturnType<ProvedorIa["gerarJson"]>;
}

function etapaConteudo(r: RedacaoParaProcessar, papel: PapelCorrecao, provedor: ProvedorIa): Etapa {
  return {
    papel,
    provedor,
    finalidade: "discursiva_conteudo",
    pedir: (p) =>
      p.gerarJson({
        finalidade: "discursiva_conteudo",
        sistema: SISTEMA_EXAMINADOR,
        prompt: promptConteudo({ tema: r.tema, linhas: r.linhas, variante: papel === "conteudo_3" ? "terceira" : undefined }),
        schema: correcaoConteudoSchema,
        nomeSchema: "correcao_conteudo",
      }),
  };
}

function etapaLingua(r: RedacaoParaProcessar, provedor: ProvedorIa): Etapa {
  return {
    papel: "lingua",
    provedor,
    finalidade: "discursiva_lingua",
    pedir: (p) =>
      p.gerarJson({
        finalidade: "discursiva_lingua",
        sistema: SISTEMA_REVISOR_LINGUA,
        prompt: promptLingua({ linhas: r.linhas }),
        schema: correcaoLinguaSchema,
        nomeSchema: "correcao_lingua",
      }),
  };
}

// Roda as etapas em paralelo; grava cada resposta assim que chega e registra o custo mesmo das que falham.
async function executarEtapas(deps: DepsDiscursiva, redacaoId: string, etapas: Etapa[]): Promise<void> {
  const resultados = await Promise.allSettled(
    etapas.map(async (e) => {
      try {
        const r = await e.pedir(e.provedor);
        // Grava a resposta antes do custo: uma falha no registro de uso não perde uma resposta já paga.
        await deps.repo.gravarCorrecao(redacaoId, e.papel, r.uso, r.dados);
        await deps.repo.registrarUso(r.uso, e.finalidade, deps.jobId);
      } catch (erro) {
        if (erro instanceof ErroIa && erro.uso) await deps.repo.registrarUso(erro.uso, e.finalidade, deps.jobId);
        throw erro;
      }
    }),
  );
  const falhas = resultados.flatMap((r, i) =>
    r.status === "rejected" ? [`${etapas[i].papel}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : [],
  );
  if (falhas.length) throw new ErroPipeline(`Correção incompleta: ${falhas.join("; ")}`);
}

/**
 * Corrige uma redação entregue: duas bancas de conteúdo independentes (Claude e GPT) e a revisão de língua em paralelo,
 * a terceira correção quando o edital exige, e a nota final calculada pelo código. Etapas já gravadas não são refeitas.
 */
export async function corrigirRedacao(deps: DepsDiscursiva, redacaoId: string): Promise<ResumoCorrecao> {
  const r = await deps.repo.carregarRedacao(redacaoId);
  if (!r) throw new ErroPipeline(`Redação ${redacaoId} não encontrada`, true);
  if (r.status === "corrigida") return { status: "ignorada", motivo: "já corrigida" };
  if (r.status !== "na_fila" && r.status !== "corrigindo") {
    throw new ErroPipeline(`Redação ${redacaoId} não está na fila (estado ${r.status})`, true);
  }
  await deps.repo.marcarStatus(r.id, "corrigindo");

  let resultado: ResultadoCorrecao;
  if (contarTL(r.linhas) === 0) {
    resultado = resultadoSemTexto(r.tema.padrao.aspectos);
  } else {
    const [claude, gpt] = deps.provedores;
    let feitas = await deps.repo.correcoes(r.id);
    const pendentes = [
      etapaConteudo(r, "conteudo_1", claude),
      etapaConteudo(r, "conteudo_2", gpt),
      etapaLingua(r, claude),
    ].filter((e) => feitas[e.papel] === undefined);
    if (pendentes.length) {
      await executarEtapas(deps, r.id, pendentes);
      feitas = await deps.repo.correcoes(r.id);
    }

    const conteudos: CorrecaoConteudo[] = [
      correcaoConteudoSchema.parse(feitas.conteudo_1),
      correcaoConteudoSchema.parse(feitas.conteudo_2),
    ];
    const lingua: CorrecaoLingua = correcaoLinguaSchema.parse(feitas.lingua);
    const entrada = { aspectos: r.tema.padrao.aspectos, pontuacaoMaxima: r.config.pontuacaoMaxima, linhas: r.linhas, lingua };

    let consolidacao = consolidarCorrecao({ ...entrada, conteudos });
    if (consolidacao.precisaTerceira) {
      if (feitas.conteudo_3 === undefined) {
        await executarEtapas(deps, r.id, [etapaConteudo(r, "conteudo_3", claude)]);
        feitas = await deps.repo.correcoes(r.id);
      }
      conteudos.push(correcaoConteudoSchema.parse(feitas.conteudo_3));
      consolidacao = consolidarCorrecao({ ...entrada, conteudos });
    }
    if (consolidacao.precisaTerceira) throw new ErroPipeline("Correção sem consolidação após a terceira banca", true);
    resultado = consolidacao.resultado;
  }

  await deps.repo.gravarResultado(r, resultado);
  return { status: "corrigida", npd: resultado.npd, terceiraCorrecao: resultado.terceiraCorrecao };
}

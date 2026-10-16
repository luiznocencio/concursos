import { z } from "zod/v4";
import { MAX_TENTATIVAS, type Job, type ProcessadorJob } from "../executar-job";
import { ErroPipeline } from "../gerar-lote";
import { corrigirRedacao } from "./corrigir";
import { gerarTema } from "./gerar-tema";
import { transcreverRedacao } from "./transcrever";
import type { DepsDiscursiva } from "./tipos";

export const payloadRedacaoSchema = z.object({ redacao_id: z.string().min(1) });
export const payloadTemaSchema = z.object({ concurso: z.string().min(1) });

export const AVISO_CORRECAO_FALHOU = "Não conseguimos corrigir agora. Seu texto está salvo: tente de novo em alguns minutos.";
export const AVISO_TRANSCRICAO_FALHOU = "Não conseguimos ler a foto agora. Envie de novo em alguns minutos.";

function redacaoDoJob(job: Job): string {
  const p = payloadRedacaoSchema.safeParse(job.payload);
  if (!p.success) throw new ErroPipeline(`Payload inválido: ${p.error.message}`, true);
  return p.data.redacao_id;
}

// Na última tentativa (ou em erro definitivo), a redação sai da fila com um aviso, para o usuário não esperar à toa.
function ultimaTentativa(job: Job, e: unknown): boolean {
  return (e instanceof ErroPipeline && e.definitivo) || job.tentativas >= MAX_TENTATIVAS;
}

export function processadoresDiscursiva(base: Omit<DepsDiscursiva, "jobId">): Record<string, ProcessadorJob> {
  return {
    async corrigir_redacao(job) {
      const id = redacaoDoJob(job);
      try {
        return await corrigirRedacao({ ...base, jobId: job.id }, id);
      } catch (e) {
        if (ultimaTentativa(job, e)) await base.repo.marcarStatus(id, "falhou", AVISO_CORRECAO_FALHOU);
        throw e;
      }
    },
    async transcrever_redacao(job) {
      const id = redacaoDoJob(job);
      try {
        return await transcreverRedacao({ ...base, jobId: job.id }, id);
      } catch (e) {
        if (ultimaTentativa(job, e)) {
          const r = await base.repo.carregarRedacao(id);
          if (r) await base.repo.gravarTranscricao(r, { ok: false, aviso: AVISO_TRANSCRICAO_FALHOU });
        }
        throw e;
      }
    },
    async gerar_tema(job) {
      const p = payloadTemaSchema.safeParse(job.payload);
      if (!p.success) throw new ErroPipeline(`Payload inválido: ${p.error.message}`, true);
      return gerarTema({ ...base, jobId: job.id }, p.data.concurso);
    },
  };
}

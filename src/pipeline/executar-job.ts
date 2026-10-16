import { z } from "zod/v4";
import { ErroPipeline, type EntradaLote, type FonteLegal, type ResumoLote } from "./gerar-lote";
import type { ContextoTopico } from "./prompts";

export const MAX_TENTATIVAS = 3;

export const payloadGerarItensSchema = z.object({
  concurso: z.string().min(1),
  canonico: z.string().min(1),
  quantidade: z.number().int().min(1).max(5),
});

export interface Job {
  id: string;
  tipo: string;
  payload: unknown;
  tentativas: number;
}

export interface FilaJobs {
  reservar(): Promise<Job | null>;
  concluir(id: string): Promise<void>;
  falhar(id: string, erro: string, maxTentativas: number): Promise<void>;
}

export interface ContextoGeracao {
  banca: string;
  topico: ContextoTopico;
  fonte: FonteLegal | null;
}

// Processa um job de outro tipo (ex.: corrigir_redacao) e devolve um resumo para o log do worker.
export type ProcessadorJob = (job: Job) => Promise<unknown>;

export interface DepsJob {
  fila: FilaJobs;
  carregarContexto(concurso: string, canonico: string): Promise<ContextoGeracao>;
  gerar(entrada: EntradaLote, jobId: string): Promise<ResumoLote>;
  processadores?: Record<string, ProcessadorJob>;
}

export type ResultadoJob =
  | { status: "vazio" }
  | { status: "concluido"; jobId: string; resumo: unknown }
  | { status: "falhou"; jobId: string; erro: string };

// A rodada vem do id do job (varia entre jobs) e da tentativa (troca o gerador numa nova tentativa).
export function rodadaDoJob(job: Job): number {
  return parseInt(job.id.replace(/-/g, "").slice(0, 8), 16) + job.tentativas - 1;
}

async function gerarItens(deps: DepsJob, job: Job): Promise<ResumoLote> {
  const payload = payloadGerarItensSchema.safeParse(job.payload);
  if (!payload.success) throw new ErroPipeline(`Payload inválido: ${payload.error.message}`, true);
  const { concurso, canonico, quantidade } = payload.data;
  const contexto = await deps.carregarContexto(concurso, canonico);
  return deps.gerar(
    { banca: contexto.banca, topico: contexto.topico, fonte: contexto.fonte, quantidade, rodada: rodadaDoJob(job) },
    job.id,
  );
}

async function processarOutro(deps: DepsJob, job: Job): Promise<unknown> {
  const processar = deps.processadores?.[job.tipo];
  if (!processar) throw new ErroPipeline(`Tipo de job desconhecido: ${job.tipo}`, true);
  return processar(job);
}

export async function executarProximoJob(deps: DepsJob): Promise<ResultadoJob> {
  const job = await deps.fila.reservar();
  if (!job) return { status: "vazio" };
  try {
    const resumo = job.tipo === "gerar_itens" ? await gerarItens(deps, job) : await processarOutro(deps, job);
    await deps.fila.concluir(job.id);
    return { status: "concluido", jobId: job.id, resumo };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    const definitivo = e instanceof ErroPipeline && e.definitivo;
    await deps.fila.falhar(job.id, erro, definitivo ? 0 : MAX_TENTATIVAS);
    return { status: "falhou", jobId: job.id, erro };
  }
}

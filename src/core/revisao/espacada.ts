import type { ResultadoResposta } from "../tipos";

export const INTERVALOS_DIAS: readonly number[] = [1, 3, 7, 15];

const DIA_MS = 86_400_000;

export interface EstadoRevisao {
  etapa: number;
  proximaEm: Date;
}

function agendar(etapa: number, agora: Date): EstadoRevisao {
  return { etapa, proximaEm: new Date(agora.getTime() + INTERVALOS_DIAS[etapa - 1] * DIA_MS) };
}

export function proximoEstadoRevisao(
  atual: EstadoRevisao | null,
  resultado: ResultadoResposta,
  agora: Date,
): EstadoRevisao | null {
  if (resultado === "errado" || resultado === "branco") return agendar(1, agora);
  if (atual === null) return null;
  if (resultado === "certo_duvida") return agendar(atual.etapa, agora);
  if (atual.etapa >= INTERVALOS_DIAS.length) return null;
  return agendar(atual.etapa + 1, agora);
}

export function revisaoVencida(estado: EstadoRevisao, agora: Date): boolean {
  return estado.proximaEm.getTime() <= agora.getTime();
}

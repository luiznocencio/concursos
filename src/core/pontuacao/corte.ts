import type { RegraCorte } from "../edital/schema";

// Tolerância para que 100 × 0,29 (= 28,999999999999996) resulte em 29.
const EPSILON = 1e-9;

export function valorCorte(
  regra: RegraCorte,
  ctx: { nItens: number; np?: number; pontuacaoMaxima: number },
): number {
  switch (regra.regra) {
    case "piso_fator":
      return Math.floor((ctx.nItens - (ctx.np ?? 0)) * regra.fator + EPSILON);
    case "minimo_percentual":
      return regra.percentual * ctx.pontuacaoMaxima;
    case "minimo_absoluto":
      return regra.valor;
  }
}

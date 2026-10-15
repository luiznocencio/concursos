import type { Situacao } from "./pontuacao/pontuacao";

export type ResultadoResposta = "certo" | "certo_duvida" | "errado" | "branco";

export function resultadoDaResposta(s: Situacao, duvida: boolean): ResultadoResposta {
  if (s === "certo") return duvida ? "certo_duvida" : "certo";
  return s;
}

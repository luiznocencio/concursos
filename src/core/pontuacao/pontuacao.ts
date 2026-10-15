import type { RegraPontuacao } from "../edital/schema";

export type Marcacao = string | null;

export interface RespostaCorrigivel {
  marcacao: Marcacao;
  gabarito: string;
}

export type Situacao = "certo" | "errado" | "branco";

export function situacao(r: RespostaCorrigivel): Situacao {
  if (r.marcacao === null) return "branco";
  return r.marcacao === r.gabarito ? "certo" : "errado";
}

export function valorAcerto(regra: RegraPontuacao, nItens: number, np = 0): number {
  if (regra.regra === "multipla_escolha") return regra.peso;
  if (np >= nItens) throw new Error("np deve ser menor que o número de itens");
  return nItens / (nItens - np);
}

export function valorErro(regra: RegraPontuacao, nItens: number, np = 0): number {
  if (regra.regra === "multipla_escolha") return regra.penalidade === 0 ? 0 : -regra.penalidade;
  return -valorAcerto(regra, nItens, np);
}

export function notaProva(regra: RegraPontuacao, respostas: RespostaCorrigivel[], np = 0): number {
  const n = respostas.length;
  let nota = 0;
  for (const r of respostas) {
    const s = situacao(r);
    if (s === "certo") nota += valorAcerto(regra, n, np);
    else if (s === "errado") nota += valorErro(regra, n, np);
  }
  return nota;
}

export function pontuacaoMaxima(regra: RegraPontuacao, nItens: number, np = 0): number {
  return nItens * valorAcerto(regra, nItens, np);
}

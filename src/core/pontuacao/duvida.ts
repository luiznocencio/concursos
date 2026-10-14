import { situacao, type RespostaCorrigivel } from "./pontuacao";

export interface RespostaDuvida extends RespostaCorrigivel {
  disciplina: string;
  duvida: boolean;
}

export type Recomendacao = "arriscar_mais" | "deixar_mais_em_branco" | "neutro" | "dados_insuficientes";

export interface AnaliseDuvida {
  disciplina: string;
  itens: number;
  certos: number;
  errados: number;
  saldo: number;
  recomendacao: Recomendacao;
}

export function analisarDuvidas(respostas: RespostaDuvida[], minimoItens = 10): AnaliseDuvida[] {
  const porDisciplina = new Map<string, { certos: number; errados: number }>();
  for (const r of respostas) {
    if (!r.duvida) continue;
    const s = situacao(r);
    if (s === "branco") continue;
    const acc = porDisciplina.get(r.disciplina) ?? { certos: 0, errados: 0 };
    if (s === "certo") acc.certos++;
    else acc.errados++;
    porDisciplina.set(r.disciplina, acc);
  }

  return [...porDisciplina.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([disciplina, { certos, errados }]) => {
      const itens = certos + errados;
      const saldo = certos - errados;
      const recomendacao: Recomendacao =
        itens < minimoItens ? "dados_insuficientes" : saldo > 0 ? "arriscar_mais" : saldo < 0 ? "deixar_mais_em_branco" : "neutro";
      return { disciplina, itens, certos, errados, saldo, recomendacao };
    });
}

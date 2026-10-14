import type { RegraCorte, RegraPontuacao } from "../edital/schema";
import { valorCorte } from "./corte";
import { notaProva, pontuacaoMaxima, situacao, type RespostaCorrigivel } from "./pontuacao";

export interface EntradaProva {
  slug: string;
  regra: RegraPontuacao;
  corte?: RegraCorte;
  respostas: RespostaCorrigivel[];
  np?: number;
}

export interface ResultadoProva {
  slug: string;
  nota: number;
  corte: number | null;
  aprovada: boolean;
  certos: number;
  errados: number;
  brancos: number;
}

export interface ResultadoSimulado {
  provas: ResultadoProva[];
  total: number;
  corteConjunto: number | null;
  aprovado: boolean;
  motivos: string[];
}

function fmt(n: number): string {
  return String(Number(n.toFixed(2)));
}

function resultadoProva(p: EntradaProva): ResultadoProva {
  const np = p.np ?? 0;
  const nItens = p.respostas.length;
  const nota = notaProva(p.regra, p.respostas, np);
  const corte = p.corte
    ? valorCorte(p.corte, { nItens, np, pontuacaoMaxima: pontuacaoMaxima(p.regra, nItens, np) })
    : null;
  const contagem = { certo: 0, errado: 0, branco: 0 };
  for (const r of p.respostas) contagem[situacao(r)]++;
  return {
    slug: p.slug,
    nota,
    corte,
    aprovada: corte === null || nota >= corte,
    certos: contagem.certo,
    errados: contagem.errado,
    brancos: contagem.branco,
  };
}

export function calcularResultado(provas: EntradaProva[], corteConjunto?: RegraCorte): ResultadoSimulado {
  const resultados = provas.map(resultadoProva);
  const total = resultados.reduce((s, r) => s + r.nota, 0);
  const motivos = resultados
    .filter((r) => !r.aprovada)
    .map((r) => `${r.slug}: nota ${fmt(r.nota)} abaixo do corte ${fmt(r.corte as number)}`);

  let corteTotal: number | null = null;
  if (corteConjunto) {
    const nItens = provas.reduce((s, p) => s + p.respostas.length, 0);
    const np = provas.reduce((s, p) => s + (p.np ?? 0), 0);
    const maxima = provas.reduce((s, p) => s + pontuacaoMaxima(p.regra, p.respostas.length, p.np ?? 0), 0);
    corteTotal = valorCorte(corteConjunto, { nItens, np, pontuacaoMaxima: maxima });
    if (total < corteTotal) motivos.push(`conjunto: nota ${fmt(total)} abaixo do corte ${fmt(corteTotal)}`);
  }

  return { provas: resultados, total, corteConjunto: corteTotal, aprovado: motivos.length === 0, motivos };
}

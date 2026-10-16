import type { MotivoZero } from "./tipos";

// Duas notas convergem se diferem em até 25% da nota máxima de conteúdo (edital, 9.7.4.1.2).
export const FRACAO_CONVERGENCIA = 0.25;
const EPS = 1e-9;

export type ResultadoConteudo =
  | { precisaTerceira: true }
  | { precisaTerceira: false; nc: number; usadas: [number, number] };

function limitar(nota: number, max: number): number {
  return Math.min(max, Math.max(0, nota));
}

export function convergentes(a: number, b: number, max: number): boolean {
  return Math.abs(a - b) <= FRACAO_CONVERGENCIA * max + EPS;
}

/**
 * NC a partir das notas de conteúdo dos examinadores (9.7.4.1.1 a 9.7.4.1.3).
 * Com duas notas: média se convergem; senão pede terceira correção.
 * Com três: média das duas mais próximas (empate: a dupla de maior média).
 * `usadas` traz os índices das notas que entraram na média.
 */
export function notaConteudo(notas: number[], max: number): ResultadoConteudo {
  const n = notas.map((x) => limitar(x, max));
  if (n.length === 2) {
    if (!convergentes(n[0], n[1], max)) return { precisaTerceira: true };
    return { precisaTerceira: false, nc: (n[0] + n[1]) / 2, usadas: [0, 1] };
  }
  if (n.length === 3) {
    const pares: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    let melhor = pares[0];
    for (const par of pares.slice(1)) {
      const dif = Math.abs(n[par[0]] - n[par[1]]);
      const difMelhor = Math.abs(n[melhor[0]] - n[melhor[1]]);
      const media = n[par[0]] + n[par[1]];
      const mediaMelhor = n[melhor[0]] + n[melhor[1]];
      if (dif < difMelhor - EPS || (Math.abs(dif - difMelhor) <= EPS && media > mediaMelhor + EPS)) melhor = par;
    }
    return { precisaTerceira: false, nc: (n[melhor[0]] + n[melhor[1]]) / 2, usadas: melhor };
  }
  throw new Error(`notaConteudo espera 2 ou 3 notas, recebeu ${n.length}`);
}

export interface EntradaNPD {
  nc: number;
  ne: number;
  tl: number;
  fugaTema: boolean;
}

export interface ResultadoNPD {
  npd: number;
  motivoZero: MotivoZero | null;
}

export function arredondar2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// NPD = NC − 6 × NE ÷ TL, com os zeros da alínea e e f do item 9.7.5.
export function calcularNPD({ nc, ne, tl, fugaTema }: EntradaNPD): ResultadoNPD {
  if (tl <= 0) return { npd: 0, motivoZero: "sem_texto" };
  if (fugaTema) return { npd: 0, motivoZero: "fuga_tema" };
  const bruto = nc - (6 * ne) / tl;
  if (bruto < 0) return { npd: 0, motivoZero: "npd_negativo" };
  return { npd: arredondar2(bruto), motivoZero: null };
}

export function aprovadoDiscursiva(npd: number, notaMinima: number): boolean {
  return npd >= notaMinima;
}

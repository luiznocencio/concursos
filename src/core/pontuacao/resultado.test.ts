import { describe, expect, it } from "vitest";
import { calcularResultado, type EntradaProva } from "./resultado";
import type { RespostaCorrigivel } from "./pontuacao";

const ce = { regra: "certo_errado_penalidade" } as const;

function respostas(certos: number, errados: number, brancos: number): RespostaCorrigivel[] {
  return [
    ...Array.from({ length: certos }, () => ({ marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ marcacao: "C", gabarito: "E" })),
    ...Array.from({ length: brancos }, () => ({ marcacao: null, gabarito: "C" })),
  ];
}

function p1(c: number, e: number, b: number): EntradaProva {
  return { slug: "p1", regra: ce, corte: { regra: "piso_fator", fator: 0.2 }, respostas: respostas(c, e, b) };
}

function p2(c: number, e: number, b: number): EntradaProva {
  return { slug: "p2", regra: ce, corte: { regra: "piso_fator", fator: 0.3 }, respostas: respostas(c, e, b) };
}

const conjunto = { regra: "piso_fator", fator: 0.3 } as const;

describe("calcularResultado (CBM-AL)", () => {
  it("aprova quem passa em M1, M2 e M3", () => {
    const r = calcularResultado([p1(30, 10, 10), p2(40, 10, 20)], conjunto);
    expect(r.provas[0]).toEqual({ slug: "p1", nota: 20, corte: 10, aprovada: true, certos: 30, errados: 10, brancos: 10 });
    expect(r.provas[1]).toMatchObject({ nota: 30, corte: 21, aprovada: true });
    expect(r.total).toBe(50);
    expect(r.corteConjunto).toBe(36);
    expect(r.aprovado).toBe(true);
    expect(r.motivos).toEqual([]);
  });

  it("elimina por M1 mesmo com total alto", () => {
    const r = calcularResultado([p1(20, 11, 19), p2(60, 0, 10)], conjunto);
    expect(r.aprovado).toBe(false);
    expect(r.motivos).toEqual(["p1: nota 9 abaixo do corte 10"]);
  });

  it("elimina por M3 mesmo passando em M1 e M2", () => {
    // P1 = 12 (≥ 10), P2 = 22 (≥ 21), total 34 < 36
    const r = calcularResultado([p1(31, 19, 0), p2(46, 24, 0)], conjunto);
    expect(r.provas.every((p) => p.aprovada)).toBe(true);
    expect(r.aprovado).toBe(false);
    expect(r.motivos).toEqual(["conjunto: nota 34 abaixo do corte 36"]);
  });

  it("sem regras de corte, aprova sempre", () => {
    const r = calcularResultado([{ slug: "x", regra: ce, respostas: respostas(1, 5, 0) }]);
    expect(r.provas[0].corte).toBeNull();
    expect(r.corteConjunto).toBeNull();
    expect(r.aprovado).toBe(true);
  });
});

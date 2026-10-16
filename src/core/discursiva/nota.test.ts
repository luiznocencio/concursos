import { describe, expect, it } from "vitest";
import { aprovadoDiscursiva, calcularNPD, convergentes, notaConteudo } from "./nota";

describe("convergentes", () => {
  it("aceita diferença de exatamente 25% da nota máxima", () => {
    expect(convergentes(20, 27.5, 30)).toBe(true);
    expect(convergentes(20, 27.51, 30)).toBe(false);
  });
});

describe("notaConteudo", () => {
  it("duas notas convergentes: média", () => {
    expect(notaConteudo([20, 24], 30)).toEqual({ precisaTerceira: false, nc: 22, usadas: [0, 1] });
  });

  it("duas notas divergentes: pede terceira correção", () => {
    expect(notaConteudo([10, 25], 30)).toEqual({ precisaTerceira: true });
  });

  it("três notas: média das duas mais próximas", () => {
    expect(notaConteudo([10, 25, 22], 30)).toEqual({ precisaTerceira: false, nc: 23.5, usadas: [1, 2] });
  });

  it("três notas com empate de distância: fica a dupla de maior média", () => {
    // |10−16| = 6 e |16−22| = 6: vence (16 + 22) / 2 = 19
    expect(notaConteudo([10, 22, 16], 30)).toEqual({ precisaTerceira: false, nc: 19, usadas: [1, 2] });
  });

  it("limita cada nota entre 0 e a nota máxima", () => {
    expect(notaConteudo([31, 29], 30)).toEqual({ precisaTerceira: false, nc: 29.5, usadas: [0, 1] });
    expect(notaConteudo([-2, 3], 30)).toEqual({ precisaTerceira: false, nc: 1.5, usadas: [0, 1] });
  });

  it("recusa quantidade de notas diferente de 2 ou 3", () => {
    expect(() => notaConteudo([20], 30)).toThrow(/2 ou 3/);
  });
});

describe("calcularNPD", () => {
  it("aplica NPD = NC − 6 × NE ÷ TL com duas casas", () => {
    // 21,5 − 6 × 4 ÷ 26 = 20,5769…
    expect(calcularNPD({ nc: 21.5, ne: 4, tl: 26, fugaTema: false })).toEqual({ npd: 20.58, motivoZero: null });
  });

  it("sem erros, NPD = NC", () => {
    expect(calcularNPD({ nc: 18, ne: 0, tl: 30, fugaTema: false })).toEqual({ npd: 18, motivoZero: null });
  });

  it("NPD negativo vira zero", () => {
    expect(calcularNPD({ nc: 3, ne: 20, tl: 20, fugaTema: false })).toEqual({ npd: 0, motivoZero: "npd_negativo" });
  });

  it("fuga ao tema zera", () => {
    expect(calcularNPD({ nc: 25, ne: 0, tl: 30, fugaTema: true })).toEqual({ npd: 0, motivoZero: "fuga_tema" });
  });

  it("sem texto zera, mesmo com fuga ao tema", () => {
    expect(calcularNPD({ nc: 0, ne: 0, tl: 0, fugaTema: true })).toEqual({ npd: 0, motivoZero: "sem_texto" });
  });
});

describe("aprovadoDiscursiva", () => {
  it("aprova com NPD igual ou acima do mínimo", () => {
    expect(aprovadoDiscursiva(15, 15)).toBe(true);
    expect(aprovadoDiscursiva(14.99, 15)).toBe(false);
  });
});

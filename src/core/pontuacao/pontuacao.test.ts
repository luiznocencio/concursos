import { describe, expect, it } from "vitest";
import { notaProva, pontuacaoMaxima, situacao, valorAcerto, valorErro, type RespostaCorrigivel } from "./pontuacao";

const ce = { regra: "certo_errado_penalidade" } as const;
const me = { regra: "multipla_escolha", peso: 2, penalidade: 0 } as const;

function respostas(certos: number, errados: number, brancos: number): RespostaCorrigivel[] {
  return [
    ...Array.from({ length: certos }, () => ({ marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ marcacao: "E", gabarito: "C" })),
    ...Array.from({ length: brancos }, () => ({ marcacao: null, gabarito: "C" })),
  ];
}

describe("situacao", () => {
  it("classifica certo, errado e branco", () => {
    expect(situacao({ marcacao: "C", gabarito: "C" })).toBe("certo");
    expect(situacao({ marcacao: "E", gabarito: "C" })).toBe("errado");
    expect(situacao({ marcacao: null, gabarito: "C" })).toBe("branco");
  });
});

describe("Cebraspe certo/errado (edital 8.11.2)", () => {
  it("vale 1 ponto por item quando np = 0", () => {
    expect(valorAcerto(ce, 50)).toBe(1);
    expect(valorErro(ce, 50)).toBe(-1);
  });

  it("vale N/(N − np) quando há gabaritos alterados", () => {
    expect(valorAcerto(ce, 50, 2)).toBeCloseTo(50 / 48, 10);
    expect(valorErro(ce, 70, 7)).toBeCloseTo(-70 / 63, 10);
  });

  it("um errado anula um certo", () => {
    expect(notaProva(ce, respostas(30, 15, 5))).toBe(15);
  });

  it("nota pode ser negativa", () => {
    expect(notaProva(ce, respostas(2, 5, 3))).toBe(-3);
  });

  it("recusa np >= nº de itens", () => {
    expect(() => valorAcerto(ce, 10, 10)).toThrow("np deve ser menor que o número de itens");
  });

  it("pontuação máxima = nº de itens × valor do acerto", () => {
    expect(pontuacaoMaxima(ce, 70)).toBe(70);
  });
});

describe("múltipla escolha", () => {
  it("soma o peso dos acertos e não penaliza erros por padrão", () => {
    const rs = [
      { marcacao: "A", gabarito: "A" },
      { marcacao: "B", gabarito: "A" },
      { marcacao: null, gabarito: "C" },
    ];
    expect(notaProva(me, rs)).toBe(2);
    expect(valorErro(me, 3)).toBe(0);
  });

  it("aplica penalidade configurada", () => {
    const comPenalidade = { regra: "multipla_escolha", peso: 1, penalidade: 0.25 } as const;
    const rs = [
      { marcacao: "A", gabarito: "A" },
      { marcacao: "B", gabarito: "A" },
    ];
    expect(notaProva(comPenalidade, rs)).toBe(0.75);
  });
});

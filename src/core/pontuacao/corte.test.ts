import { describe, expect, it } from "vitest";
import { valorCorte } from "./corte";

describe("valorCorte", () => {
  it("reproduz M1, M2 e M3 do CBM-AL com np = 0", () => {
    expect(valorCorte({ regra: "piso_fator", fator: 0.2 }, { nItens: 50, pontuacaoMaxima: 50 })).toBe(10);
    expect(valorCorte({ regra: "piso_fator", fator: 0.3 }, { nItens: 70, pontuacaoMaxima: 70 })).toBe(21);
    expect(valorCorte({ regra: "piso_fator", fator: 0.3 }, { nItens: 120, pontuacaoMaxima: 120 })).toBe(36);
  });

  it("desconta itens alterados antes do piso", () => {
    // ⌊(50 − 3) × 0,2⌋ = ⌊9,4⌋ = 9
    expect(valorCorte({ regra: "piso_fator", fator: 0.2 }, { nItens: 50, np: 3, pontuacaoMaxima: 50 })).toBe(9);
  });

  it("não sofre com erro de ponto flutuante (100 × 0,29 = 28,999…)", () => {
    expect(valorCorte({ regra: "piso_fator", fator: 0.29 }, { nItens: 100, pontuacaoMaxima: 100 })).toBe(29);
  });

  it("aplica mínimo percentual sobre a pontuação máxima", () => {
    expect(valorCorte({ regra: "minimo_percentual", percentual: 0.5 }, { nItens: 60, pontuacaoMaxima: 120 })).toBe(60);
  });

  it("aplica mínimo absoluto", () => {
    expect(valorCorte({ regra: "minimo_absoluto", valor: 15 }, { nItens: 1, pontuacaoMaxima: 30 })).toBe(15);
  });
});

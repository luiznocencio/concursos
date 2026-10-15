import { describe, expect, it } from "vitest";
import { itensReaisVisiveis } from "./itens-reais";

describe("itensReaisVisiveis", () => {
  it("é verdadeiro por padrão e com valores afirmativos", () => {
    expect(itensReaisVisiveis({})).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "" })).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "true" })).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "1" })).toBe(true);
  });

  it("desliga com false, 0, não ou off, em qualquer caixa", () => {
    for (const v of ["false", "FALSE", " 0 ", "nao", "Não", "off"]) {
      expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: v })).toBe(false);
    }
  });
});

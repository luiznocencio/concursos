import { describe, expect, it } from "vitest";
import { contarTL, distribuirEmLinhas } from "./linhas";

describe("distribuirEmLinhas", () => {
  it("quebra por palavra sem passar do limite", () => {
    expect(distribuirEmLinhas("aa bb cc dd", 5, 30)).toEqual({ linhas: ["aa bb", "cc dd"], excedente: [] });
  });

  it("junta espaços repetidos", () => {
    expect(distribuirEmLinhas("aa    bb", 10, 30).linhas).toEqual(["aa bb"]);
  });

  it("cada parágrafo começa em linha nova e linhas em branco são mantidas", () => {
    expect(distribuirEmLinhas("aa\n\nbb cc", 10, 30).linhas).toEqual(["aa", "", "bb cc"]);
  });

  it("aceita quebras de linha do Windows", () => {
    expect(distribuirEmLinhas("aa\r\nbb", 10, 30).linhas).toEqual(["aa", "bb"]);
  });

  it("corta palavra maior que a linha", () => {
    expect(distribuirEmLinhas("x abcdefghij y", 4, 30).linhas).toEqual(["x", "abcd", "efgh", "ij y"]);
  });

  it("ignora linhas em branco no fim", () => {
    expect(distribuirEmLinhas("aa\n\n\n", 10, 30).linhas).toEqual(["aa"]);
  });

  it("texto vazio não tem linhas", () => {
    expect(distribuirEmLinhas("   ", 10, 30)).toEqual({ linhas: [], excedente: [] });
  });

  it("o que passa do máximo de linhas vai para o excedente", () => {
    expect(distribuirEmLinhas("a b c d", 1, 3)).toEqual({ linhas: ["a", "b", "c"], excedente: ["d"] });
  });
});

describe("contarTL", () => {
  it("conta só as linhas com texto", () => {
    expect(contarTL(["aa", "", "  ", "bb"])).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import { hashNormalizado, normalizarTexto } from "./hash";

describe("normalizarTexto", () => {
  it("ignora acentos, caixa, pontuação e espaços", () => {
    expect(normalizarTexto("  A crase é OBRIGATÓRIA, nesse caso!  ")).toBe("a crase e obrigatoria nesse caso");
  });
});

describe("hashNormalizado", () => {
  it("é igual para variações irrelevantes do mesmo item", () => {
    expect(hashNormalizado("A crase é obrigatória.", null)).toBe(hashNormalizado("a crase e obrigatoria", null));
  });

  it("diferencia o mesmo enunciado em textos-base diferentes", () => {
    expect(hashNormalizado("O texto é narrativo.", "Texto A")).not.toBe(hashNormalizado("O texto é narrativo.", "Texto B"));
  });
});

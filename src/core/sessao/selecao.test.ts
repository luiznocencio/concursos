import { describe, expect, it } from "vitest";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

const item = (id: string, canonico: string, visto = false, textoBaseId: string | null = null): ItemCandidato => ({
  id, canonicos: [canonico], visto, textoBaseId,
});

describe("escolherDoTopico", () => {
  const itens = [item("a", "t/x", true), item("b", "t/x"), item("c", "t/y"), item("d", "t/x")];

  it("prefere itens não vistos e respeita o limite", () => {
    expect(escolherDoTopico("t/x", itens, new Set(), 2)).toEqual(["b", "d"]);
    expect(escolherDoTopico("t/x", itens, new Set(), 5)).toEqual(["b", "d", "a"]);
  });

  it("ignora itens já usados", () => {
    expect(escolherDoTopico("t/x", itens, new Set(["b"]), 5)).toEqual(["d", "a"]);
  });
});

describe("agruparPorTextoBase", () => {
  it("mantém itens do mesmo texto-base juntos, na ordem da primeira ocorrência", () => {
    const itens = [item("1", "t", false, "tb1"), item("2", "t"), item("3", "t", false, "tb1"), item("4", "t", false, "tb2")];
    expect(agruparPorTextoBase(["1", "2", "3", "4"], itens)).toEqual(["1", "3", "2", "4"]);
  });
});

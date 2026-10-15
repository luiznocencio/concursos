import { describe, expect, it } from "vitest";
import { filtrarCandidatos } from "./estudo";

const linhas = [
  { id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false, origem: "ia" as const },
  { id: "b", textoBaseId: "t1", canonicos: ["portugues/crase"], visto: true, origem: "real" as const },
];

describe("filtrarCandidatos", () => {
  it("mantém os itens reais no uso pessoal, sem expor a origem", () => {
    expect(filtrarCandidatos(linhas, true)).toEqual([
      { id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false },
      { id: "b", textoBaseId: "t1", canonicos: ["portugues/crase"], visto: true },
    ]);
  });

  it("tira os itens reais das sessões em modo produto", () => {
    expect(filtrarCandidatos(linhas, false)).toEqual([{ id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false }]);
  });
});

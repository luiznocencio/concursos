import { describe, expect, it } from "vitest";
import { parseManifestoFontes } from "./manifesto";

const valido = `
fontes:
  - slug: lei-5346-1992
    tipo: lei
    titulo: Lei Estadual nº 5.346/1992
    arquivo: lei-5346-1992.txt
    canonicos: [legislacao-cbmal/lei-5346-1992-estatuto]
`;

describe("parseManifestoFontes", () => {
  it("aceita um manifesto válido e preenche url_oficial nula", () => {
    expect(parseManifestoFontes(valido).fontes[0]).toMatchObject({ slug: "lei-5346-1992", url_oficial: null });
  });

  it("aponta o campo inválido", () => {
    expect(() => parseManifestoFontes(valido.replace("lei-5346-1992.txt", "lei.pdf"))).toThrow(
      "fontes.0.arquivo: arquivo deve ser um .txt na pasta fontes/",
    );
  });
});

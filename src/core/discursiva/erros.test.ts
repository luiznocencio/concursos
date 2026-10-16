import { describe, expect, it } from "vitest";
import { CANONICO_POR_CATEGORIA, filtrarErrosValidos, ROTULO_CATEGORIA } from "./erros";
import { CATEGORIAS_ERRO, type ErroLingua } from "./tipos";

function erro(linha: number, trecho: string, categoria: ErroLingua["categoria"] = "crase"): ErroLingua {
  return { linha, trecho, tipo: "morfossintaxe", categoria, correcao: "x", explicacao: "y" };
}

const linhas = ["Os bombeiros chegou cedo", "", "e foram a festa"];

describe("filtrarErrosValidos", () => {
  it("mantém erro cujo trecho está na linha, ignorando caixa e espaços", () => {
    const r = filtrarErrosValidos([erro(1, "bombeiros  CHEGOU")], linhas);
    expect(r.validos).toHaveLength(1);
    expect(r.descartados).toBe(0);
  });

  it("descarta linha inexistente, linha em branco e linha fracionária", () => {
    const r = filtrarErrosValidos([erro(0, "Os"), erro(4, "Os"), erro(2, "Os"), erro(1.5, "Os")], linhas);
    expect(r.validos).toEqual([]);
    expect(r.descartados).toBe(4);
  });

  it("descarta trecho que não está na linha ou é vazio", () => {
    const r = filtrarErrosValidos([erro(3, "à festa"), erro(3, "  ")], linhas);
    expect(r.validos).toEqual([]);
  });

  it("conta uma vez o mesmo erro repetido", () => {
    const r = filtrarErrosValidos([erro(3, "a festa"), erro(3, "a  festa"), erro(3, "a festa", "regencia")], linhas);
    expect(r.validos).toHaveLength(2);
    expect(r.descartados).toBe(1);
  });
});

describe("mapeamentos de categoria", () => {
  it("toda categoria tem tópico de português e rótulo", () => {
    for (const c of CATEGORIAS_ERRO) {
      expect(CANONICO_POR_CATEGORIA[c]).toMatch(/^portugues\//);
      expect(ROTULO_CATEGORIA[c]).not.toBe("");
    }
  });
});

import { describe, expect, it } from "vitest";
import { lerPadrao, lerTemaReal, lerTextosApoio } from "./tema";

describe("lerTextosApoio", () => {
  it("separa por linha em branco e reconhece título e fonte", () => {
    expect(lerTextosApoio("Texto I\nDados do texto um.\nFonte: Agência X\n\nOutro texto\nsem título.")).toEqual([
      { titulo: "Texto I", texto: "Dados do texto um.", fonte: "Agência X" },
      { titulo: "Texto 2", texto: "Outro texto\nsem título.", fonte: "" },
    ]);
  });

  it("texto vazio não tem blocos", () => {
    expect(lerTextosApoio("  \n\n ")).toEqual([]);
  });
});

describe("lerPadrao", () => {
  it("lê código, descrição e pontos com vírgula", () => {
    expect(lerPadrao("1 | Apresentação | 3\n2.1 | Causas | 13,5")).toEqual({
      aspectos: [
        { codigo: "1", descricao: "Apresentação", pontos: 3 },
        { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
      ],
      erros: [],
    });
  });

  it("aponta a linha mal formada", () => {
    expect(lerPadrao("1 | Apresentação | 3\n2.1 Causas 13,5").erros).toEqual([
      'Linha 2 do padrão de resposta: use "código | descrição | pontos".',
    ]);
  });
});

describe("lerTemaReal", () => {
  const campos = {
    provaOrigem: " CEBRASPE 2021 · CBM-AL ",
    enunciado: " Redija um texto sobre prevenção. ",
    textosApoio: "Texto I\nDados.\nFonte: X",
    padrao: "1 | Apresentação | 3\n2.1 | Causas | 13,5\n2.2 | Propostas | 13,5",
    expectativas: " Espera-se... ",
  };

  it("monta o tema quando tudo confere", () => {
    expect(lerTemaReal(campos, 30)).toEqual({
      ok: true,
      provaOrigem: "CEBRASPE 2021 · CBM-AL",
      tema: {
        enunciado: "Redija um texto sobre prevenção.",
        textos_apoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "X" }],
        padrao_resposta: {
          aspectos: [
            { codigo: "1", descricao: "Apresentação", pontos: 3 },
            { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
            { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
          ],
          expectativas: "Espera-se...",
        },
      },
    });
  });

  it("junta os erros: origem, enunciado, soma e códigos repetidos", () => {
    const r = lerTemaReal({ ...campos, provaOrigem: "", enunciado: "", padrao: "1 | A | 3\n1 | B | 10" }, 30);
    expect(r).toEqual({
      ok: false,
      erros: [
        "Informe a prova de origem (ex.: CEBRASPE 2021 · CBM-AL · Soldado).",
        "Informe o enunciado da proposta.",
        "Há códigos de aspecto repetidos.",
        "Os pontos do padrão somam 13, mas a prova vale 30.",
      ],
    });
  });
});

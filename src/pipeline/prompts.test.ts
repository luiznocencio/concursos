import { describe, expect, it } from "vitest";
import { promptGeracao, promptValidacao } from "./prompts";

const topico = { canonico: "legislacao-cbmal/lei-x", disciplina: "Legislação", programa: "1 Lei X" };
const fonte = { titulo: "Lei X", dispositivos: [{ referencia: "art. 1", texto: "Art. 1º Texto da lei." }] };

describe("promptGeracao", () => {
  it("inclui o guia da banca, o tópico, a quantidade e o trecho legal", () => {
    const p = promptGeracao({ banca: "cebraspe", topico, quantidade: 5, fonte, exemplos: [] });
    expect(p).toContain("CERTA (C) ou ERRADA (E)");
    expect(p).toContain("Tópico do edital: 1 Lei X");
    expect(p).toContain("Escreva 5 itens");
    expect(p).toContain('<fonte titulo="Lei X">\nArt. 1º Texto da lei.\n</fonte>');
    expect(p).toContain("exclusivamente no trecho legal");
  });

  it("inclui exemplos reais quando existem e dispensa fonte em temas conceituais", () => {
    const p = promptGeracao({
      banca: "cebraspe",
      topico: { ...topico, programa: "5.7 Crase" },
      quantidade: 3,
      fonte: null,
      exemplos: [{ enunciado: "Exemplo real.", gabarito: "C" }],
    });
    expect(p).toContain("- (C) Exemplo real.");
    expect(p).not.toContain("<fonte");
  });
});

describe("promptValidacao", () => {
  it("numera os itens a partir de zero e não revela gabaritos", () => {
    const p = promptValidacao({ topico, textoBase: "Caso.", enunciados: ["Primeiro.", "Segundo."], fonte });
    expect(p).toContain("0. Primeiro.\n1. Segundo.");
    expect(p).toContain("Texto-base:\nCaso.");
    expect(p).not.toMatch(/gabarito: [CE]/);
  });
});

import { describe, expect, it } from "vitest";
import { demandasDaProva, provasObjetivasDoCargo, topicosAlvoDoCargo, topicosFolha } from "./consultas";
import { editalMini } from "./__fixtures__/mini";

const e = editalMini();

describe("consultas do edital", () => {
  it("lista as folhas de uma disciplina na ordem do edital", () => {
    expect(topicosFolha(e.disciplinas[0])).toEqual([
      { disciplina: "port", codigo: "1", titulo: "Interpretação", canonico: "portugues/interpretacao" },
      { disciplina: "port", codigo: "2.1", titulo: "Crase", canonico: "portugues/crase" },
      { disciplina: "port", codigo: "2.2", titulo: "Regência", canonico: "portugues/regencia" },
    ]);
  });

  it("lista só as provas objetivas do cargo", () => {
    expect(provasObjetivasDoCargo(e, "cargo-a").map((p) => p.slug)).toEqual(["p1", "p2-a"]);
  });

  it("lança erro para cargo desconhecido", () => {
    expect(() => provasObjetivasDoCargo(e, "x")).toThrow("Cargo desconhecido: x");
  });

  it("calcula o peso = itens da disciplina ÷ nº de folhas", () => {
    const alvos = topicosAlvoDoCargo(e, "cargo-a");
    const peso = Object.fromEntries(alvos.map((t) => [t.chave, t.peso]));
    expect(peso).toEqual({
      "port:1": 2, "port:2.1": 2, "port:2.2": 2,
      "mat:1": 2, "mat:2": 2,
      "fis:1": 10,
    });
  });

  it("monta as demandas de uma prova", () => {
    expect(demandasDaProva(e, "p1")).toEqual([
      { disciplina: "port", canonicos: ["portugues/interpretacao", "portugues/crase", "portugues/regencia"], quantidade: 6 },
      { disciplina: "mat", canonicos: ["matematica/porcentagem", "matematica/juros"], quantidade: 4 },
    ]);
  });

  it("recusa demandas de prova discursiva", () => {
    expect(() => demandasDaProva(e, "disc")).toThrow("Prova objetiva desconhecida: disc");
  });
});

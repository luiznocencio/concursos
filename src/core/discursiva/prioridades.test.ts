import { describe, expect, it } from "vitest";
import { escolherPrioridades, type AspectoAvaliado } from "./prioridades";
import type { ErroLingua } from "./tipos";

function erro(categoria: ErroLingua["categoria"]): ErroLingua {
  return { linha: 1, trecho: "x", tipo: "morfossintaxe", categoria, correcao: "x", explicacao: "y" };
}

const aspectos: AspectoAvaliado[] = [
  { codigo: "1", descricao: "causas do problema", pontos: 10, nota: 9 },
  { codigo: "2", descricao: "propostas", pontos: 10, nota: 2.5 },
  { codigo: "3", descricao: "estrutura", pontos: 10, nota: 10 },
];

describe("escolherPrioridades", () => {
  it("ordena por perda proporcional e frequência de erro", () => {
    const r = escolherPrioridades(aspectos, [erro("crase"), erro("concordancia"), erro("concordancia")]);
    expect(r.map((p) => p.titulo)).toEqual(["Aprofunde: propostas", "Revise concordância", "Revise crase"]);
  });

  it("descreve nota do aspecto e leva o erro ao tópico canônico", () => {
    const [aspecto] = escolherPrioridades(aspectos, [], 1);
    expect(aspecto).toEqual({
      tipo: "aspecto",
      codigo: "2",
      titulo: "Aprofunde: propostas",
      detalhe: "Você fez 2,5 de 10 pontos neste aspecto.",
    });
    const [e] = escolherPrioridades([], [erro("crase")], 1);
    expect(e).toEqual({
      tipo: "erro",
      categoria: "crase",
      canonico: "portugues/crase",
      titulo: "Revise crase",
      detalhe: "1 erro na redação.",
    });
  });

  it("em empate de peso, o erro vem antes do aspecto", () => {
    const zerado: AspectoAvaliado[] = [{ codigo: "1", descricao: "tema", pontos: 10, nota: 0 }];
    const r = escolherPrioridades(zerado, [erro("crase"), erro("crase"), erro("crase")]);
    expect(r.map((p) => p.tipo)).toEqual(["erro", "aspecto"]);
  });

  it("ignora aspectos com nota cheia e devolve no máximo a quantidade pedida", () => {
    expect(escolherPrioridades([aspectos[2]], [])).toEqual([]);
    const muitos = (["crase", "regencia", "pontuacao", "hifen"] as const).map(erro);
    expect(escolherPrioridades([], muitos)).toHaveLength(3);
  });
});

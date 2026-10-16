import { describe, expect, it } from "vitest";
import { consolidarCorrecao, notasPorAspecto, resultadoSemTexto } from "./consolidar";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

const aspectos = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];
const linhas = ["O Brasil precisa investir em prevenção.", "", "Os bombeiros chegou cedo ao local."];

function banca(notas: [number, number, number], fuga = false): CorrecaoConteudo {
  return {
    aspectos: aspectos.map((a, k) => ({ codigo: a.codigo, nota: notas[k], justificativa: "j" })),
    fuga_tema: fuga,
    comentario: "c",
  };
}

const semErros: CorrecaoLingua = { erros: [] };
const umErro: CorrecaoLingua = {
  erros: [
    { linha: 3, trecho: "bombeiros chegou", tipo: "morfossintaxe", categoria: "concordancia", correcao: "bombeiros chegaram", explicacao: "x" },
    { linha: 9, trecho: "inexistente", tipo: "grafia", categoria: "ortografia", correcao: "y", explicacao: "z" },
  ],
};

const base = { aspectos, pontuacaoMaxima: 30, linhas };

describe("notasPorAspecto", () => {
  it("ignora código desconhecido, zera ausente e limita ao máximo do aspecto", () => {
    const c: CorrecaoConteudo = {
      aspectos: [
        { codigo: " 1 ", nota: 5, justificativa: "" },
        { codigo: "9", nota: 10, justificativa: "" },
        { codigo: "2.2", nota: -1, justificativa: "" },
      ],
      fuga_tema: false,
      comentario: "",
    };
    expect(notasPorAspecto(c, aspectos)).toEqual([3, 0, 0]);
  });
});

describe("consolidarCorrecao", () => {
  it("duas notas convergentes: média, erros válidos e NPD", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 10, 8]), banca([2, 12, 9])], lingua: umErro });
    expect(r.precisaTerceira).toBe(false);
    if (r.precisaTerceira) return;
    // NC = (21 + 23) / 2 = 22; NE = 1 (o erro da linha 9 é descartado); TL = 2; NPD = 22 − 6 × 1 ÷ 2 = 19
    expect(r.resultado).toMatchObject({
      nc: 22,
      ne: 1,
      tl: 2,
      npd: 19,
      zeradaMotivo: null,
      terceiraCorrecao: false,
      usadas: [0, 1],
      errosDescartados: 1,
    });
    expect(r.resultado.aspectos.map((a) => a.nota)).toEqual([2.5, 11, 8.5]);
    expect(r.resultado.prioridades[0]).toMatchObject({ tipo: "aspecto", codigo: "2.2" });
  });

  it("notas divergentes pedem terceira correção", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 13, 13]), banca([1, 3, 3])], lingua: semErros });
    expect(r).toEqual({ precisaTerceira: true });
  });

  it("só uma banca apontando fuga ao tema pede terceira correção", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 10, 10], true), banca([3, 10, 10])], lingua: semErros });
    expect(r).toEqual({ precisaTerceira: true });
  });

  it("com a terceira, usa as duas notas mais próximas", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([3, 13, 13]), banca([1, 3, 3]), banca([3, 12, 12])],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ nc: 28, usadas: [0, 2], terceiraCorrecao: true, npd: 28 });
  });

  it("fuga ao tema confirmada pelas duas correções usadas zera a nota", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([1, 2, 2], true), banca([2, 3, 3]), banca([1, 2, 3], true)],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ usadas: [0, 2], npd: 0, zeradaMotivo: "fuga_tema" });
  });

  it("fuga apontada só por uma das correções usadas não zera", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([1, 2, 2], true), banca([3, 13, 13]), banca([1, 2, 3])],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ usadas: [0, 2], zeradaMotivo: null });
  });
});

describe("resultadoSemTexto", () => {
  it("zera tudo com o motivo sem_texto", () => {
    expect(resultadoSemTexto(aspectos)).toMatchObject({ npd: 0, tl: 0, zeradaMotivo: "sem_texto", prioridades: [] });
    expect(resultadoSemTexto(aspectos).aspectos.map((a) => a.nota)).toEqual([0, 0, 0]);
  });
});

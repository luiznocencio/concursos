import { describe, expect, it } from "vitest";
import { hashNormalizado } from "../pipeline/hash";
import { ErroImportacao, importacaoSchema, montarLoteReal, previaSchema, type Importacao } from "./gravacao";

const importacao: Importacao = {
  provaOrigem: " CBM-AL 2021 Soldado ",
  grupos: [
    {
      textoBase: "Texto CB1A1-I\n\nJulgue os itens.",
      itens: [
        { numero: 1, enunciado: "Primeiro item.", gabarito: "C", canonicos: ["portugues/crase"] },
        { numero: 2, enunciado: "Segundo item.", gabarito: "E", canonicos: ["portugues/crase", "portugues/crase"] },
      ],
    },
    { textoBase: "  ", itens: [{ numero: 3, enunciado: "Terceiro item.", gabarito: "C", canonicos: ["portugues/regencia"] }] },
  ],
};
const permitidos = new Set(["portugues/crase", "portugues/regencia"]);

describe("montarLoteReal", () => {
  it("monta o lote da função SQL com o hash normalizado do pipeline", () => {
    const lote = montarLoteReal({ banca: "cebraspe", importadoPor: "ana@x.com", importacao, canonicosPermitidos: permitidos });
    expect(lote).toEqual({
      banca: "cebraspe",
      prova_origem: "CBM-AL 2021 Soldado",
      importado_por: "ana@x.com",
      grupos: [
        {
          texto_base: "Texto CB1A1-I\n\nJulgue os itens.",
          itens: [
            { numero: 1, enunciado: "Primeiro item.", gabarito: "C", hash: hashNormalizado("Primeiro item.", "Texto CB1A1-I\n\nJulgue os itens."), canonicos: ["portugues/crase"] },
            { numero: 2, enunciado: "Segundo item.", gabarito: "E", hash: hashNormalizado("Segundo item.", "Texto CB1A1-I\n\nJulgue os itens."), canonicos: ["portugues/crase"] },
          ],
        },
        {
          texto_base: null,
          itens: [{ numero: 3, enunciado: "Terceiro item.", gabarito: "C", hash: hashNormalizado("Terceiro item.", null), canonicos: ["portugues/regencia"] }],
        },
      ],
    });
  });

  it("recusa item sem tópico e tópico fora do concurso", () => {
    const semTopico = structuredClone(importacao);
    semTopico.grupos[0].itens[1].canonicos = [];
    expect(() => montarLoteReal({ banca: "cebraspe", importadoPor: "a", importacao: semTopico, canonicosPermitidos: permitidos })).toThrow(
      new ErroImportacao("Escolha ao menos um tópico para os itens 2."),
    );
    expect(() =>
      montarLoteReal({ banca: "cebraspe", importadoPor: "a", importacao, canonicosPermitidos: new Set(["portugues/crase"]) }),
    ).toThrow("Tópicos fora do edital: portugues/regencia.");
  });
});

describe("importacaoSchema", () => {
  it("aceita a importação da tela e recusa prova de origem curta ou gabarito anulado", () => {
    expect(importacaoSchema.safeParse(importacao).success).toBe(true);
    expect(importacaoSchema.safeParse({ ...importacao, provaOrigem: "x" }).success).toBe(false);
    const anulado = structuredClone(importacao) as unknown as { grupos: { itens: { gabarito: string }[] }[] };
    anulado.grupos[0].itens[0].gabarito = "X";
    expect(importacaoSchema.safeParse(anulado).success).toBe(false);
  });
});

describe("previaSchema", () => {
  it("aceita os grupos da prévia sem tópicos e recusa grupo vazio", () => {
    const grupos = importacao.grupos.map((g) => ({ ...g, itens: g.itens.map(({ numero, enunciado, gabarito }) => ({ numero, enunciado, gabarito })) }));
    expect(previaSchema.safeParse(grupos).success).toBe(true);
    expect(previaSchema.safeParse([{ textoBase: null, itens: [] }]).success).toBe(false);
  });
});

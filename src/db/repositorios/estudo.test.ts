import { describe, expect, it } from "vitest";
import { filtrarCandidatos, itensDaSessao, provaOrigemVisivel, type Cliente } from "./estudo";

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

describe("provaOrigemVisivel", () => {
  it("mostra a prova só nas questões reais", () => {
    expect(provaOrigemVisivel("real", "CEBRASPE 2021 · PC-AL · Agente")).toBe("CEBRASPE 2021 · PC-AL · Agente");
    expect(provaOrigemVisivel("ia", "CEBRASPE 2021 · PC-AL · Agente")).toBeNull();
    expect(provaOrigemVisivel("real", null)).toBeNull();
    expect(provaOrigemVisivel("real", "  ")).toBeNull();
  });
});

// Cliente mínimo: cada consulta encadeada resolve com as linhas da tabela pedida.
function clienteFalso(tabelas: Record<string, unknown[]>): Cliente {
  return {
    from(tabela: string) {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        then: (ok: (r: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: tabelas[tabela], error: null }).then(ok),
      };
      return consulta;
    },
  } as unknown as Cliente;
}

describe("itensDaSessao", () => {
  const item = (id: string, origem: string, prova_origem: string | null) => ({
    id,
    enunciado: `enunciado ${id}`,
    gabarito: "C",
    justificativa: "porque sim",
    citacao: null,
    origem,
    prova_origem,
    fontes: null,
    textos_base: null,
    item_topicos: [],
  });
  const db = clienteFalso({
    simulado_itens: [
      { ordem: 0, itens: item("real", "real", "CEBRASPE 2021 · PC-AL") },
      { ordem: 1, itens: item("ia", "ia", null) },
    ],
    respostas: [{ item_id: "real", resposta: "C", duvida: false }],
  });

  it("manda a prova de origem junto com a correção, só nas questões reais", async () => {
    const itens = await itensDaSessao(db, "s1", () => true);
    expect(itens.map((i) => i.correcao?.provaOrigem)).toEqual(["CEBRASPE 2021 · PC-AL", null]);
  });

  it("não manda a origem enquanto a correção não pode ser vista (simulado em andamento)", async () => {
    const itens = await itensDaSessao(db, "s1", () => false);
    expect(itens.map((i) => i.correcao)).toEqual([null, null]);
    expect(JSON.stringify(itens)).not.toContain("CEBRASPE");
  });
});

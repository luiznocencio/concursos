import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../ai/falso";
import { ErroIa, type UsoIa } from "../ai/tipos";
import type { GrupoPrevia } from "./previa";
import { ITENS_POR_CHAMADA, lotesDeSugestao, opcoesDeTopicos, promptTopicos, sistemaTopicos, sugerirTopicos } from "./topicos";

const opcoes = opcoesDeTopicos([
  { canonico: "portugues/crase", titulo: "Crase", disciplina: "Língua Portuguesa" },
  { canonico: "informatica/windows", titulo: "Windows 10", disciplina: "Informática" },
  { canonico: "portugues/crase", titulo: "Crase (P2)", disciplina: "Português" },
  { canonico: "portugues/concordancia", titulo: "Concordância", disciplina: "Língua Portuguesa" },
]);

const grupos: GrupoPrevia[] = [
  {
    textoBase: "Texto CB1A1-I\n\nO incêndio começou às 3 h.",
    itens: [
      { numero: 1, enunciado: "O acento grave em \"às 3 h\" é obrigatório.", gabarito: "C" },
      { numero: 2, enunciado: "A forma verbal \"começou\" concorda com \"incêndio\".", gabarito: "C" },
    ],
  },
  { textoBase: null, itens: [{ numero: 3, enunciado: "No Windows 10, Ctrl + Z desfaz a última ação.", gabarito: "C" }] },
];

function registro() {
  const usos: UsoIa[] = [];
  return { usos, registrarUso: async (u: UsoIa) => void usos.push(u) };
}

describe("opcoesDeTopicos", () => {
  it("deixa um canônico por linha, na primeira disciplina, ordenado por disciplina e título", () => {
    expect(opcoes).toEqual([
      { canonico: "informatica/windows", titulo: "Windows 10", disciplina: "Informática" },
      { canonico: "portugues/concordancia", titulo: "Concordância", disciplina: "Língua Portuguesa" },
      { canonico: "portugues/crase", titulo: "Crase", disciplina: "Língua Portuguesa" },
    ]);
  });
});

describe("prompts", () => {
  it("lista os canônicos no sistema e manda itens com o texto-base", () => {
    expect(sistemaTopicos(opcoes)).toContain("portugues/crase | Língua Portuguesa | Crase");
    const p = promptTopicos(grupos);
    expect(p).toContain("<texto_base>\nTexto CB1A1-I\n\nO incêndio começou às 3 h.\n</texto_base>\n1. O acento grave");
    expect(p).toContain("3. No Windows 10");
  });

  it("corta textos-base longos", () => {
    const p = promptTopicos([{ textoBase: "a".repeat(2_000), itens: [{ numero: 1, enunciado: "x", gabarito: "C" }] }]);
    expect(p).toContain(`${"a".repeat(1_500)}...`);
    expect(p).not.toContain("a".repeat(1_501));
  });
});

describe("lotesDeSugestao", () => {
  it("agrupa até o limite por chamada sem separar item do texto-base", () => {
    const item = (numero: number) => ({ numero, enunciado: `Item ${numero}`, gabarito: "C" as const });
    const grande: GrupoPrevia = { textoBase: "T", itens: Array.from({ length: 30 }, (_, k) => item(k + 1)) };
    const pequeno: GrupoPrevia = { textoBase: "U", itens: [item(31), item(32)] };
    const lotes = lotesDeSugestao([grande, pequeno]);
    expect(lotes.map((l) => l.map((g) => `${g.textoBase}:${g.itens.length}`))).toEqual([["T:25"], ["T:5", "U:2"]]);
    expect(lotes.flat().every((g) => g.itens.length <= ITENS_POR_CHAMADA)).toBe(true);
  });
});

describe("sugerirTopicos", () => {
  it("devolve os tópicos por item, filtrando os que não estão na lista, e registra o uso", async () => {
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [
      {
        sugestoes: [
          { numero: 1, canonicos: ["portugues/crase", "portugues/crase", "historia/inventado"] },
          { numero: 2, canonicos: ["portugues/concordancia", "portugues/crase", "informatica/windows"] },
          { numero: 99, canonicos: ["portugues/crase"] },
        ],
      },
    ]);
    const r = registro();
    const resultado = await sugerirTopicos({ provedor, registrarUso: r.registrarUso }, { grupos, opcoes });
    expect(resultado.porItem).toEqual({
      1: ["portugues/crase"],
      2: ["portugues/concordancia", "portugues/crase"],
      3: [],
    });
    expect(resultado.custoUsd).toBeCloseTo(0.01);
    expect(r.usos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ finalidade: "sugerir_topicos", nomeSchema: "sugestoes_topicos" });
  });

  it("faz uma chamada por lote", async () => {
    const muitos: GrupoPrevia[] = [
      { textoBase: null, itens: Array.from({ length: 30 }, (_, k) => ({ numero: k + 1, enunciado: `Item ${k + 1}`, gabarito: "E" as const })) },
    ];
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [
      { sugestoes: [{ numero: 1, canonicos: ["portugues/crase"] }] },
      { sugestoes: [{ numero: 30, canonicos: ["informatica/windows"] }] },
    ]);
    const r = await sugerirTopicos({ provedor, registrarUso: registro().registrarUso }, { grupos: muitos, opcoes });
    expect(pedidos).toHaveLength(2);
    expect(r.porItem[1]).toEqual(["portugues/crase"]);
    expect(r.porItem[30]).toEqual(["informatica/windows"]);
    expect(r.porItem[15]).toEqual([]);
  });

  it("registra o uso cobrado de uma chamada que falhou e repassa o erro", async () => {
    const uso: UsoIa = { provedor: "anthropic", modelo: "m", tokensEntrada: 1, tokensSaida: 1, custoUsd: 0.02 };
    const { provedor } = criarProvedorFalso("anthropic", [new ErroIa("anthropic", "recusa", "recusou", uso)]);
    const r = registro();
    await expect(sugerirTopicos({ provedor, registrarUso: r.registrarUso }, { grupos, opcoes })).rejects.toThrow("recusou");
    expect(r.usos).toEqual([uso]);
  });
});

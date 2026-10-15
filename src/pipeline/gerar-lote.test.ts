import { describe, expect, it } from "vitest";
import { criarProvedorFalso, type RespostaFalsa } from "../ai/falso";
import { ErroIa, type UsoIa } from "../ai/tipos";
import { gerarLote, type EntradaLote, type LoteParaGravar, type RepositorioPipeline } from "./gerar-lote";
import { hashNormalizado } from "./hash";

function repoFalso(hashes: string[] = []) {
  const lotes: LoteParaGravar[] = [];
  const usos: { uso: UsoIa; finalidade: string; jobId: string | null }[] = [];
  const repo: RepositorioPipeline = {
    async hashesExistentes(lista) {
      return new Set(lista.filter((h) => hashes.includes(h)));
    },
    async exemplosReais() {
      return [];
    },
    async registrarLote(lote) {
      lotes.push(lote);
      return lote.itens.length;
    },
    async registrarUso(uso, finalidade, jobId) {
      usos.push({ uso, finalidade, jobId });
    },
  };
  return { repo, lotes, usos };
}

const item = (enunciado: string, gabarito: "C" | "E", extra: Partial<{ dificuldade: number }> = {}) => ({
  enunciado,
  gabarito,
  justificativa: `Por que ${enunciado}`,
  citacao: null,
  dificuldade: extra.dificuldade ?? 2,
});
const lote = (...itens: ReturnType<typeof item>[]) => ({ texto_base: null, itens });
const julgamentos = (...gabaritos: ("C" | "E")[]) => ({
  julgamentos: gabaritos.map((g, indice) => ({ indice, gabarito: g, justificativa: `j${indice}` })),
});

const entrada: EntradaLote = {
  banca: "cebraspe",
  topico: { canonico: "portugues/crase", disciplina: "Língua Portuguesa", programa: "5.7 Crase" },
  quantidade: 3,
  rodada: 0,
  fonte: null,
};

function cenario(anthropic: RespostaFalsa[], openai: RespostaFalsa[], hashes: string[] = []) {
  const a = criarProvedorFalso("anthropic", anthropic);
  const o = criarProvedorFalso("openai", openai);
  const r = repoFalso(hashes);
  return { a, o, r, deps: { provedores: [a.provedor, o.provedor] as [typeof a.provedor, typeof o.provedor], repo: r.repo, jobId: "job-1" } };
}

describe("gerarLote", () => {
  it("aprova os itens em que o validador concorda e registra o uso das duas chamadas", async () => {
    const c = cenario([lote(item("A", "C"), item("B", "E"))], [julgamentos("C", "E")]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerados: 2, duplicados: 0, aprovados: 2, revisao: 0, gravados: 2, gerador: "anthropic", validador: "openai" });
    expect(resumo.custoUsd).toBeCloseTo(0.02, 10);
    expect(c.r.usos.map((u) => [u.finalidade, u.uso.provedor, u.jobId])).toEqual([
      ["gerar_itens", "anthropic", "job-1"],
      ["validar_itens", "openai", "job-1"],
    ]);
    const gravado = c.r.lotes[0].itens[0];
    expect(gravado).toMatchObject({ status: "aprovado", canonicos: ["portugues/crase"], hash: hashNormalizado("A", null) });
    expect(gravado.validacao).toMatchObject({ concordancia: true, mesmo_provedor: false, gabarito_validador: "C" });
  });

  it("não mostra o gabarito ao validador", async () => {
    const c = cenario([lote(item("A", "C"))], [julgamentos("C")]);
    await gerarLote(c.deps, entrada);
    expect(c.o.pedidos[0].prompt).not.toContain("Por que A");
    expect(c.o.pedidos[0].prompt).toContain("0. A");
  });

  it("alterna o gerador conforme a rodada", async () => {
    const c = cenario([julgamentos("C")], [lote(item("A", "C"))]);
    const resumo = await gerarLote(c.deps, { ...entrada, rodada: 1 });
    expect(resumo).toMatchObject({ gerador: "openai", validador: "anthropic", aprovados: 1 });
  });

  it("manda para revisão os itens com discordância ou sem julgamento", async () => {
    const c = cenario([lote(item("A", "C"), item("B", "E"), item("C", "C"))], [{ julgamentos: [{ indice: 0, gabarito: "E", justificativa: "x" }, { indice: 1, gabarito: "E", justificativa: "y" }] }]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ aprovados: 1, revisao: 2 });
    expect(c.r.lotes[0].itens.map((i) => i.status)).toEqual(["revisao", "aprovado", "revisao"]);
    expect(c.r.lotes[0].itens[2].validacao.gabarito_validador).toBeNull();
  });

  it("descarta duplicados já gravados ou repetidos no lote e só valida os novos", async () => {
    const c = cenario([lote(item("A", "C"), item("a!", "C"), item("B", "E"))], [julgamentos("E")], [hashNormalizado("B", null)]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerados: 3, duplicados: 2, gravados: 1 });
    expect(c.o.pedidos[0].prompt).toContain("0. A");
    expect(c.o.pedidos[0].prompt).not.toContain("B");
  });

  it("não chama o validador quando todos os itens são duplicados", async () => {
    const c = cenario([lote(item("A", "C"))], [], [hashNormalizado("A", null)]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gravados: 0, validador: null });
    expect(c.o.pedidos).toHaveLength(0);
    expect(c.r.lotes).toHaveLength(0);
  });

  it("usa o outro provedor quando o gerador falha", async () => {
    const c = cenario([new ErroIa("anthropic", "api", "fora do ar"), julgamentos("C")], [lote(item("A", "C"))]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerador: "openai", validador: "anthropic", aprovados: 1 });
  });

  it("valida com o mesmo provedor quando o outro falha, mas manda tudo para revisão", async () => {
    const c = cenario([lote(item("A", "C")), julgamentos("C")], [new ErroIa("openai", "api", "limite")]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerador: "anthropic", validador: "anthropic", aprovados: 0, revisao: 1 });
    expect(c.r.lotes[0].itens[0].validacao.mesmo_provedor).toBe(true);
  });

  it("falha quando os dois provedores falham, registrando o uso cobrado", async () => {
    const uso: UsoIa = { provedor: "anthropic", modelo: "m", tokensEntrada: 1, tokensSaida: 1, custoUsd: 0.5 };
    const c = cenario([new ErroIa("anthropic", "recusa", "recusou", uso)], [new ErroIa("openai", "saida_invalida", "json")]);
    await expect(gerarLote(c.deps, entrada)).rejects.toThrow(/gerar_itens falhou em todos os provedores/);
    expect(c.r.usos).toHaveLength(1);
  });

  it("exige fonte legal para tópicos de legislação", async () => {
    const c = cenario([], []);
    await expect(
      gerarLote(c.deps, { ...entrada, topico: { ...entrada.topico, canonico: "legislacao-cbmal/lei-x" } }),
    ).rejects.toThrow("Fonte legal ausente para legislacao-cbmal/lei-x");
    expect(c.a.pedidos).toHaveLength(0);
  });

  it("envia a janela da fonte às duas IAs e grava o slug da fonte", async () => {
    const dispositivos = Array.from({ length: 10 }, (_, i) => ({ referencia: `art. ${i + 1}`, texto: `Art. ${i + 1}º Texto ${i + 1}.` }));
    const c = cenario([lote(item("A", "C"))], [julgamentos("C")]);
    await gerarLote(c.deps, {
      ...entrada,
      topico: { ...entrada.topico, canonico: "legislacao-cbmal/lei-x" },
      fonte: { slug: "lei-x", titulo: "Lei X", dispositivos },
    });
    expect(c.a.pedidos[0].prompt).toContain("Art. 8º Texto 8.");
    expect(c.a.pedidos[0].prompt).not.toContain("Art. 9º Texto 9.");
    expect(c.o.pedidos[0].prompt).toContain("Art. 1º Texto 1.");
    expect(c.r.lotes[0].fonte).toBe("lei-x");
  });

  it("limita a quantidade e normaliza a dificuldade", async () => {
    const muitos = Array.from({ length: 7 }, (_, i) => item(`I${i}`, "C", { dificuldade: i === 0 ? 7 : 0.2 }));
    const c = cenario([lote(...muitos)], [julgamentos("C", "C", "C", "C", "C")]);
    const resumo = await gerarLote(c.deps, { ...entrada, quantidade: 9 });
    expect(resumo.gerados).toBe(5);
    expect(c.a.pedidos[0].prompt).toContain("Escreva 5 itens");
    expect(c.r.lotes[0].itens.map((i) => i.dificuldade)).toEqual([3, 1, 1, 1, 1]);
  });
});

import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { ErroPipeline } from "../gerar-lote";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { corrigirRedacao } from "./corrigir";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

function banca(notas: [number, number, number], fuga = false): CorrecaoConteudo {
  return {
    aspectos: [
      { codigo: "1", nota: notas[0], justificativa: "j" },
      { codigo: "2.1", nota: notas[1], justificativa: "j" },
      { codigo: "2.2", nota: notas[2], justificativa: "j" },
    ],
    fuga_tema: fuga,
    comentario: "c",
  };
}
const lingua: CorrecaoLingua = {
  erros: [{ linha: 2, trecho: "bombeiros chegou", tipo: "morfossintaxe", categoria: "concordancia", correcao: "chegaram", explicacao: "x" }],
};

describe("corrigirRedacao", () => {
  it("roda as duas bancas e a língua, consolida e grava o resultado", async () => {
    // Claude responde na ordem de chamada: conteudo_1 e depois lingua (as etapas começam em paralelo, na ordem da lista).
    const claude = criarProvedorFalso("anthropic", [banca([3, 10, 8]), lingua]);
    const gpt = criarProvedorFalso("openai", [banca([2, 12, 9])]);
    const { repo, estado } = criarRepoFalso();
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: "j1" }, "r1");
    // NC 22; NE 1; TL 2 → NPD = 22 − 6 × 1 ÷ 2 = 19
    expect(r).toEqual({ status: "corrigida", npd: 19, terceiraCorrecao: false });
    expect(estado.status).toEqual(["corrigindo"]);
    expect(Object.keys(estado.correcoes).sort()).toEqual(["conteudo_1", "conteudo_2", "lingua"]);
    expect(estado.resultado).toMatchObject({ nc: 22, ne: 1, tl: 2 });
    expect(estado.usos.map((u) => u.finalidade).sort()).toEqual(["discursiva_conteudo", "discursiva_conteudo", "discursiva_lingua"]);
    expect(claude.pedidos[0].prompt).toContain("01| O Brasil precisa investir em prevenção.");
    expect(gpt.pedidos[0].prompt).not.toContain("terceiro examinador");
  });

  it("chama a terceira banca (Claude) só quando as notas divergem", async () => {
    const claude = criarProvedorFalso("anthropic", [banca([3, 13, 13]), lingua, banca([3, 12, 12])]);
    const gpt = criarProvedorFalso("openai", [banca([1, 3, 3])]);
    const { repo, estado } = criarRepoFalso();
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toMatchObject({ status: "corrigida", terceiraCorrecao: true });
    expect(estado.correcoes.conteudo_3).toBeDefined();
    expect(claude.pedidos[2].prompt).toContain("terceiro examinador");
    expect(estado.resultado).toMatchObject({ nc: 28, usadas: [0, 2] });
  });

  it("retoma sem refazer as etapas já gravadas", async () => {
    const claude = criarProvedorFalso("anthropic", [lingua]);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ status: "corrigindo" }), {
      conteudo_1: banca([3, 10, 8]),
      conteudo_2: banca([2, 12, 9]),
    });
    await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(claude.pedidos).toHaveLength(1);
    expect(gpt.pedidos).toHaveLength(0);
    expect(estado.resultado).toMatchObject({ npd: 19 });
  });

  it("grava o que deu certo e falha para tentar de novo quando uma etapa falha", async () => {
    const claude = criarProvedorFalso("anthropic", [banca([3, 10, 8]), lingua]);
    const gpt = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora do ar")]);
    const { repo, estado } = criarRepoFalso();
    await expect(
      corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1"),
    ).rejects.toThrow(/conteudo_2: fora do ar/);
    expect(Object.keys(estado.correcoes).sort()).toEqual(["conteudo_1", "lingua"]);
    expect(estado.resultado).toBeNull();
  });

  it("texto vazio recebe zero sem chamar IA", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ linhas: ["", "  "] }));
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "corrigida", npd: 0, terceiraCorrecao: false });
    expect(estado.resultado?.zeradaMotivo).toBe("sem_texto");
    expect(claude.pedidos).toHaveLength(0);
  });

  it("ignora redação já corrigida e recusa estado fora da fila", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const gpt = criarProvedorFalso("openai", []);
    const deps = (status: string) => ({
      provedores: [claude.provedor, gpt.provedor] as [typeof claude.provedor, typeof gpt.provedor],
      repo: criarRepoFalso(redacao({ status })).repo,
      jobId: null,
    });
    expect(await corrigirRedacao(deps("corrigida"), "r1")).toEqual({ status: "ignorada", motivo: "já corrigida" });
    const erro = await corrigirRedacao(deps("rascunho"), "r1").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroPipeline);
    expect(erro.definitivo).toBe(true);
  });
});

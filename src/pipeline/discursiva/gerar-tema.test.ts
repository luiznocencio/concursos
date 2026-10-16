import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { criarRepoFalso } from "./__fixtures__/repo-falso";
import { gerarTema, problemasDoPadrao } from "./gerar-tema";
import type { TemaGerado } from "./schemas";

function tema(pontos: number[] = [3, 13.5, 13.5]): TemaGerado {
  return {
    enunciado: "  Prevenção de desastres climáticos ",
    textos_apoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "Adaptado" }],
    padrao_resposta: {
      aspectos: pontos.map((p, i) => ({ codigo: i === 0 ? "1" : ` 2.${i} `, descricao: `A${i}`, pontos: p })),
      expectativas: "x",
    },
  };
}

describe("problemasDoPadrao", () => {
  it("aceita padrão com pontuação que soma o máximo", () => {
    expect(problemasDoPadrao(tema(), 30)).toEqual([]);
  });

  it("aponta soma errada, aspecto sem pontos e códigos repetidos", () => {
    const t = tema([3, 0, 13.5]);
    t.padrao_resposta.aspectos[2].codigo = "1";
    expect(problemasDoPadrao(t, 30)).toEqual([
      "códigos de aspecto repetidos",
      "aspecto sem pontuação positiva",
      "pontuações somam 16.5, não 30",
    ]);
  });
});

describe("gerarTema", () => {
  it("Claude gera, GPT avalia; aprovado vai direto para os alunos", async () => {
    const claude = criarProvedorFalso("anthropic", [tema()]);
    const gpt = criarProvedorFalso("openai", [{ aprovado: true, problemas: [] }]);
    const { repo, estado } = criarRepoFalso();
    const r = await gerarTema({ provedores: [claude.provedor, gpt.provedor], repo, jobId: "j" }, "cbmal-2026");
    expect(r).toEqual({ status: "aprovado", gravado: true, problemas: [], gerador: "anthropic", avaliador: "openai" });
    expect(estado.temas[0].tema.enunciado).toBe("Prevenção de desastres climáticos");
    expect(estado.temas[0].tema.padrao_resposta.aspectos[1].codigo).toBe("2.1");
    expect(claude.pedidos[0].prompt).toContain("- Tema antigo");
  });

  it("vai para revisão quando a avaliação reprova ou o padrão tem problema", async () => {
    const claude = criarProvedorFalso("anthropic", [tema(), tema([3, 10, 10])]);
    const gpt = criarProvedorFalso("openai", [{ aprovado: false, problemas: ["tema datado"] }, { aprovado: true, problemas: [] }]);
    const { repo } = criarRepoFalso();
    const deps = { provedores: [claude.provedor, gpt.provedor] as [typeof claude.provedor, typeof gpt.provedor], repo, jobId: null };
    expect(await gerarTema(deps, "c")).toMatchObject({ status: "revisao", problemas: ["tema datado"] });
    const t = tema([3, 10, 10]);
    t.enunciado = "Outro tema";
    const claude2 = criarProvedorFalso("anthropic", [t]);
    const r = await gerarTema({ ...deps, provedores: [claude2.provedor, gpt.provedor] }, "c");
    expect(r).toMatchObject({ status: "revisao", problemas: ["pontuações somam 23, não 30"] });
  });

  it("se o GPT não puder avaliar, o próprio Claude avalia e o tema vai para revisão", async () => {
    const claude = criarProvedorFalso("anthropic", [tema(), { aprovado: true, problemas: [] }]);
    const gpt = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora")]);
    const { repo } = criarRepoFalso();
    const r = await gerarTema({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "c");
    expect(r).toMatchObject({ status: "revisao", avaliador: "anthropic" });
  });
});

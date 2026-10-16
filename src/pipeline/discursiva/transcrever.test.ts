import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { avaliarTranscricao, transcreverRedacao } from "./transcrever";

const l = (texto: string, ilegivel = false) => ({ texto, ilegivel });

describe("avaliarTranscricao", () => {
  it("aceita até 20% de linhas ilegíveis e tira as linhas em branco do fim", () => {
    const t = { linhas: [l(" a "), l(""), l("b"), l("c"), l("d"), l("e", true), l(""), l("")] };
    expect(avaliarTranscricao(t, 30)).toEqual({ ok: true, linhas: ["a", "", "b", "c", "d", "e"], excedente: [] });
  });

  it("pede outra foto acima de 20% de linhas ilegíveis", () => {
    const t = { linhas: [l("a"), l("b", true), l("c"), l("d", true)] };
    expect(avaliarTranscricao(t, 30)).toEqual({
      ok: false,
      aviso: "A foto ficou difícil de ler (2 de 4 linhas). Envie outra, com boa luz e a folha inteira.",
    });
  });

  it("pede outra foto quando não há texto", () => {
    expect(avaliarTranscricao({ linhas: [l(""), l(" ")] }, 30).ok).toBe(false);
  });

  it("separa o que passa do máximo de linhas", () => {
    expect(avaliarTranscricao({ linhas: [l("a"), l("b"), l("c")] }, 2)).toEqual({ ok: true, linhas: ["a", "b"], excedente: ["c"] });
  });
});

describe("transcreverRedacao", () => {
  it("envia as fotos ao Claude, guarda a resposta e a transcrição", async () => {
    const claude = criarProvedorFalso("anthropic", [{ linhas: [l("Texto da folha.")] }]);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    const r = await transcreverRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "transcrita", ok: true });
    expect(estado.fotosBaixadas).toEqual(["u1/r1/1.jpg"]);
    expect(claude.pedidos[0].imagens).toHaveLength(1);
    expect(estado.correcoes.transcricao).toEqual({ linhas: [l("Texto da folha.")] });
    expect(estado.transcricao).toEqual({ ok: true, linhas: ["Texto da folha."], excedente: [] });
  });

  it("usa o GPT de reserva quando o Claude falha", async () => {
    const claude = criarProvedorFalso("anthropic", [new ErroIa("anthropic", "api", "erro")]);
    const gpt = criarProvedorFalso("openai", [{ linhas: [l("Texto.")] }]);
    const { repo } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    await transcreverRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(gpt.pedidos[0].imagens).toHaveLength(1);
  });

  it("ignora redação que não está esperando transcrição", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const { repo } = criarRepoFalso(redacao({ status: "rascunho" }));
    const r = await transcreverRedacao({ provedores: [claude.provedor, claude.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "ignorada", motivo: "estado rascunho" });
  });
});

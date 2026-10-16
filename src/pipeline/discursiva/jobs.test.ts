import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import type { Job } from "../executar-job";
import { ErroPipeline } from "../gerar-lote";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { AVISO_CORRECAO_FALHOU, AVISO_TRANSCRICAO_FALHOU, processadoresDiscursiva } from "./jobs";

const job = (tipo: string, payload: unknown, tentativas = 1): Job => ({ id: "j1", tipo, payload, tentativas });
const falha = (nome: "anthropic" | "openai") => criarProvedorFalso(nome, [new ErroIa(nome, "api", "fora"), new ErroIa(nome, "api", "fora")]);

describe("processadoresDiscursiva", () => {
  it("corrige a redação do payload", async () => {
    const { repo, estado } = criarRepoFalso(redacao({ linhas: [] }));
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    expect(await p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }))).toMatchObject({ status: "corrigida", npd: 0 });
    expect(estado.resultado?.zeradaMotivo).toBe("sem_texto");
  });

  it("só marca a redação como falhou na última tentativa", async () => {
    const { repo, estado } = criarRepoFalso();
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    await expect(p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }, 1))).rejects.toThrow();
    expect(estado.status).toEqual(["corrigindo"]);
    await expect(p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }, 3))).rejects.toThrow();
    expect(estado.status.at(-1)).toBe(`falhou: ${AVISO_CORRECAO_FALHOU}`);
  });

  it("transcrição que falha de vez volta ao rascunho com aviso", async () => {
    const { repo, estado } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    await expect(p.transcrever_redacao(job("transcrever_redacao", { redacao_id: "r1" }, 3))).rejects.toThrow();
    expect(estado.transcricao).toEqual({ ok: false, aviso: AVISO_TRANSCRICAO_FALHOU });
  });

  it("recusa payload inválido de vez", async () => {
    const { repo } = criarRepoFalso();
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    const erro = await p.gerar_tema(job("gerar_tema", {})).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPipeline);
    expect((erro as ErroPipeline).definitivo).toBe(true);
  });
});

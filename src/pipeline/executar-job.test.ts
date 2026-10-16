import { describe, expect, it } from "vitest";
import { executarProximoJob, rodadaDoJob, type DepsJob, type Job } from "./executar-job";
import { ErroPipeline, type EntradaLote, type ResumoLote } from "./gerar-lote";

const resumo: ResumoLote = {
  gerados: 1, duplicados: 0, aprovados: 1, revisao: 0, gravados: 1, custoUsd: 0.1, gerador: "anthropic", validador: "openai",
};

function deps(job: Job | null, gerar: DepsJob["gerar"] = async () => resumo) {
  const chamadas: string[] = [];
  const entradas: EntradaLote[] = [];
  const d: DepsJob = {
    fila: {
      async reservar() {
        return job;
      },
      async concluir(id) {
        chamadas.push(`concluir ${id}`);
      },
      async falhar(id, erro, max) {
        chamadas.push(`falhar ${id} ${max} ${erro}`);
      },
    },
    async carregarContexto(concurso, canonico) {
      return { banca: "cebraspe", topico: { canonico, disciplina: "D", programa: `${concurso} P` }, fonte: null };
    },
    async gerar(entrada, jobId) {
      entradas.push(entrada);
      return gerar(entrada, jobId);
    },
  };
  return { d, chamadas, entradas };
}

const job = (extra: Partial<Job> = {}): Job => ({
  id: "0000000a-0000-0000-0000-000000000000",
  tipo: "gerar_itens",
  payload: { concurso: "cbmal-2026", canonico: "portugues/crase", quantidade: 5 },
  tentativas: 1,
  ...extra,
});

describe("executarProximoJob", () => {
  it("não faz nada com a fila vazia", async () => {
    expect(await executarProximoJob(deps(null).d)).toEqual({ status: "vazio" });
  });

  it("gera o lote com o contexto do tópico e conclui o job", async () => {
    const t = deps(job());
    const r = await executarProximoJob(t.d);
    expect(r).toEqual({ status: "concluido", jobId: job().id, resumo });
    expect(t.entradas[0]).toMatchObject({ banca: "cebraspe", quantidade: 5, rodada: 10, topico: { programa: "cbmal-2026 P" } });
    expect(t.chamadas).toEqual([`concluir ${job().id}`]);
  });

  it("devolve à fila com o limite normal de tentativas quando a geração falha", async () => {
    const t = deps(job(), async () => {
      throw new ErroPipeline("gerar_itens falhou em todos os provedores");
    });
    const r = await executarProximoJob(t.d);
    expect(r).toMatchObject({ status: "falhou", erro: "gerar_itens falhou em todos os provedores" });
    expect(t.chamadas).toEqual([`falhar ${job().id} 3 gerar_itens falhou em todos os provedores`]);
  });

  it("falha de vez em erros definitivos e payloads inválidos", async () => {
    const t1 = deps(job(), async () => {
      throw new ErroPipeline("Fonte legal ausente", true);
    });
    await executarProximoJob(t1.d);
    expect(t1.chamadas[0]).toMatch(/^falhar \S+ 0 Fonte legal ausente/);

    const t2 = deps(job({ payload: { canonico: "x" } }));
    await executarProximoJob(t2.d);
    expect(t2.chamadas[0]).toMatch(/^falhar \S+ 0 Payload inválido/);
    expect(t2.entradas).toHaveLength(0);
  });
});

describe("executarProximoJob com outros tipos de job", () => {
  it("entrega o job ao processador do tipo e conclui", async () => {
    const t = deps(job({ tipo: "corrigir_redacao", payload: { redacao_id: "r1" } }));
    const recebidos: Job[] = [];
    t.d.processadores = {
      async corrigir_redacao(j) {
        recebidos.push(j);
        return { status: "corrigida" };
      },
    };
    const r = await executarProximoJob(t.d);
    expect(r).toEqual({ status: "concluido", jobId: job().id, resumo: { status: "corrigida" } });
    expect(recebidos[0].payload).toEqual({ redacao_id: "r1" });
    expect(t.entradas).toHaveLength(0);
  });

  it("falha de vez em tipo sem processador", async () => {
    const t = deps(job({ tipo: "desconhecido" }));
    await executarProximoJob(t.d);
    expect(t.chamadas[0]).toMatch(/^falhar \S+ 0 Tipo de job desconhecido: desconhecido/);
  });
});

describe("rodadaDoJob", () => {
  it("varia com o id e com a tentativa", () => {
    expect(rodadaDoJob(job())).toBe(10);
    expect(rodadaDoJob(job({ tentativas: 2 }))).toBe(11);
  });
});

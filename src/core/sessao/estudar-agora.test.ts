import { describe, expect, it } from "vitest";
import type { PrioridadeTopico } from "../foco/prioridade";
import { montarEstudarAgora } from "./estudar-agora";
import type { ItemCandidato } from "./selecao";

function prioridade(canonico: string, valor: number): PrioridadeTopico {
  return {
    disciplina: "d", codigo: canonico, titulo: canonico, canonico, chave: `d:${canonico}`, peso: 1,
    prioridade: valor, fraqueza: 0, esquecimento: 0, incerteza: 0, aproveitamento: 0, n: 0,
  };
}

function itensDe(canonico: string, n: number, visto = false): ItemCandidato[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${canonico}#${i}`, textoBaseId: null, canonicos: [canonico], visto }));
}

// 8 tópicos em ordem decrescente de prioridade: t1 (mais fraco) … t8 (mais forte)
const prioridades = [8, 7, 6, 5, 4, 3, 2, 1].map((v, i) => prioridade(`t${i + 1}`, v));
const itens = prioridades.flatMap((p) => itensDe(p.canonico, 5));
const revisao = ["t8#4", "t7#4", "t6#4", "t5#4", "t4#4", "t3#4"];

const topico = (id: string) => id.split("#")[0];

describe("montarEstudarAgora", () => {
  it("monta 20 itens: 4 de revisão, 2 de manutenção e 14 de foco (máx. 3 por tópico)", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: revisao });
    expect(sessao).toHaveLength(20);
    expect(new Set(sessao).size).toBe(20);

    // revisão: os 4 primeiros vencidos
    for (const id of revisao.slice(0, 4)) expect(sessao).toContain(id);
    expect(sessao).not.toContain("t4#4");

    // manutenção: 1 item de cada um dos 2 tópicos mais fortes
    expect(sessao).toContain("t8#0");
    expect(sessao).toContain("t7#0");

    // foco: t1..t4 com 3 itens cada (12) + t5 com 2 itens (14)
    const foco = sessao.filter((id) => !revisao.includes(id) && !["t8#0", "t7#0"].includes(id));
    const contagem = foco.reduce<Record<string, number>>((acc, id) => ({ ...acc, [topico(id)]: (acc[topico(id)] ?? 0) + 1 }), {});
    expect(contagem).toEqual({ t1: 3, t2: 3, t3: 3, t4: 3, t5: 2 });
  });

  it("apresenta primeiro o foco, depois revisão e manutenção", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: revisao });
    expect(topico(sessao[0])).toBe("t1");
    expect(sessao.slice(14, 18)).toEqual(revisao.slice(0, 4));
    expect(sessao.slice(18)).toEqual(["t8#0", "t7#0"]);
  });

  it("completa com foco quando faltam itens de revisão", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: [] });
    expect(sessao).toHaveLength(20);
  });

  it("libera mais de 3 itens por tópico quando há poucos tópicos", () => {
    const poucos = [prioridade("a", 2), prioridade("b", 1)];
    const sessao = montarEstudarAgora({ prioridades: poucos, itens: [...itensDe("a", 15), ...itensDe("b", 15)], revisaoVencida: [], total: 10 });
    expect(sessao).toHaveLength(10);
    expect(sessao.filter((id) => topico(id) === "a").length).toBeGreaterThan(3);
  });

  it("devolve menos itens quando o banco não tem o suficiente", () => {
    const sessao = montarEstudarAgora({ prioridades: [prioridade("a", 1)], itens: itensDe("a", 3), revisaoVencida: [] });
    expect(sessao).toHaveLength(3);
  });

  it("ignora ids de revisão que não estão entre os candidatos", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: ["inexistente"] });
    expect(sessao).not.toContain("inexistente");
  });
});

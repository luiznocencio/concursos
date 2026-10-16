import { describe, expect, it } from "vitest";
import type { TopicoAlvo } from "../edital/consultas";
import { calcularPrioridades, CONFIG_FOCO, type RespostaHistorico } from "./prioridade";

const agora = new Date("2026-11-01T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);

function alvo(codigo: string, canonico: string, peso = 1): TopicoAlvo {
  return { disciplina: "d", codigo, titulo: codigo, canonico, chave: `d:${codigo}`, peso };
}

function h(canonico: string, resultado: RespostaHistorico["resultado"], dias: number): RespostaHistorico {
  return { canonico, resultado, respondidaEm: diasAtras(dias) };
}

describe("calcularPrioridades", () => {
  it("tópico nunca praticado: fraqueza 0,5, esquecimento 1, incerteza 2", () => {
    const [p] = calcularPrioridades([alvo("1", "a/x", 3)], [], agora);
    expect(p).toMatchObject({ n: 0, aproveitamento: 0, fraqueza: 0.5, esquecimento: 1, incerteza: 2 });
    expect(p.prioridade).toBeCloseTo(3 * 0.5 * 1 * 2, 10);
  });

  it("pondera respostas pela meia-vida de 14 dias", () => {
    // errado hoje (peso 1) e certo há 14 dias (peso 0,5): L = (−1 + 0,5) / 1,5 = −1/3
    const [p] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "errado", 0), h("a/x", "certo", 14)], agora);
    expect(p.aproveitamento).toBeCloseTo(-1 / 3, 10);
    expect(p.fraqueza).toBeCloseTo((1 + 1 / 3) / 2, 10);
  });

  it("acerto com dúvida vale meio acerto", () => {
    const [p] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo_duvida", 0)], agora);
    expect(p.aproveitamento).toBeCloseTo(0.5, 10);
  });

  it("esquecimento cresce com o tempo e tem piso 0,1", () => {
    const [hoje] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo", 0)], agora);
    const [semana] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo", 7)], agora);
    expect(hoje.esquecimento).toBe(0.1);
    expect(semana.esquecimento).toBeCloseTo(1 - Math.exp(-1), 10);
  });

  it("incerteza diminui com o número de respostas", () => {
    const hist = Array.from({ length: 5 }, () => h("a/x", "certo", 1));
    const [p] = calcularPrioridades([alvo("1", "a/x")], hist, agora);
    expect(p.n).toBe(5);
    expect(p.incerteza).toBeCloseTo(1.5, 10);
  });

  it("ordena da maior para a menor prioridade, desempatando pela chave", () => {
    const topicos = [alvo("1", "a/forte", 1), alvo("2", "a/fraco", 1), alvo("3", "a/novo-b", 1), alvo("4", "a/novo-a", 1)];
    const hist = [h("a/forte", "certo", 3), h("a/fraco", "errado", 3)];
    const ordem = calcularPrioridades(topicos, hist, agora).map((p) => p.chave);
    expect(ordem).toEqual(["d:3", "d:4", "d:2", "d:1"]);
  });

  it("peso maior aumenta a prioridade proporcionalmente", () => {
    const [a, b] = calcularPrioridades([alvo("1", "a/x", 1), alvo("2", "a/y", 4)], [], agora);
    expect(a.chave).toBe("d:2");
    expect(a.prioridade / b.prioridade).toBeCloseTo(4, 10);
  });

  it("erro de redação pesa menos que item errado", () => {
    const certo = h("a/x", "certo", 0);
    const [item] = calcularPrioridades([alvo("1", "a/x")], [certo, h("a/x", "errado", 0)], agora);
    const erroRedacao = { ...h("a/x", "errado", 0), peso: CONFIG_FOCO.pesoErroRedacao };
    const [redacao] = calcularPrioridades([alvo("1", "a/x")], [certo, erroRedacao], agora);
    // item: (1 − 1) / 2 = 0; redação: (1 − 0,5) / 1,5 = 1/3
    expect(item.aproveitamento).toBeCloseTo(0, 10);
    expect(redacao.aproveitamento).toBeCloseTo(1 / 3, 10);
    expect(redacao.prioridade).toBeLessThan(item.prioridade);
  });
});

import { describe, expect, it } from "vitest";
import type { PrioridadeTopico } from "../foco/prioridade";
import type { ItemCandidato } from "./selecao";
import { montarSimuladoProva, montarTreinoTopico, topicosQuePrecisamGeracao } from "./treino-simulado";

function itensDe(canonico: string, n: number, visto = false, prefixo = canonico): ItemCandidato[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefixo}#${i}`, textoBaseId: null, canonicos: [canonico], visto }));
}

function prioridade(canonico: string, valor: number): PrioridadeTopico {
  return {
    disciplina: "d", codigo: canonico, titulo: canonico, canonico, chave: `d:${canonico}`, peso: 1,
    prioridade: valor, fraqueza: 0, esquecimento: 0, incerteza: 0, aproveitamento: 0, n: 0,
  };
}

describe("montarTreinoTopico", () => {
  it("alterna entre os tópicos escolhidos", () => {
    const itens = [...itensDe("a", 5), ...itensDe("b", 5)];
    expect(montarTreinoTopico({ canonicos: ["a", "b"], itens, total: 4 })).toEqual(["a#0", "b#0", "a#1", "b#1"]);
  });

  it("continua no tópico que ainda tem itens quando o outro acaba", () => {
    const itens = [...itensDe("a", 1), ...itensDe("b", 5)];
    expect(montarTreinoTopico({ canonicos: ["a", "b"], itens, total: 4 })).toEqual(["a#0", "b#0", "b#1", "b#2"]);
  });
});

describe("montarSimuladoProva", () => {
  const demandas = [
    { disciplina: "port", canonicos: ["p/x", "p/y"], quantidade: 4 },
    { disciplina: "mat", canonicos: ["m/x"], quantidade: 3 },
  ];

  it("cumpre a quantidade de cada disciplina cobrindo os tópicos em rodízio", () => {
    const itens = [...itensDe("p/x", 5), ...itensDe("p/y", 5), ...itensDe("m/x", 5)];
    const r = montarSimuladoProva(demandas, itens);
    expect(r.itens).toEqual(["p/x#0", "p/y#0", "p/x#1", "p/y#1", "m/x#0", "m/x#1", "m/x#2"]);
    expect(r.faltantes).toEqual([]);
    expect(r.disciplinaDoItem).toMatchObject({ "p/x#0": "port", "p/y#1": "port", "m/x#2": "mat" });
  });

  it("informa quantos itens faltam por disciplina", () => {
    const itens = [...itensDe("p/x", 1), ...itensDe("m/x", 3)];
    expect(montarSimuladoProva(demandas, itens).faltantes).toEqual([{ disciplina: "port", faltam: 3 }]);
  });

  it("não repete itens excluídos (ex.: já usados na P1)", () => {
    const itens = itensDe("m/x", 4);
    const r = montarSimuladoProva([{ disciplina: "mat", canonicos: ["m/x"], quantidade: 3 }], itens, new Set(["m/x#0"]));
    expect(r.itens).toEqual(["m/x#1", "m/x#2", "m/x#3"]);
  });
});

describe("topicosQuePrecisamGeracao", () => {
  it("aponta os tópicos prioritários com poucos itens não vistos", () => {
    const prioridades = [prioridade("a", 3), prioridade("b", 2), prioridade("c", 1)];
    const itens = [...itensDe("a", 10), ...itensDe("b", 9), ...itensDe("b", 5, true, "b-visto"), ...itensDe("c", 0)];
    expect(topicosQuePrecisamGeracao(prioridades, itens, { top: 2 })).toEqual(["b"]);
    expect(topicosQuePrecisamGeracao(prioridades, itens)).toEqual(["b", "c"]);
  });
});

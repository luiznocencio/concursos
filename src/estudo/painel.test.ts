import { describe, expect, it } from "vitest";
import { calcularPrioridades, type RespostaHistorico, type TopicoAlvo } from "@/core";
import { diasAte, tabelaDesempenho, tendenciaSemanal } from "./painel";

const AGORA = new Date("2026-10-15T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);
const r = (canonico: string, resultado: RespostaHistorico["resultado"], dias: number): RespostaHistorico => ({
  canonico, resultado, respondidaEm: diasAtras(dias),
});

describe("tendenciaSemanal", () => {
  it("dá o aproveitamento de cada semana, da mais antiga para a atual", () => {
    const rs = [r("a", "certo", 1), r("a", "errado", 2), r("a", "certo", 9), r("a", "branco", 25)];
    expect(tendenciaSemanal(rs, AGORA)).toEqual([0, null, 1, 0]);
  });
});

describe("tabelaDesempenho", () => {
  const topicos: TopicoAlvo[] = [
    { disciplina: "lp", codigo: "1", titulo: "Crase", canonico: "lp/crase", chave: "lp:1", peso: 1 },
    { disciplina: "lp", codigo: "2", titulo: "Regência", canonico: "lp/regencia", chave: "lp:2", peso: 1 },
    { disciplina: "mat", codigo: "1", titulo: "Frações", canonico: "mat/fracoes", chave: "mat:1", peso: 1 },
  ];

  it("agrupa por disciplina na ordem do edital com brancos e tendência", () => {
    const historico = [r("lp/regencia", "errado", 1), r("lp/regencia", "branco", 2), r("lp/crase", "certo", 3)];
    const prioridades = calcularPrioridades(topicos, historico, AGORA);
    const t = tabelaDesempenho(topicos, prioridades, historico, AGORA);
    expect(t.map((d) => d.disciplina)).toEqual(["lp", "mat"]);
    expect(t[0].topicos.map((x) => x.codigo)).toEqual(["1", "2"]);
    expect(t[0]).toMatchObject({ n: 3, aproveitamento: 0, taxaBrancos: 1 / 3 });
    expect(t[0].topicos[1]).toMatchObject({ n: 2, taxaBrancos: 0.5, tendencia: [null, null, null, -0.5] });
    expect(t[1].topicos[0]).toMatchObject({ n: 0, taxaBrancos: 0, tendencia: [null, null, null, null] });
  });
});

describe("diasAte", () => {
  it("conta os dias até a prova no horário de Brasília e nunca fica negativo", () => {
    expect(diasAte("2026-10-20", AGORA)).toBe(5);
    expect(diasAte("2026-01-01", AGORA)).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { analisarDuvidas, type RespostaDuvida } from "./duvida";

function rs(disciplina: string, certos: number, errados: number, opts: { duvida?: boolean; brancos?: number } = {}): RespostaDuvida[] {
  const duvida = opts.duvida ?? true;
  return [
    ...Array.from({ length: certos }, () => ({ disciplina, duvida, marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ disciplina, duvida, marcacao: "E", gabarito: "C" })),
    ...Array.from({ length: opts.brancos ?? 0 }, () => ({ disciplina, duvida, marcacao: null, gabarito: "C" })),
  ];
}

describe("analisarDuvidas", () => {
  it("recomenda arriscar quando o saldo dos chutes é positivo", () => {
    const [a] = analisarDuvidas(rs("lp", 7, 4));
    expect(a).toEqual({ disciplina: "lp", itens: 11, certos: 7, errados: 4, saldo: 3, recomendacao: "arriscar_mais" });
  });

  it("recomenda deixar em branco quando o saldo é negativo", () => {
    expect(analisarDuvidas(rs("fis", 4, 8))[0].recomendacao).toBe("deixar_mais_em_branco");
  });

  it("é neutro com saldo zero", () => {
    expect(analisarDuvidas(rs("mat", 5, 5))[0].recomendacao).toBe("neutro");
  });

  it("não recomenda nada com menos de 10 itens com dúvida", () => {
    expect(analisarDuvidas(rs("rlm", 6, 3))[0].recomendacao).toBe("dados_insuficientes");
  });

  it("ignora itens sem dúvida e brancos", () => {
    const entrada = [...rs("lp", 20, 0, { duvida: false }), ...rs("lp", 1, 0, { brancos: 5 })];
    expect(analisarDuvidas(entrada)).toEqual([
      { disciplina: "lp", itens: 1, certos: 1, errados: 0, saldo: 1, recomendacao: "dados_insuficientes" },
    ]);
  });

  it("ordena por disciplina", () => {
    const r = analisarDuvidas([...rs("rlm", 1, 0), ...rs("lp", 1, 0)]);
    expect(r.map((a) => a.disciplina)).toEqual(["lp", "rlm"]);
  });
});

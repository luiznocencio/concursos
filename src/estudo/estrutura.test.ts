import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demandasDaProva, parseEdital, provasObjetivasDoCargo, topicosAlvoDoCargo } from "@/core";
import { editalMini } from "@/core/edital/__fixtures__/mini";
import { linhaDoEdital } from "./__fixtures__/linha-cargo";
import { montarEstruturaCargo } from "./estrutura";

const cbmal = parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"));

describe("montarEstruturaCargo", () => {
  for (const [nome, edital] of [["mini", editalMini()], ["cbmal-2026", cbmal]] as const) {
    for (const cargo of edital.cargos.map((c) => c.slug)) {
      it(`${nome}/${cargo}: dá os mesmos tópicos-alvo e demandas que o edital`, () => {
        const e = montarEstruturaCargo(linhaDoEdital(edital, cargo));
        expect(e.topicosAlvo).toEqual(topicosAlvoDoCargo(edital, cargo));
        const objetivas = provasObjetivasDoCargo(edital, cargo);
        expect(e.provas.map((p) => p.slug)).toEqual(objetivas.map((p) => p.slug));
        for (const p of e.provas) expect(p.demandas).toEqual(demandasDaProva(edital, p.slug));
      });
    }
  }

  it("lê regras, cortes, duração e se há discursiva", () => {
    const e = montarEstruturaCargo(linhaDoEdital(cbmal, "cfo"));
    expect(e.cargo).toMatchObject({ slug: "cfo", duracaoMin: 270 });
    expect(e.temDiscursiva).toBe(true);
    expect(e.provas[0]).toMatchObject({ slug: "p1-gerais", nItens: 50, regra: { regra: "certo_errado_penalidade" }, corte: { regra: "piso_fator", fator: 0.2 } });
    expect(e.corteConjunto).toEqual({ provas: ["p1-gerais", "p2-cfo"], corte: { regra: "piso_fator", fator: 0.3 } });
    expect(e.disciplinas.lp).toBeTruthy();
  });
});

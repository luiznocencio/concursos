import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseEdital } from "./parse";
import type { Disciplina, Topico } from "./schema";

const caminho = fileURLToPath(new URL("../../../editais/cbmal-2026/edital.yaml", import.meta.url));
const edital = parseEdital(readFileSync(caminho, "utf8"));

function disciplina(slug: string): Disciplina {
  const d = edital.disciplinas.find((x) => x.slug === slug);
  if (!d) throw new Error(`disciplina ausente: ${slug}`);
  return d;
}

function folhas(topicos: Topico[]): Topico[] {
  return topicos.flatMap((t) => (t.subtopicos ? folhas(t.subtopicos) : [t]));
}

function buscar(topicos: Topico[], codigo: string): Topico | undefined {
  for (const t of topicos) {
    if (t.codigo === codigo) return t;
    const achado = t.subtopicos && buscar(t.subtopicos, codigo);
    if (achado) return achado;
  }
  return undefined;
}

describe("edital CBM-AL 2026", () => {
  it("tem os metadados do concurso", () => {
    expect(edital.banca).toBe("cebraspe");
    expect(edital.data_prova).toBe("2027-01-24");
    expect(edital.ressalvas.length).toBeGreaterThanOrEqual(2);
    expect(edital.cargos.map((c) => c.slug)).toEqual(["cfo", "soldado"]);
    expect(edital.cargos[1].qualificacoes).toEqual(["QPBM/1", "QPBM/2"]);
  });

  it("modela as provas conforme o edital", () => {
    const p = Object.fromEntries(edital.provas.map((x) => [x.slug, x]));
    expect(p["p1-gerais"]).toMatchObject({ tipo: "objetiva", formato: "certo_errado", itens: 50, corte: { regra: "piso_fator", fator: 0.2 } });
    expect(p["p2-cfo"]).toMatchObject({ itens: 70, corte: { regra: "piso_fator", fator: 0.3 } });
    expect(p["p2-soldado"]).toMatchObject({ itens: 70, corte: { regra: "piso_fator", fator: 0.3 } });
    expect(p["discursiva"]).toMatchObject({ tipo: "discursiva", pontuacao_maxima: 30, linhas_max: 30, nota_minima: 15, disciplinas: ["atualidades"] });
    for (const c of edital.cargos) {
      expect(c.duracao_min).toBe(270);
      expect(c.corte_conjunto?.corte).toEqual({ regra: "piso_fator", fator: 0.3 });
    }
  });

  it("transcreve todos os tópicos de primeiro nível do item 19", () => {
    const esperado: Record<string, number> = {
      lp: 6, ingles: 2, informatica: 5, matematica: 6, rlm: 6, "legislacao-cbmal": 5,
      "cidadania-dh": 8, atualidades: 1, "fisica-cfo": 6, "quimica-cfo": 14, "biologia-cfo": 9,
      "direito-administrativo": 8, "direito-constitucional": 7, "fisica-soldado": 9,
      "quimica-soldado": 6, "biologia-soldado": 9, "mecanica-geral": 7,
    };
    for (const [slug, n] of Object.entries(esperado)) {
      expect(disciplina(slug).topicos.length, slug).toBe(n);
    }
  });

  it("preserva códigos e títulos do edital (amostra)", () => {
    expect(buscar(disciplina("lp").topicos, "5.7")?.titulo).toBe("Emprego do sinal indicativo de crase");
    expect(buscar(disciplina("rlm").topicos, "4.1")?.titulo).toBe("Problemas de contagem e noções de probabilidade");
    expect(buscar(disciplina("fisica-cfo").topicos, "3.13")?.titulo).toBe("Ciclo de Carnot");
    expect(buscar(disciplina("quimica-soldado").topicos, "III.4")?.titulo).toBe("Número de oxidação");
    expect(buscar(disciplina("mecanica-geral").topicos, "1.3.2")?.titulo).toBe("Ciclo Diesel");
  });

  it("reaproveita tópicos canônicos entre os programas de CFO e Soldado", () => {
    const canon = (slug: string) => new Set(folhas(disciplina(slug).topicos).map((t) => t.canonico));
    const bioCfo = canon("biologia-cfo");
    const bioSd = canon("biologia-soldado");
    expect([...bioSd].filter((c) => bioCfo.has(c)).length).toBeGreaterThanOrEqual(20);
    expect(canon("fisica-cfo").has("fisica/leis-de-newton")).toBe(true);
    expect(canon("fisica-soldado").has("fisica/leis-de-newton")).toBe(true);
  });
});

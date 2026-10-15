import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { EditalInvalidoError, parseEdital } from "./parse";
import { textoMini } from "./__fixtures__/mini";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- o teste manipula o YAML cru
function mutar(fn: (bruto: any) => void): string {
  const bruto = parse(textoMini());
  fn(bruto);
  return stringify(bruto);
}

function problemasDe(texto: string): string[] {
  try {
    parseEdital(texto);
  } catch (e) {
    if (e instanceof EditalInvalidoError) return e.problemas;
    throw e;
  }
  throw new Error("esperava EditalInvalidoError");
}

describe("parseEdital", () => {
  it("aceita o fixture mínimo", () => {
    const e = parseEdital(textoMini());
    expect(e.slug).toBe("mini-2026");
    expect(e.cargos[0].corte_conjunto?.corte).toEqual({ regra: "piso_fator", fator: 0.3 });
    expect(e.ressalvas).toEqual([]);
  });

  it("aplica penalidade 0 por padrão em múltipla escolha", () => {
    const texto = mutar((b) => {
      b.provas[0].formato = "multipla_escolha";
      b.provas[0].alternativas = 5;
      b.provas[0].pontuacao = { regra: "multipla_escolha", peso: 1 };
    });
    const prova = parseEdital(texto).provas[0];
    expect(prova.tipo === "objetiva" && prova.pontuacao).toEqual({
      regra: "multipla_escolha",
      peso: 1,
      penalidade: 0,
    });
  });

  it("rejeita cargo que referencia prova inexistente", () => {
    const texto = mutar((b) => b.cargos[0].provas.push("p9"));
    expect(problemasDe(texto).join("\n")).toContain("prova inexistente: p9");
  });

  it("rejeita distribuição que não soma o total de itens", () => {
    const texto = mutar((b) => (b.provas[0].distribuicao_estimada.disciplinas.port = 5));
    expect(problemasDe(texto).join("\n")).toContain("soma 9, esperado 10");
  });

  it("rejeita distribuição com disciplinas diferentes das da prova", () => {
    const texto = mutar((b) => (b.provas[0].distribuicao_estimada.disciplinas = { port: 10 }));
    expect(problemasDe(texto).join("\n")).toContain("disciplinas da distribuição diferem");
  });

  it("rejeita tópico folha sem canônico", () => {
    const texto = mutar((b) => delete b.disciplinas[0].topicos[1].subtopicos[0].canonico);
    expect(problemasDe(texto).join("\n")).toContain("tópico folha sem canônico: port 2.1");
  });

  it("rejeita código de tópico duplicado na disciplina", () => {
    const texto = mutar((b) => (b.disciplinas[1].topicos[1].codigo = "1"));
    expect(problemasDe(texto).join("\n")).toContain("código duplicado: mat 1");
  });

  it("rejeita corte conjunto com prova fora do cargo", () => {
    const texto = mutar((b) => (b.cargos[0].corte_conjunto.provas = ["p1", "p3"]));
    expect(problemasDe(texto).join("\n")).toContain("corte_conjunto referencia prova fora do cargo: p3");
  });

  it("exige alternativas em prova de múltipla escolha", () => {
    const texto = mutar((b) => {
      b.provas[0].formato = "multipla_escolha";
      b.provas[0].pontuacao = { regra: "multipla_escolha", peso: 1 };
    });
    expect(problemasDe(texto).join("\n")).toContain("múltipla escolha sem alternativas: p1");
  });

  it("rejeita slug canônico mal formatado", () => {
    const texto = mutar((b) => (b.disciplinas[2].topicos[0].canonico = "Fisica Newton"));
    expect(problemasDe(texto).join("\n")).toContain("slug canônico inválido");
  });
});

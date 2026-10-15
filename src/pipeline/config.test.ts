import { describe, expect, it } from "vitest";
import { lerConfigIa } from "./config";

const completo = {
  ANTHROPIC_API_KEY: "a",
  OPENAI_API_KEY: "o",
  OPENAI_MODEL: "modelo-gpt",
  OPENAI_PRECO_ENTRADA_USD_MTOK: "1.5",
  OPENAI_PRECO_SAIDA_USD_MTOK: "6",
};

describe("lerConfigIa", () => {
  it("usa o Claude Opus 5.5 por padrão e converte os preços", () => {
    expect(lerConfigIa(completo)).toMatchObject({
      CLAUDE_MODEL: "claude-opus-5-5",
      CLAUDE_ESFORCO: "high",
      OPENAI_PRECO_ENTRADA_USD_MTOK: 1.5,
    });
  });

  it("aceita modelo e esforço do Claude por variável de ambiente", () => {
    expect(lerConfigIa({ ...completo, CLAUDE_MODEL: "claude-sonnet-5-5", CLAUDE_ESFORCO: "medium" })).toMatchObject({
      CLAUDE_MODEL: "claude-sonnet-5-5",
      CLAUDE_ESFORCO: "medium",
    });
  });

  it("trata variáveis vazias do Claude como ausentes", () => {
    expect(lerConfigIa({ ...completo, CLAUDE_MODEL: "", CLAUDE_ESFORCO: "" })).toMatchObject({
      CLAUDE_MODEL: "claude-opus-5-5",
      CLAUDE_ESFORCO: "high",
    });
  });

  it("recusa esforço desconhecido", () => {
    expect(() => lerConfigIa({ ...completo, CLAUDE_ESFORCO: "altissimo" })).toThrow("CLAUDE_ESFORCO");
  });

  it("lista as variáveis que faltam", () => {
    expect(() => lerConfigIa({ ANTHROPIC_API_KEY: "a" })).toThrow(
      "Configuração de IA ausente ou inválida: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_PRECO_ENTRADA_USD_MTOK, OPENAI_PRECO_SAIDA_USD_MTOK",
    );
  });
});

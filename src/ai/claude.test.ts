import { describe, expect, it } from "vitest";
import { criarProvedorClaude, suportaFallbackServidor } from "./claude";

describe("criarProvedorClaude", () => {
  it("só pede fallback no servidor para modelos que o têm", () => {
    expect(suportaFallbackServidor("claude-opus-5-5")).toBe(true);
    expect(suportaFallbackServidor("claude-sonnet-5-5")).toBe(true);
    expect(suportaFallbackServidor("claude-haiku-5-5")).toBe(false);
  });

  it("recusa modelo sem preço conhecido", () => {
    expect(() => criarProvedorClaude({ apiKey: "x", modelo: "claude-inexistente" })).toThrow("Preço desconhecido");
  });
});

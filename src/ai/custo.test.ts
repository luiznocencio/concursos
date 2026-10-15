import { describe, expect, it } from "vitest";
import { custoUsd, PRECOS_CLAUDE } from "./custo";

describe("custoUsd", () => {
  it("cobra entrada e saída pelo preço por milhão", () => {
    expect(custoUsd(PRECOS_CLAUDE["claude-opus-5-5"], { entrada: 1_000_000, saida: 100_000 })).toBeCloseTo(4 + 2, 10);
  });

  it("cobra escrita em cache a 1,25× e leitura pelo preço de cache", () => {
    const preco = PRECOS_CLAUDE["claude-opus-5-5"];
    expect(custoUsd(preco, { entrada: 0, saida: 0, escritaCache: 1_000_000, leituraCache: 1_000_000 })).toBeCloseTo(5 + 0.2, 10);
  });
});

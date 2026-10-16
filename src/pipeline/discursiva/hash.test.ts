import { describe, expect, it } from "vitest";
import { hashTema } from "./hash";

describe("hashTema", () => {
  it("coincide com o hash calculado pelo Postgres na importação de temas", () => {
    // Valores obtidos com: select md5(lower(regexp_replace(trim(x), '\s+', ' ', 'g')))
    expect(hashTema("  Tema   REAL ")).toBe("51022a7fca2c7d6ed87e8182758e9432");
    expect(hashTema("Ação\tNOVA")).toBe("cccc4a771a36535ae65ef59f86339c1b");
  });
});

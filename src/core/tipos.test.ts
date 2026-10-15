import { describe, expect, it } from "vitest";
import { resultadoDaResposta } from "./tipos";

describe("resultadoDaResposta", () => {
  it("diferencia acerto com e sem dúvida", () => {
    expect(resultadoDaResposta("certo", false)).toBe("certo");
    expect(resultadoDaResposta("certo", true)).toBe("certo_duvida");
    expect(resultadoDaResposta("errado", true)).toBe("errado");
    expect(resultadoDaResposta("branco", true)).toBe("branco");
  });
});

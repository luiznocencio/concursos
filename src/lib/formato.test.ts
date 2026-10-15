import { describe, expect, it } from "vitest";
import { aproveitamento, data, dataDaProva, duracao, nota, percentual, plural } from "./formato";

describe("formato", () => {
  it("formata números no padrão brasileiro", () => {
    expect(nota(21.5)).toBe("21,5");
    expect(nota(-3)).toBe("-3");
    expect(percentual(0.256)).toBe("26%");
    expect(aproveitamento(0.5)).toBe("+50%");
    expect(aproveitamento(-0.25)).toBe("-25%");
  });

  it("formata datas no fuso de Brasília", () => {
    expect(data("2026-10-15T01:00:00Z")).toMatch(/14/);
    expect(dataDaProva("2027-01-24")).toBe("24 de janeiro de 2027");
  });

  it("formata o cronômetro e plurais", () => {
    expect(duracao(3 * 3600_000 + 5 * 60_000 + 9_000)).toBe("3:05:09");
    expect(duracao(65_000)).toBe("01:05");
    expect(duracao(-5)).toBe("00:00");
    expect(plural(1, "item", "itens")).toBe("1 item");
    expect(plural(3, "item", "itens")).toBe("3 itens");
  });
});

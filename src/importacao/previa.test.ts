import { describe, expect, it } from "vitest";
import { faixas, montarPrevia } from "./previa";

const PROVA = `Texto CB1A1-I
A brigada chegou ao local em dez minutos.
Julgue os itens a seguir, relativos ao texto CB1A1-I.
1 O texto informa o tempo de chegada da brigada.
2 A palavra "local" é um adjetivo no texto.
3 O texto menciona vítimas.

Julgue os itens seguintes.
4 Item de informática.
5 Item de matemática.
6 Item sem gabarito.`;

describe("montarPrevia", () => {
  it("cruza itens e gabarito, descarta anulados e lista as inconsistências", () => {
    const r = montarPrevia(PROVA, "1 C 2 E 3 X 4 E 5 C 7 E");
    expect(r.grupos).toEqual([
      {
        textoBase: "Texto CB1A1-I\n\nA brigada chegou ao local em dez minutos.\n\nJulgue os itens a seguir, relativos ao texto CB1A1-I.",
        itens: [
          { numero: 1, enunciado: "O texto informa o tempo de chegada da brigada.", gabarito: "C" },
          { numero: 2, enunciado: 'A palavra "local" é um adjetivo no texto.', gabarito: "E" },
        ],
      },
      {
        textoBase: "Julgue os itens seguintes.",
        itens: [
          { numero: 4, enunciado: "Item de informática.", gabarito: "E" },
          { numero: 5, enunciado: "Item de matemática.", gabarito: "C" },
        ],
      },
    ]);
    expect(r.total).toBe(4);
    expect(r.anulados).toEqual([3]);
    expect(r.semGabarito).toEqual([6]);
    expect(r.gabaritoSemItem).toEqual([7]);
    expect(r.avisos).toEqual([]);
  });

  it("some com o grupo cujos itens foram todos anulados e junta os avisos da prova e do gabarito", () => {
    const r = montarPrevia("Julgue.\n1 Único item.\n2", "1 X 2 C 3");
    expect(r.grupos).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.anulados).toEqual([1]);
    expect(r.avisos).toEqual(["O item 2 está sem texto.", "Números sem resposta ignorados no gabarito: 3."]);
  });
});

describe("faixas", () => {
  it("resume listas de números", () => {
    expect(faixas([])).toBe("");
    expect(faixas([7])).toBe("7");
    expect(faixas([10, 9])).toBe("9 e 10");
    expect(faixas([1, 2, 3, 7, 9, 10])).toBe("1 a 3, 7, 9 e 10");
  });
});

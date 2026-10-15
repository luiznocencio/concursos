import { describe, expect, it } from "vitest";
import { lerGabarito } from "./gabarito";

const lista = (texto: string) => Object.fromEntries(lerGabarito(texto).respostas);

describe("lerGabarito", () => {
  it("lê pares número e resposta numa linha só", () => {
    expect(lista("1 C 2 E 3 X 4 C")).toEqual({ 1: "C", 2: "E", 3: "X", 4: "C" });
    expect(lerGabarito("1 C 2 E 3 X 4 C").problemas).toEqual([]);
  });

  it("lê uma resposta por linha com hífen, travessão, ponto ou dois-pontos", () => {
    expect(lista("01 - C\n02 – E\n03. C\n04: ANULADO\n05 E")).toEqual({ 1: "C", 2: "E", 3: "C", 4: "X", 5: "E" });
  });

  it("lê a tabela do Cebraspe com linha de itens e linha de gabarito", () => {
    const texto = `Item 1 2 3 4 5 6 7 8 9 10
Gabarito C E E C X E C C E E
Item 11 12 13 14 15 16 17 18 19 20
Gabarito E C C E C E E C X C`;
    const r = lerGabarito(texto);
    expect(r.problemas).toEqual([]);
    expect(r.respostas.size).toBe(20);
    expect(r.respostas.get(5)).toBe("X");
    expect(r.respostas.get(10)).toBe("E");
    expect(r.respostas.get(19)).toBe("X");
    expect(r.respostas.get(20)).toBe("C");
  });

  it("aceita CERTO, ERRADO, asterisco e anulado em qualquer caixa", () => {
    expect(lista("1 Certo 2 errado 3 * 4 Anulada")).toEqual({ 1: "C", 2: "E", 3: "X", 4: "X" });
  });

  it("ignora palavras do cabeçalho e o 'e' minúsculo", () => {
    expect(lista("Gabarito definitivo de português e matemática\n1 C\n2 E")).toEqual({ 1: "C", 2: "E" });
  });

  it("descarta números soltos antes da tabela e avisa", () => {
    const r = lerGabarito("CEBRASPE 2021 Cargo 1 SOLDADO\nItem 1 2 3\nGabarito C E C");
    expect(Object.fromEntries(r.respostas)).toEqual({ 1: "C", 2: "E", 3: "C" });
    expect(r.problemas).toEqual(["Números sem resposta ignorados no gabarito: 1."]);
  });

  it("avisa respostas sem número e números no fim sem resposta", () => {
    expect(lerGabarito("C E 1 C").problemas).toEqual(["Há 2 resposta(s) sem número no começo."]);
    expect(lerGabarito("1 C 2 E 3 4").problemas).toEqual(["Números sem resposta ignorados no gabarito: 3, 4."]);
    expect(lerGabarito("1 2 3 C E C E E").problemas).toEqual(["Há 2 resposta(s) sem número depois do item 3."]);
    expect(lista("1 2 3 C E C E E")).toEqual({ 1: "C", 2: "E", 3: "C" });
  });

  it("deixa de fora item com respostas conflitantes e aceita repetição igual", () => {
    const r = lerGabarito("1 C 2 E 1 E 2 E");
    expect(Object.fromEntries(r.respostas)).toEqual({ 2: "E" });
    expect(r.problemas).toEqual(["O item 1 aparece com respostas diferentes no gabarito e foi deixado de fora."]);
  });

  it("avisa gabarito vazio", () => {
    expect(lerGabarito("   ")).toEqual({ respostas: new Map(), problemas: ["Nenhuma resposta encontrada no gabarito."] });
  });
});

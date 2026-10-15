import { describe, expect, it } from "vitest";
import { analisarProva } from "./prova";

const PORTUGUES = `Texto CB1A1-I

O Corpo de Bombeiros Militar tem por missão a proteção da vida,
do patrimônio e do meio ambiente.
Suas atividades incluem a prevenção e o combate a incêndios.

Internet: <www.exemplo.gov.br> (com adaptações).

Julgue os itens a seguir, relativos às ideias e aos aspectos linguísticos do texto CB1A1-I.

1 Infere-se do texto que a proteção do meio ambiente é uma das missões
do Corpo de Bombeiros Militar.
2 O emprego da vírgula após "vida" é obrigatório.
3 A forma verbal "incluem" concorda com "Suas atividades".

Julgue os itens subsequentes, a respeito de noções de informática.

4 No Windows 10, o atalho Ctrl + C copia o item selecionado.
5 O protocolo HTTPS dispensa o uso de certificados digitais.`;

describe("analisarProva", () => {
  it("separa textos-base e comandos dos itens numerados, juntando linhas quebradas", () => {
    const r = analisarProva(PORTUGUES);
    expect(r.avisos).toEqual([]);
    expect(r.grupos).toHaveLength(2);
    expect(r.grupos[0].textoBase).toBe(
      "Texto CB1A1-I\n\n" +
        "O Corpo de Bombeiros Militar tem por missão a proteção da vida, do patrimônio e do meio ambiente. Suas atividades incluem a prevenção e o combate a incêndios.\n\n" +
        "Internet: <www.exemplo.gov.br> (com adaptações).\n\n" +
        "Julgue os itens a seguir, relativos às ideias e aos aspectos linguísticos do texto CB1A1-I.",
    );
    expect(r.grupos[0].itens).toEqual([
      { numero: 1, enunciado: "Infere-se do texto que a proteção do meio ambiente é uma das missões do Corpo de Bombeiros Militar." },
      { numero: 2, enunciado: 'O emprego da vírgula após "vida" é obrigatório.' },
      { numero: 3, enunciado: 'A forma verbal "incluem" concorda com "Suas atividades".' },
    ]);
    expect(r.grupos[1]).toEqual({
      textoBase: "Julgue os itens subsequentes, a respeito de noções de informática.",
      itens: [
        { numero: 4, enunciado: "No Windows 10, o atalho Ctrl + C copia o item selecionado." },
        { numero: 5, enunciado: "O protocolo HTTPS dispensa o uso de certificados digitais." },
      ],
    });
  });

  it("aceita número com ponto, parêntese ou travessão e número sozinho na linha", () => {
    const r = analisarProva(`Julgue os itens.
31. Primeiro item.
32) Segundo item.
33 – Terceiro item.
34
Quarto item, com o número na linha de cima.`);
    expect(r.grupos[0].itens.map((i) => `${i.numero}:${i.enunciado}`)).toEqual([
      "31:Primeiro item.",
      "32:Segundo item.",
      "33:Terceiro item.",
      "34:Quarto item, com o número na linha de cima.",
    ]);
  });

  it("ignora a numeração de linhas do texto-base (1, 4, 7...)", () => {
    const r = analisarProva(`Texto CB2A1
1 A prevenção de incêndios começa
pela educação da população, que precisa
conhecer os riscos domésticos.
4 Extintores devem estar sinalizados
e desobstruídos.
Julgue os itens seguintes, relativos ao texto CB2A1.
1 O texto defende a educação preventiva.
2 Segundo o texto, extintores podem ficar obstruídos.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].textoBase).toContain("1 A prevenção de incêndios começa");
    expect(r.grupos[0].textoBase).toContain("4 Extintores devem estar sinalizados");
    expect(r.grupos[0].itens.map((i) => i.numero)).toEqual([1, 2]);
  });

  it("não confunde número no meio do enunciado ou ano no começo da linha com item", () => {
    const r = analisarProva(`Julgue os itens.
10 A Constituição Federal de
1988 assegura o direito de petição.
11 São necessários
3 servidores para compor a comissão, segundo a lei.`);
    expect(r.grupos[0].itens).toEqual([
      { numero: 10, enunciado: "A Constituição Federal de 1988 assegura o direito de petição." },
      { numero: 11, enunciado: "São necessários 3 servidores para compor a comissão, segundo a lei." },
    ]);
  });

  it("começa novo texto-base quando a linha abre um comando, mesmo sem linha em branco", () => {
    const r = analisarProva(`Julgue os itens a seguir.
1 Item de português.
Considerando a Lei n.º 5.346/1992, julgue os itens.
2 Item de legislação.`);
    expect(r.grupos.map((g) => g.textoBase)).toEqual(["Julgue os itens a seguir.", "Considerando a Lei n.º 5.346/1992, julgue os itens."]);
    expect(r.grupos[1].itens).toEqual([{ numero: 2, enunciado: "Item de legislação." }]);
  });

  it("continua o item quando a linha quebrada começa com palavra de comando em minúscula ou sem ponto antes", () => {
    const r = analisarProva(`Julgue os itens.
1 Infere-se do
texto CB1A1-I que a brigada chegou cedo.
2 Os dados constam da
Tabela 2 do relatório.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].itens.map((i) => i.enunciado)).toEqual([
      "Infere-se do texto CB1A1-I que a brigada chegou cedo.",
      "Os dados constam da Tabela 2 do relatório.",
    ]);
  });

  it("aceita itens sem texto-base e avisa os saltos na numeração", () => {
    const r = analisarProva(`1 Primeiro.
2 Segundo.
3 Terceiro.

6 Sexto.
7 Sétimo.
8 Oitavo.
10 Décimo.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].textoBase).toBeNull();
    expect(r.grupos[0].itens.map((i) => i.numero)).toEqual([1, 2, 3, 6, 7, 8, 10]);
    expect(r.avisos).toEqual(["Faltam os itens 4 a 5 na sequência.", "Falta o item 9 na sequência."]);
  });

  it("normaliza quebras do Windows, espaços duros e espaços repetidos", () => {
    const r = analisarProva("Julgue os itens.\r\n1\u00a0Item   com\tespaços.\r\n2 Outro item.\r\n");
    expect(r.grupos[0].itens.map((i) => i.enunciado)).toEqual(["Item com espaços.", "Outro item."]);
  });

  it("avisa quando sobra texto depois do último item e quando não há itens", () => {
    const r = analisarProva(`1 Único item.

CEBRASPE – CBM-AL – Aplicação: 2021`);
    expect(r.grupos[0].itens).toHaveLength(1);
    expect(r.avisos).toEqual(['Texto depois do último item foi ignorado: "CEBRASPE – CBM-AL – Aplicação: 2021"']);
    expect(analisarProva("Só um texto, sem itens.")).toEqual({ grupos: [], avisos: ["Nenhum item numerado encontrado."] });
  });

  it("avisa item numerado sem texto", () => {
    const r = analisarProva("1 Primeiro.\n2");
    expect(r.grupos[0].itens).toEqual([
      { numero: 1, enunciado: "Primeiro." },
      { numero: 2, enunciado: "" },
    ]);
    expect(r.avisos).toEqual(["O item 2 está sem texto."]);
  });
});

import { describe, expect, it } from "vitest";
import { mensagemDoBanco, passosDoAndamento, resumoDoTema, rotuloStatus, segmentosDaLinha, validarFoto } from "./redacao";

describe("rotuloStatus", () => {
  it("traduz os estados da redação", () => {
    expect(rotuloStatus("na_fila")).toEqual({ texto: "Em correção", tom: "alerta" });
    expect(rotuloStatus("corrigindo")).toEqual({ texto: "Em correção", tom: "alerta" });
    expect(rotuloStatus("corrigida")).toEqual({ texto: "Corrigida", tom: "azul" });
    expect(rotuloStatus("falhou")).toEqual({ texto: "Falhou", tom: "erro" });
  });
});

describe("passosDoAndamento", () => {
  it("mostra as três etapas e marca as concluídas", () => {
    expect(passosDoAndamento("corrigindo", ["conteudo_1", "lingua"])).toEqual([
      { nome: "Banca 1 avaliando o conteúdo", feito: true },
      { nome: "Banca 2 avaliando o conteúdo", feito: false },
      { nome: "Revisão de língua portuguesa", feito: true },
    ]);
  });

  it("acrescenta a terceira correção quando as três primeiras terminaram", () => {
    const passos = passosDoAndamento("corrigindo", ["conteudo_1", "conteudo_2", "lingua"]);
    expect(passos.at(-1)).toEqual({ nome: "Terceira correção (as bancas divergiram)", feito: false });
  });

  it("na transcrição, um passo só", () => {
    expect(passosDoAndamento("transcrevendo", [])).toEqual([{ nome: "Lendo a foto da folha", feito: false }]);
  });
});

describe("segmentosDaLinha", () => {
  it("marca os trechos com o número do erro, ignorando caixa", () => {
    expect(segmentosDaLinha("Os bombeiros chegou cedo a festa.", [
      { numero: 1, trecho: "BOMBEIROS CHEGOU" },
      { numero: 2, trecho: "a festa" },
    ])).toEqual([
      { texto: "Os ", erro: null },
      { texto: "bombeiros chegou", erro: 1 },
      { texto: " cedo ", erro: null },
      { texto: "a festa", erro: 2 },
      { texto: ".", erro: null },
    ]);
  });

  it("não sobrepõe marcas: o mesmo trecho repetido marca a próxima ocorrência", () => {
    expect(segmentosDaLinha("tem e tem", [{ numero: 1, trecho: "tem" }, { numero: 2, trecho: "tem" }]).map((s) => s.erro)).toEqual([
      1, null, 2,
    ]);
  });

  it("linha sem erros (ou com trecho não encontrado) fica inteira", () => {
    expect(segmentosDaLinha("Texto.", [{ numero: 1, trecho: "xyz" }])).toEqual([{ texto: "Texto.", erro: null }]);
    expect(segmentosDaLinha("", [])).toEqual([{ texto: "", erro: null }]);
  });
});

describe("mensagemDoBanco", () => {
  it("explica os limites e cai numa mensagem genérica", () => {
    expect(mensagemDoBanco("limite_simultaneas")).toMatch(/2 redações em correção/);
    expect(mensagemDoBanco("limite_diario")).toMatch(/10 correções por dia/);
    expect(mensagemDoBanco("redação não pode ser entregue no estado corrigida")).toMatch(/já foi entregue/);
    expect(mensagemDoBanco("erro qualquer")).toMatch(/Verifique a conexão/);
  });
});

describe("validarFoto", () => {
  it("aceita JPEG, PNG e WebP até 15 MB", () => {
    expect(validarFoto({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validarFoto({ type: "image/heic", size: 1000 })).toMatch(/JPEG, PNG ou WebP/);
    expect(validarFoto({ type: "image/png", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });
});

describe("resumoDoTema", () => {
  it("usa o que vem depois de \"tema:\" e corta o ponto final", () => {
    expect(resumoDoTema("Considerando que os textos têm caráter motivador, redija um texto acerca do tema: OS DESASTRES CLIMÁTICOS.\nAborde: 1 ...")).toBe(
      "OS DESASTRES CLIMÁTICOS",
    );
  });

  it("sem \"tema:\", usa o enunciado e limita a 160 caracteres", () => {
    expect(resumoDoTema("Prevenção de incêndios")).toBe("Prevenção de incêndios");
    expect(resumoDoTema("x".repeat(200))).toHaveLength(158);
  });
});

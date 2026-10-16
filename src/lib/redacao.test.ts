import { describe, expect, it } from "vitest";
import {
  escolherTemaDoSimulado,
  mensagemDoBanco,
  passosDoAndamento,
  resumoDasRedacoes,
  resumoDoTema,
  rotuloStatus,
  segmentosDaLinha,
  validarFoto,
} from "./redacao";

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

describe("resumoDasRedacoes", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const red = (id: string, npd: number | null, quando: string | null, status = "corrigida") => ({ id, status, npd, corrigidaEm: quando });

  it("última nota, média das 5 últimas e pontos em ordem cronológica", () => {
    const r = resumoDasRedacoes(
      [
        red("f", 20, "2026-10-19T00:00:00Z"),
        red("a", 10, "2026-10-01T00:00:00Z"),
        red("b", 12, "2026-10-02T00:00:00Z"),
        red("c", 14, "2026-10-03T00:00:00Z"),
        red("d", 16, "2026-10-04T00:00:00Z"),
        red("e", 18, "2026-10-05T00:00:00Z"),
        red("x", null, null, "na_fila"),
      ],
      [],
      agora,
    );
    expect(r.ultima).toBe(20);
    expect(r.media).toBe(16);
    expect(r.pontos.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("sem redação corrigida, sem nota", () => {
    expect(resumoDasRedacoes([red("x", null, null, "rascunho")], [], agora)).toMatchObject({ ultima: null, media: null, pontos: [] });
  });

  it("conta as categorias de erro dos últimos 30 dias, mais frequentes primeiro", () => {
    const e = (categoria: string, criadoEm: string) => ({ categoria, criadoEm });
    const r = resumoDasRedacoes(
      [],
      [e("crase", "2026-10-19T00:00:00Z"), e("concordancia", "2026-10-18T00:00:00Z"), e("crase", "2026-10-10T00:00:00Z"), e("regencia", "2026-08-01T00:00:00Z")],
      agora,
    );
    expect(r.categorias).toEqual([
      { categoria: "crase", rotulo: "crase", canonico: "portugues/crase", n: 2 },
      { categoria: "concordancia", rotulo: "concordância", canonico: "portugues/concordancia-verbal-e-nominal", n: 1 },
    ]);
  });
});

describe("escolherTemaDoSimulado", () => {
  const t = (id: string, origem: string, feito: boolean) => ({ id, origem, feito });

  it("prefere tema real não feito, depois gerado não feito, depois qualquer um", () => {
    expect(escolherTemaDoSimulado([t("g", "gerado", false), t("r", "real", false)])?.id).toBe("r");
    expect(escolherTemaDoSimulado([t("r", "real", true), t("g", "gerado", false)])?.id).toBe("g");
    expect(escolherTemaDoSimulado([t("r", "real", true)])?.id).toBe("r");
    expect(escolherTemaDoSimulado([])).toBeNull();
  });
});

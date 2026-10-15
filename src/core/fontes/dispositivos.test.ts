import { describe, expect, it } from "vitest";
import { dividirEmArtigos, janelaDeDispositivos } from "./dispositivos";

const LEI = `LEI Nº 1, DE 2000
Dispõe sobre algo.
Art. 1º Esta lei regula o serviço.
Parágrafo único. Aplica-se a todos.
Art. 2º São deveres:
I - zelar;
II - cumprir.
Art. 2º-A Incluído depois.
Art. 10. Revogam-se as disposições em contrário.`;

describe("dividirEmArtigos", () => {
  it("separa os artigos com parágrafos e incisos", () => {
    const artigos = dividirEmArtigos(LEI);
    expect(artigos.map((a) => a.referencia)).toEqual(["art. 1", "art. 2", "art. 2-A", "art. 10"]);
    expect(artigos[0].texto).toBe("Art. 1º Esta lei regula o serviço.\nParágrafo único. Aplica-se a todos.");
    expect(artigos[1].texto).toContain("II - cumprir.");
  });

  it("não confunde remissão no começo da linha com início de artigo", () => {
    const artigos = dividirEmArtigos(`Art. 47. A exclusão se faz por:
I - reforma.
Art. 48. O militar enquadrado em um dos incisos do
art. 47, será afastado do cargo.
Art. 49, caput, citado no começo da linha.
Art. 31-A. Incluído por lei posterior.`);
    expect(artigos.map((a) => a.referencia)).toEqual(["art. 47", "art. 48", "art. 31-A"]);
    expect(artigos[1].texto).toBe(
      "Art. 48. O militar enquadrado em um dos incisos do\nart. 47, será afastado do cargo.\nArt. 49, caput, citado no começo da linha.",
    );
  });

  it("ignora o preâmbulo e referências repetidas", () => {
    const artigos = dividirEmArtigos(`${LEI}\nArt. 1º Texto repetido de outra lei citada.`);
    expect(artigos).toHaveLength(4);
    expect(artigos[0].texto).not.toContain("LEI Nº");
  });
});

describe("janelaDeDispositivos", () => {
  const ds = Array.from({ length: 10 }, (_, i) => ({ referencia: `art. ${i + 1}`, texto: "" }));

  it("devolve tudo quando cabe na janela", () => {
    expect(janelaDeDispositivos(ds.slice(0, 3), 5, 8)).toHaveLength(3);
  });

  it("desloca a janela a cada rodada, de forma circular", () => {
    expect(janelaDeDispositivos(ds, 0, 4).map((d) => d.referencia)).toEqual(["art. 1", "art. 2", "art. 3", "art. 4"]);
    expect(janelaDeDispositivos(ds, 2, 4).map((d) => d.referencia)).toEqual(["art. 9", "art. 10", "art. 1", "art. 2"]);
  });
});

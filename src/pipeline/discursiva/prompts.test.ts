import { describe, expect, it } from "vitest";
import { promptAvaliarTema, promptConteudo, promptLingua, promptTema, promptTranscricao, type TemaParaPrompt } from "./prompts";

const tema: TemaParaPrompt = {
  enunciado: "Prevenção de desastres",
  textosApoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "Adaptado" }],
  padrao: { aspectos: [{ codigo: "2.1", descricao: "Causas", pontos: 13.5 }], expectativas: "Citar causas." },
};

describe("prompts da discursiva", () => {
  it("conteúdo: tema, padrão com pontuação e linhas numeradas", () => {
    const p = promptConteudo({ tema, linhas: ["Primeira linha.", ""] });
    expect(p).toContain("Prevenção de desastres");
    expect(p).toContain("- Texto I: Dados. (Adaptado)");
    expect(p).toContain("- [2.1] Causas (0 a 13.5 pontos)");
    expect(p).toContain("01| Primeira linha.\n02| ");
    expect(p).not.toContain("terceiro examinador");
    expect(promptConteudo({ tema, linhas: ["x"], variante: "terceira" })).toContain("terceiro examinador");
  });

  it("língua: lista as categorias fechadas com rótulo", () => {
    const p = promptLingua({ linhas: ["Texto."] });
    expect(p).toContain("- concordancia: concordância");
    expect(p).toContain("- propriedade_vocabular: propriedade vocabular");
    expect(p).toContain("01| Texto.");
  });

  it("transcrição, tema e avaliação levam os limites do edital", () => {
    expect(promptTranscricao({ linhasMax: 30 })).toContain("até no máximo 30 linhas");
    const t = promptTema({
      banca: "cebraspe",
      concurso: "CBM-AL",
      disciplina: "Atualidades",
      programa: "Temas atuais",
      pontuacaoMaxima: 30,
      linhasMax: 30,
      temasRecentes: ["Tema velho"],
    });
    expect(t).toContain("com 3 pontos");
    expect(t).toContain("é exatamente 30");
    expect(t).toContain("- Tema velho");
    expect(promptAvaliarTema({ tema, pontuacaoMaxima: 30 })).toContain("as pontuações somam 30");
  });
});

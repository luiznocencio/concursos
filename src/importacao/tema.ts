// Tema real de prova discursiva digitado pelo moderador: enunciado, textos de apoio, padrão de resposta.

export interface CamposTema {
  provaOrigem: string;
  enunciado: string;
  textosApoio: string;
  padrao: string;
  expectativas: string;
}

export interface TemaReal {
  enunciado: string;
  textos_apoio: { titulo: string; texto: string; fonte: string }[];
  padrao_resposta: { aspectos: { codigo: string; descricao: string; pontos: number }[]; expectativas: string };
}

export type LeituraTema = { ok: true; provaOrigem: string; tema: TemaReal } | { ok: false; erros: string[] };

// Blocos separados por linha em branco. "Texto I" (ou "Texto 1") na primeira linha vira o título;
// uma última linha "Fonte: ..." vira a fonte.
export function lerTextosApoio(texto: string): TemaReal["textos_apoio"] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((linhas) => linhas.length > 0)
    .map((linhas, i) => {
      const titulo = /^texto\s+[ivxlc\d]+\b/i.test(linhas[0]) && linhas.length > 1 ? linhas.shift()! : `Texto ${i + 1}`;
      const fonte = linhas.length > 1 && /^fonte:/i.test(linhas[linhas.length - 1]) ? linhas.pop()!.replace(/^fonte:\s*/i, "") : "";
      return { titulo, texto: linhas.join("\n"), fonte };
    });
}

// Uma linha por aspecto: "código | descrição | pontos" (pontos com vírgula ou ponto).
export function lerPadrao(texto: string): { aspectos: TemaReal["padrao_resposta"]["aspectos"]; erros: string[] } {
  const aspectos: TemaReal["padrao_resposta"]["aspectos"] = [];
  const erros: string[] = [];
  texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) => {
      const partes = linha.split("|").map((p) => p.trim());
      const pontos = Number((partes[2] ?? "").replace(",", "."));
      if (partes.length !== 3 || !partes[0] || !partes[1] || !(pontos > 0)) {
        erros.push(`Linha ${i + 1} do padrão de resposta: use "código | descrição | pontos".`);
        return;
      }
      aspectos.push({ codigo: partes[0], descricao: partes[1], pontos });
    });
  return { aspectos, erros };
}

export function lerTemaReal(c: CamposTema, pontuacaoMaxima: number): LeituraTema {
  const erros: string[] = [];
  const provaOrigem = c.provaOrigem.trim();
  const enunciado = c.enunciado.trim();
  if (!provaOrigem) erros.push("Informe a prova de origem (ex.: CEBRASPE 2021 · CBM-AL · Soldado).");
  if (!enunciado) erros.push("Informe o enunciado da proposta.");
  const { aspectos, erros: errosPadrao } = lerPadrao(c.padrao);
  erros.push(...errosPadrao);
  if (errosPadrao.length === 0) {
    if (aspectos.length < 2) erros.push("O padrão de resposta precisa de pelo menos 2 aspectos.");
    if (new Set(aspectos.map((a) => a.codigo)).size !== aspectos.length) erros.push("Há códigos de aspecto repetidos.");
    const soma = aspectos.reduce((s, a) => s + a.pontos, 0);
    if (Math.abs(soma - pontuacaoMaxima) > 0.01) {
      erros.push(`Os pontos do padrão somam ${soma.toLocaleString("pt-BR")}, mas a prova vale ${pontuacaoMaxima}.`);
    }
  }
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    provaOrigem,
    tema: {
      enunciado,
      textos_apoio: lerTextosApoio(c.textosApoio),
      padrao_resposta: { aspectos, expectativas: c.expectativas.trim() },
    },
  };
}

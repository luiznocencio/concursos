import type { CategoriaErro, ErroLingua } from "./tipos";

// Cada categoria de erro leva a um tópico canônico de Língua Portuguesa do edital.
export const CANONICO_POR_CATEGORIA: Record<CategoriaErro, string> = {
  ortografia: "portugues/ortografia",
  acentuacao: "portugues/ortografia",
  hifen: "portugues/ortografia",
  concordancia: "portugues/concordancia-verbal-e-nominal",
  regencia: "portugues/regencia-verbal-e-nominal",
  crase: "portugues/crase",
  pontuacao: "portugues/pontuacao",
  colocacao_pronominal: "portugues/colocacao-pronominal",
  tempos_modos_verbais: "portugues/tempos-e-modos-verbais",
  coesao_conectores: "portugues/coesao-referenciacao-conectores",
  classes_de_palavras: "portugues/classes-de-palavras",
  coordenacao: "portugues/coordenacao",
  subordinacao: "portugues/subordinacao",
  propriedade_vocabular: "portugues/significacao-das-palavras",
};

export const ROTULO_CATEGORIA: Record<CategoriaErro, string> = {
  ortografia: "ortografia",
  acentuacao: "acentuação",
  hifen: "uso do hífen",
  concordancia: "concordância",
  regencia: "regência",
  crase: "crase",
  pontuacao: "pontuação",
  colocacao_pronominal: "colocação pronominal",
  tempos_modos_verbais: "tempos e modos verbais",
  coesao_conectores: "coesão e conectores",
  classes_de_palavras: "classes de palavras",
  coordenacao: "coordenação",
  subordinacao: "subordinação",
  propriedade_vocabular: "propriedade vocabular",
};

function normalizar(s: string): string {
  return s.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export interface ErrosFiltrados {
  validos: ErroLingua[];
  descartados: number;
}

/**
 * Mantém só os erros que apontam uma linha escrita e um trecho que existe nela;
 * repetições (mesma linha, trecho e categoria) contam uma vez. NE = validos.length.
 */
export function filtrarErrosValidos(erros: ErroLingua[], linhas: string[]): ErrosFiltrados {
  const vistos = new Set<string>();
  const validos: ErroLingua[] = [];
  for (const e of erros) {
    const linha = Number.isInteger(e.linha) ? linhas[e.linha - 1] : undefined;
    const trecho = normalizar(e.trecho);
    if (linha === undefined || e.linha < 1 || trecho === "" || !normalizar(linha).includes(trecho)) continue;
    const chave = `${e.linha}|${trecho}|${e.categoria}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    validos.push(e);
  }
  return { validos, descartados: erros.length - validos.length };
}

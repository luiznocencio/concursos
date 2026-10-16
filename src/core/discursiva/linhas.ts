export interface Folha {
  linhas: string[];
  excedente: string[];
}

/**
 * Distribui o texto digitado pelas linhas da folha, quebrando por palavra.
 * Cada quebra de linha do texto começa uma linha nova (parágrafo); linhas em branco são mantidas.
 * Palavra maior que a linha é cortada. O que passar de `linhasMax` vai para `excedente`,
 * que não é corrigido (edital, 9.7.5, alínea c).
 */
export function distribuirEmLinhas(texto: string, caracteresPorLinha: number, linhasMax: number): Folha {
  const todas: string[] = [];
  const paragrafos = texto.replace(/\r\n?/g, "\n").split("\n");
  for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(/\s+/).filter((p) => p !== "");
    let atual = "";
    for (let palavra of palavras) {
      while (palavra.length > caracteresPorLinha) {
        if (atual !== "") {
          todas.push(atual);
          atual = "";
        }
        todas.push(palavra.slice(0, caracteresPorLinha));
        palavra = palavra.slice(caracteresPorLinha);
      }
      if (palavra === "") continue;
      if (atual === "") atual = palavra;
      else if (atual.length + 1 + palavra.length <= caracteresPorLinha) atual += ` ${palavra}`;
      else {
        todas.push(atual);
        atual = palavra;
      }
    }
    todas.push(atual);
  }
  // O último Enter não cria uma linha em branco no fim da folha.
  while (todas.length > 0 && todas[todas.length - 1] === "") todas.pop();
  return { linhas: todas.slice(0, linhasMax), excedente: todas.slice(linhasMax) };
}

// TL: linhas efetivamente escritas (edital, 9.7.5, alínea d).
export function contarTL(linhas: string[]): number {
  return linhas.filter((l) => l.trim() !== "").length;
}

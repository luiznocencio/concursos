export interface PrecoModelo {
  entradaUsdPorMTok: number;
  saidaUsdPorMTok: number;
  cacheLeituraUsdPorMTok: number;
}

// Preços da API da Anthropic (USD por milhão de tokens). Escrita em cache custa 1,25× a entrada.
export const PRECOS_CLAUDE: Record<string, PrecoModelo> = {
  "claude-opus-5-5": { entradaUsdPorMTok: 4, saidaUsdPorMTok: 20, cacheLeituraUsdPorMTok: 0.2 },
  "claude-sonnet-5-5": { entradaUsdPorMTok: 2, saidaUsdPorMTok: 10, cacheLeituraUsdPorMTok: 0.2 },
  "claude-haiku-5-5": { entradaUsdPorMTok: 0.1, saidaUsdPorMTok: 0.5, cacheLeituraUsdPorMTok: 0.01 },
};

export interface TokensCobrados {
  entrada: number;
  saida: number;
  escritaCache?: number;
  leituraCache?: number;
}

export function custoUsd(preco: PrecoModelo, t: TokensCobrados): number {
  const centavosPorMilhao =
    t.entrada * preco.entradaUsdPorMTok +
    (t.escritaCache ?? 0) * preco.entradaUsdPorMTok * 1.25 +
    (t.leituraCache ?? 0) * preco.cacheLeituraUsdPorMTok +
    t.saida * preco.saidaUsdPorMTok;
  return centavosPorMilhao / 1_000_000;
}

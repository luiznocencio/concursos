// Modo produto (spec §5.3): com ITENS_REAIS_VISIVEIS=false, itens reais de provas anteriores não
// entram nas sessões e servem só como referência de estilo do gerador. Padrão: visíveis (uso pessoal).
export function itensReaisVisiveis(env: Record<string, string | undefined> = process.env): boolean {
  const valor = env.ITENS_REAIS_VISIVEIS?.trim().toLowerCase();
  return !["false", "0", "nao", "não", "off"].includes(valor ?? "");
}

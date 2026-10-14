const ROTAS_PUBLICAS = ["/entrar", "/auth/callback"];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

export function destinoSeguro(proximo: string | null | undefined): string {
  if (!proximo || !proximo.startsWith("/") || proximo.startsWith("//") || proximo.startsWith("/\\")) return "/";
  return proximo;
}

export function emailPermitido(email: string, lista: string | undefined): boolean {
  const permitidos = (lista ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return permitidos.includes(email.trim().toLowerCase());
}

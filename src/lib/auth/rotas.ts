// /api/jobs tem autenticação própria (segredo do worker).
const ROTAS_PUBLICAS = ["/entrar", "/auth/callback", "/api/jobs"];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

// Cookie que guarda o destino pedido antes do login enquanto o link mágico vai e volta.
export const COOKIE_PROXIMO = "proximo_login";

// Se o Supabase devolver o código de login fora de /auth/callback (por exemplo, na URL padrão
// do site quando o redirecionamento pedido não está na lista permitida), leva-o ao callback.
export function encaminharCodigo(url: URL): URL | null {
  const code = url.searchParams.get("code");
  if (!code || url.pathname === "/auth/callback") return null;
  const destino = new URL("/auth/callback", url);
  destino.searchParams.set("code", code);
  return destino;
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

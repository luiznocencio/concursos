// Tema da interface. "sistema" segue prefers-color-scheme; "claro" e "escuro" fixam a escolha.
// A escolha fica num cookie para o servidor já renderizar <html data-tema> certo, sem piscar.
export const TEMAS = ["claro", "escuro", "sistema"] as const;
export type Tema = (typeof TEMAS)[number];

export const COOKIE_TEMA = "tema";
const UM_ANO = 60 * 60 * 24 * 365;

export function lerTema(valor: string | undefined | null): Tema {
  return TEMAS.includes(valor as Tema) ? (valor as Tema) : "sistema";
}

export function cookieDoTema(tema: Tema): string {
  return `${COOKIE_TEMA}=${tema}; path=/; max-age=${UM_ANO}; samesite=lax`;
}

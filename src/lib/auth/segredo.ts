import { timingSafeEqual } from "node:crypto";

// Compara "Authorization: Bearer <segredo>" em tempo constante.
export function bearerValido(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho) return false;
  const recebido = Buffer.from(cabecalho);
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}

import { createHash } from "node:crypto";

// Remove acentos, pontuação, caixa e espaços extras para que pequenas variações não escapem da deduplicação.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function hashNormalizado(enunciado: string, textoBase: string | null): string {
  const base = `${normalizarTexto(textoBase ?? "")}|${normalizarTexto(enunciado)}`;
  return createHash("sha256").update(base).digest("hex");
}

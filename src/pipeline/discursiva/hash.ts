import { createHash } from "node:crypto";

// Mesmo hash da função SQL discursiva_importar_temas: md5(lower(regexp_replace(trim(enunciado), '\s+', ' ', 'g'))).
export function hashTema(enunciado: string): string {
  return createHash("md5").update(enunciado.trim().replace(/\s+/g, " ").toLowerCase()).digest("hex");
}

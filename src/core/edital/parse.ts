import { parse } from "yaml";
import { editalSchema, type Edital } from "./schema";

export class EditalInvalidoError extends Error {
  constructor(public readonly problemas: string[]) {
    super(`edital.yaml inválido:\n${problemas.join("\n")}`);
    this.name = "EditalInvalidoError";
  }
}

export function parseEdital(texto: string): Edital {
  const resultado = editalSchema.safeParse(parse(texto));
  if (!resultado.success) {
    throw new EditalInvalidoError(
      resultado.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
    );
  }
  return resultado.data;
}

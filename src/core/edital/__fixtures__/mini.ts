import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEdital } from "../parse";
import type { Edital } from "../schema";

export function textoMini(): string {
  return readFileSync(fileURLToPath(new URL("./mini.yaml", import.meta.url)), "utf8");
}

export function editalMini(): Edital {
  return parseEdital(textoMini());
}

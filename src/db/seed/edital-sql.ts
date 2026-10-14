import type { Edital } from "../../core/edital/schema";

// O SQL só chama public.carregar_edital (migração 0004), que faz os upserts no banco.
// Assim o seed fica pequeno o bastante para ser colado no SQL Editor ou enviado via MCP.
export function sqlDoEdital(e: Edital): string {
  const json = JSON.stringify(e).replaceAll("'", "''");
  return `select public.carregar_edital('${json}'::jsonb);\n`;
}

import { readFileSync } from "node:fs";
import { Client } from "pg";
import { DB_URL } from "./ambiente";

// globalSetup do Playwright: confere que o edital foi carregado e aplica e2e/banco/preparar.sql.
export default async function prepararBanco() {
  const client = new Client({ connectionString: DB_URL });
  try {
    await client.connect();
  } catch (e) {
    throw new Error(`Supabase local fora do ar em ${DB_URL}. Rode "npx supabase start" antes do E2E.`, { cause: e });
  }
  try {
    const { rows } = await client.query("select count(*)::int as n from public.cargos");
    if (rows[0].n === 0) {
      throw new Error('Nenhum cargo no banco local. Rode "npx supabase db reset" para aplicar migrações e seed.');
    }
    await client.query(readFileSync("e2e/banco/preparar.sql", "utf8"));
  } finally {
    await client.end();
  }
}

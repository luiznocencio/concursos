import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";

const URL_ADMIN = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54329/postgres";

export async function criarBancoDeTeste(): Promise<{ client: Client; destruir(): Promise<void> }> {
  const nome = `teste_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: URL_ADMIN });
  await admin.connect();
  await admin.query(`create database ${nome}`);

  const url = new URL(URL_ADMIN);
  url.pathname = `/${nome}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync("supabase/tests/stubs.sql", "utf8"));
  for (const arquivo of readdirSync("supabase/migrations").sort()) {
    await client.query(readFileSync(`supabase/migrations/${arquivo}`, "utf8"));
  }

  return {
    client,
    async destruir() {
      await client.end();
      await admin.query(`drop database ${nome}`);
      await admin.end();
    },
  };
}

export async function comoUsuario<T>(client: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}

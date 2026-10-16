// Ambiente dos testes E2E: Supabase local (`supabase start`) e o app em http://localhost:3100.
// As chaves vêm de `supabase status -o env` (ou das variáveis E2E_*), sem ficarem no repositório.
// Nunca aponte o E2E para o Supabase de produção.
import { execSync } from "node:child_process";

let status: Record<string, string> | undefined;

// Lê a saída `CHAVE="valor"` de `supabase status -o env`, só quando alguma variável E2E_* faltar.
function statusLocal(): Record<string, string> {
  if (status) return status;
  status = {};
  const cli = process.env.E2E_SUPABASE_CLI || "npx supabase";
  try {
    const saida = execSync(`${cli} status -o env`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    for (const linha of saida.split("\n")) {
      const m = /^([A-Z_]+)="?(.*?)"?$/.exec(linha.trim());
      if (m) status[m[1]] = m[2];
    }
  } catch {
    // Sem Supabase local de pé: os valores que dependem dele ficam vazios e o erro aparece adiante.
  }
  return status;
}

const PADRAO = {
  SUPABASE_URL: "http://127.0.0.1:54321",
  DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  MAILPIT_URL: "http://127.0.0.1:54324",
};

function env(nome: string, padrao: string): string {
  return process.env[nome] || padrao;
}

export const PORTA = Number(env("E2E_PORTA", "3100"));
export const BASE_URL = `http://localhost:${PORTA}`;

export const SUPABASE_URL = env("E2E_SUPABASE_URL", PADRAO.SUPABASE_URL);
export const PUBLISHABLE_KEY =
  process.env.E2E_SUPABASE_PUBLISHABLE_KEY || statusLocal().PUBLISHABLE_KEY || statusLocal().ANON_KEY || "";
export const SECRET_KEY =
  process.env.E2E_SUPABASE_SECRET_KEY || statusLocal().SECRET_KEY || statusLocal().SERVICE_ROLE_KEY || "";
if (!PUBLISHABLE_KEY || !SECRET_KEY) {
  throw new Error("Chaves do Supabase local não encontradas: rode `npx supabase start` ou defina E2E_SUPABASE_*_KEY");
}
export const DB_URL = env("E2E_DB_URL", PADRAO.DB_URL);
export const MAILPIT_URL = env("E2E_MAILPIT_URL", PADRAO.MAILPIT_URL);

// Único e-mail autorizado a pedir link pela tela /entrar (o teste do login completo usa este).
// Os demais testes criam a sessão direto pela API de administração do Auth local.
export const EMAIL_LOGIN = "login@e2e.example.com";

// Para evitar que o E2E toque em produção por engano.
for (const [nome, url] of [
  ["E2E_SUPABASE_URL", SUPABASE_URL],
  ["E2E_DB_URL", DB_URL],
] as const) {
  const host = new URL(url).hostname;
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error(`${nome} precisa apontar para o Supabase local, não para ${host}`);
  }
}

// Variáveis do app durante o E2E. As de IA ficam vazias de propósito: nenhum teste chama IA real,
// e valores vazios também impedem o Next de completar com o que houver num .env.local.
export const ENV_DO_APP: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: SECRET_KEY,
  AUTH_EMAILS_PERMITIDOS: EMAIL_LOGIN,
  MODERADORES_EMAILS: "",
  WORKER_SECRET: "e2e-worker-local",
  ANTHROPIC_API_KEY: "",
  CLAUDE_MODEL: "",
  CLAUDE_ESFORCO: "",
  OPENAI_API_KEY: "",
  OPENAI_MODEL: "",
  OPENAI_PRECO_ENTRADA_USD_MTOK: "",
  OPENAI_PRECO_SAIDA_USD_MTOK: "",
  ITENS_REAIS_VISIVEIS: "true",
};

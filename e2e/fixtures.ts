import { test as base, expect, type Page } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/db/types";
import { BASE_URL, PUBLISHABLE_KEY, SECRET_KEY, SUPABASE_URL } from "./ambiente";

export type Admin = SupabaseClient<Database>;

export interface Usuario {
  id: string;
  email: string;
}

function criarAdmin(): Admin {
  return createClient<Database>(SUPABASE_URL, SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Um e-mail novo por teste: cada um começa sem sessões, respostas nem pedidos de geração.
function emailUnico(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 30);
  return `${base}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.example.com`;
}

// Login sem e-mail: a chave de serviço local gera o link mágico, e o token dele é trocado por uma
// sessão com o mesmo cliente @supabase/ssr que o app usa. Os cookies que esse cliente grava são
// exatamente os que o proxy do app lê, e vão direto para o navegador do teste.
export async function entrarComo(page: Page, admin: Admin, email: string): Promise<Usuario> {
  const criado = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (criado.error && criado.error.code !== "email_exists") throw criado.error;

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;

  const gravados: { name: string; value: string }[] = [];
  const ssr = createServerClient<Database>(SUPABASE_URL, PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => gravados,
      setAll: (lista) => {
        for (const { name, value } of lista) {
          const i = gravados.findIndex((c) => c.name === name);
          if (i >= 0) gravados.splice(i, 1);
          if (value) gravados.push({ name, value });
        }
      },
    },
  });
  const { data, error } = await ssr.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (error || !data.user) throw error ?? new Error("verifyOtp não devolveu usuário");
  expect(gravados.length, "cookies de sessão do Supabase").toBeGreaterThan(0);

  await page.context().addCookies(
    gravados.map((c) => ({ ...c, url: BASE_URL, httpOnly: false, sameSite: "Lax" as const })),
  );
  return { id: data.user.id, email };
}

// Na tela /treinar, abre o bloco da disciplina e devolve-o (para escolher tópicos dentro dele).
export async function abrirDisciplina(page: Page, nome: string) {
  const bloco = page.locator("details").filter({ has: page.locator("summary").getByText(nome, { exact: true }) });
  await bloco.locator("summary").click();
  await expect(bloco.getByRole("checkbox").first()).toBeVisible();
  return bloco;
}

export const test = base.extend<{ admin: Admin; usuarioLogado: Usuario }>({
  admin: async ({}, usar) => {
    await usar(criarAdmin());
  },
  // Página já autenticada com um usuário novo. O teste recebe o id e o e-mail.
  usuarioLogado: async ({ page, admin }, usar, testInfo) => {
    await usar(await entrarComo(page, admin, emailUnico(testInfo.title)));
  },
});

export { expect };

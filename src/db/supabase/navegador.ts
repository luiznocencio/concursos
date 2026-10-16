import { createBrowserClient } from "@supabase/ssr";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

// Cliente do navegador (sessão nos cookies do usuário, com RLS). Usado só para enviar as fotos da redação ao Storage.
export function criarClienteNavegador() {
  const { url, chave } = lerEnvSupabase();
  return createBrowserClient<Database>(url, chave);
}

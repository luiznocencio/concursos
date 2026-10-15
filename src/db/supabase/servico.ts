import { createClient } from "@supabase/supabase-js";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

// Cliente com a chave secreta: ignora RLS. Use só no servidor (worker, scripts), nunca no navegador.
export function criarClienteServico() {
  const { url } = lerEnvSupabase();
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não configurada");
  return createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type ClienteServico = ReturnType<typeof criarClienteServico>;

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

export async function atualizarSessao(request: NextRequest): Promise<{ resposta: NextResponse; autenticado: boolean }> {
  const { url, chave } = lerEnvSupabase();
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { resposta, autenticado: user !== null };
}

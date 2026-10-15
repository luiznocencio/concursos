import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

export async function criarClienteServidor() {
  const { url, chave } = lerEnvSupabase();
  const store = await cookies();
  return createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy já renova a sessão.
        }
      },
    },
  });
}

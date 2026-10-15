import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// Os acessos literais a process.env.NEXT_PUBLIC_* são necessários para o Next embuti-los no bundle do cliente.
export function lerEnvSupabase(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): { url: string; chave: string } {
  const r = schema.safeParse(env);
  if (!r.success) {
    const campos = r.error.issues.map((i) => i.path.join("."));
    throw new Error(`Variáveis do Supabase ausentes ou inválidas: ${campos.join(", ")}`);
  }
  return { url: r.data.NEXT_PUBLIC_SUPABASE_URL, chave: r.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}

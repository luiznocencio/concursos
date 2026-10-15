import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { listarCargos } from "@/db/repositorios/estudo";
import { criarClienteServidor } from "@/db/supabase/server";
import { ehModerador } from "@/lib/auth/moderacao";

export const COOKIE_CARGO = "cargo";

// Uma vez por requisição: cliente do usuário, cargos disponíveis e o cargo escolhido (cookie).
export const contextoDoUsuario = cache(async () => {
  const db = await criarClienteServidor();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/entrar");
  const cargos = await listarCargos(db);
  const escolhido = (await cookies()).get(COOKIE_CARGO)?.value;
  const cargo = cargos.find((c) => c.id === escolhido) ?? cargos[0] ?? null;
  return { db, user, cargos, cargo, moderador: ehModerador(user.email) };
});

export async function exigirCargo() {
  const ctx = await contextoDoUsuario();
  if (!ctx.cargo) redirect("/?aviso=sem-concurso");
  return { ...ctx, cargo: ctx.cargo };
}

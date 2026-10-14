"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/db/supabase/server";

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

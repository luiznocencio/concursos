"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/db/supabase/server";
import { destinoSeguro, emailPermitido } from "@/lib/auth/rotas";

export async function enviarLinkMagico(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const proximo = destinoSeguro(String(formData.get("proximo") ?? ""));
  const voltar = (params: string) => redirect(`/entrar?${params}&proximo=${encodeURIComponent(proximo)}`);

  if (!/^\S+@\S+\.\S+$/.test(email)) voltar("erro=email");
  if (!emailPermitido(email, process.env.AUTH_EMAILS_PERMITIDOS)) voltar("erro=nao-autorizado");

  const origem = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent(proximo)}` },
  });
  voltar(error ? "erro=envio" : "enviado=1");
}

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/db/supabase/server";
import { COOKIE_PROXIMO, destinoSeguro, emailPermitido } from "@/lib/auth/rotas";

export async function enviarLinkMagico(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const proximo = destinoSeguro(String(formData.get("proximo") ?? ""));
  const voltar = (params: string) => redirect(`/entrar?${params}&proximo=${encodeURIComponent(proximo)}`);

  if (!/^\S+@\S+\.\S+$/.test(email)) voltar("erro=email");
  if (!emailPermitido(email, process.env.AUTH_EMAILS_PERMITIDOS)) voltar("erro=nao-autorizado");

  const origem = (await headers()).get("origin") ?? "http://localhost:3000";
  // O destino fica num cookie: o redirecionamento do e-mail precisa ser exatamente /auth/callback,
  // sem parâmetros, para bater com a lista de URLs permitidas do Supabase.
  (await cookies()).set(COOKIE_PROXIMO, proximo, {
    httpOnly: true,
    sameSite: "lax",
    secure: origem.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60,
  });
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origem}/auth/callback` },
  });
  voltar(error ? "erro=envio" : "enviado=1");
}

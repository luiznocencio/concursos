import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/db/supabase/server";
import { destinoSeguro } from "@/lib/auth/rotas";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const proximo = destinoSeguro(request.nextUrl.searchParams.get("proximo"));
  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(proximo, request.url));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", request.url));
}

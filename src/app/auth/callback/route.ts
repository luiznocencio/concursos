import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/db/supabase/server";
import { COOKIE_PROXIMO, destinoSeguro } from "@/lib/auth/rotas";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const store = await cookies();
  const proximo = destinoSeguro(store.get(COOKIE_PROXIMO)?.value);
  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      store.delete(COOKIE_PROXIMO);
      return NextResponse.redirect(new URL(proximo, request.url));
    }
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", request.url));
}

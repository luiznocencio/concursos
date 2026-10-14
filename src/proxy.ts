import { NextResponse, type NextRequest } from "next/server";
import { atualizarSessao } from "@/db/supabase/proxy";
import { rotaPublica } from "@/lib/auth/rotas";

export async function proxy(request: NextRequest) {
  const { resposta, autenticado } = await atualizarSessao(request);
  const { pathname, search } = request.nextUrl;
  if (!autenticado && !rotaPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    destino.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

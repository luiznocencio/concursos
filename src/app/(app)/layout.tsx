import Link from "next/link";
import { cookies } from "next/headers";
import { NavLink } from "@/components/nav-link";
import { SeletorTema } from "@/components/seletor-tema";
import { botao } from "@/components/ui";
import { COOKIE_TEMA, lerTema } from "@/lib/tema";
import { sair } from "../actions";
import { contextoDoUsuario } from "./contexto";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, moderador } = await contextoDoUsuario();
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-borda bg-papel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:gap-4">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Concursos
          </Link>
          <nav aria-label="Principal" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
            <NavLink href="/">Início</NavLink>
            <NavLink href="/treinar">Treinar</NavLink>
            <NavLink href="/simulado">Simulado</NavLink>
            <NavLink href="/painel">Painel</NavLink>
            {moderador && <NavLink href="/itens">Itens</NavLink>}
            {moderador && <NavLink href="/importar">Importar</NavLink>}
          </nav>
          <span className="hidden text-sm text-pedra md:inline">{user.email}</span>
          <SeletorTema inicial={tema} />
          <form action={sair}>
            <button type="submit" className={botao.texto}>
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-24">{children}</main>
    </div>
  );
}

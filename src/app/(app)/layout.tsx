import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { botao } from "@/components/ui";
import { sair } from "../actions";
import { contextoDoUsuario } from "./contexto";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, moderador } = await contextoDoUsuario();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-borda bg-papel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Concursos
          </Link>
          <nav aria-label="Principal" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
            <NavLink href="/">Início</NavLink>
            <NavLink href="/treinar">Treinar</NavLink>
            <NavLink href="/simulado">Simulado</NavLink>
            <NavLink href="/painel">Painel</NavLink>
            {moderador && <NavLink href="/itens">Itens</NavLink>}
          </nav>
          <span className="hidden text-sm text-pedra md:inline">{user.email}</span>
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

"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Indicador } from "./carregando";

// Marca o item clicado enquanto a página nova carrega (a resposta ao clique é imediata).
function Andamento() {
  const { pending } = useLinkStatus();
  return pending ? <Indicador tamanho={12} className="ml-1.5" /> : null;
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = usePathname();
  const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
        ativo ? "bg-tinta/5 text-tinta" : "text-tinta/55 hover:text-tinta"
      }`}
    >
      {children}
      <Andamento />
    </Link>
  );
}

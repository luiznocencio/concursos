"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = usePathname();
  const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
        ativo ? "bg-tinta/5 text-tinta" : "text-tinta/55 hover:text-tinta"
      }`}
    >
      {children}
    </Link>
  );
}

"use client";

import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Passo } from "@/lib/redacao";

const INTERVALO_MS = 5000;

// Enquanto o worker trabalha, recarrega os dados da página a cada 5 s; a página troca de tela quando o estado muda.
export function Andamento({ passos }: { passos: Passo[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [router]);

  return (
    <ul className="flex flex-col gap-3" aria-live="polite">
      {passos.map((p) => (
        <li key={p.nome} className="flex items-center gap-3">
          {p.feito ? (
            <CheckCircle size={22} weight="fill" className="text-azul" aria-label="concluído" />
          ) : (
            <CircleNotch size={22} className="animate-spin text-pedra motion-reduce:animate-none" aria-label="em andamento" />
          )}
          <span className={p.feito ? "" : "text-grafite"}>{p.nome}</span>
        </li>
      ))}
    </ul>
  );
}

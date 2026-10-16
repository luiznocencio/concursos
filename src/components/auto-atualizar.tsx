"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega os dados da página de tempos em tempos enquanto algo é gerado em segundo plano.
export function AutoAtualizar({ intervaloMs = 5000 }: { intervaloMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(t);
  }, [router, intervaloMs]);
  return null;
}

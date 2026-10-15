"use client";

import { Timer } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { duracao } from "@/lib/formato";

// Conta a partir do prazo calculado no servidor (iniciado_em + duração), então sobrevive a recarregar a página.
export function Cronometro({ prazo, aoTerminar }: { prazo: string; aoTerminar: () => void }) {
  const fim = new Date(prazo).getTime();
  const [agora, setAgora] = useState(() => Date.now());
  const restante = fim - agora;
  const acabou = restante <= 0;

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (acabou) aoTerminar();
  }, [acabou, aoTerminar]);

  const fimProximo = restante < 15 * 60_000;
  return (
    <p
      className={`flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight ${fimProximo ? "text-vermelho" : ""}`}
      aria-label="Tempo restante"
    >
      <Timer size={22} aria-hidden />
      {duracao(restante)}
    </p>
  );
}

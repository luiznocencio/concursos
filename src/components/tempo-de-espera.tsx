"use client";

import { useSyncExternalStore } from "react";
import { tempoDeEspera } from "@/lib/pedidos";

// "Começou há 40 s", contando a cada segundo; passado o limite, avisa que está mais lento que o normal.
// O relógio só começa no navegador, para o HTML do servidor não divergir da hidratação.
function aCadaSegundo(avisar: () => void) {
  const t = setInterval(avisar, 1000);
  return () => clearInterval(t);
}
const segundoAtual = () => Math.floor(Date.now() / 1000) * 1000;

export function TempoDeEspera({ desde, demora }: { desde: string; demora: string }) {
  const agora = useSyncExternalStore(aCadaSegundo, segundoAtual, () => null);
  if (agora === null) return null;
  const { texto, demorando } = tempoDeEspera(desde, new Date(agora));
  return (
    <span className="flex flex-col gap-2">
      <span className="text-sm text-pedra tabular-nums">Começou {texto}</span>
      {demorando && (
        <span role="status" className="rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          {demora}
        </span>
      )}
    </span>
  );
}

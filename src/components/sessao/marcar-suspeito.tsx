"use client";

import { Flag } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { marcarComoSuspeito } from "@/app/(app)/sessao/[id]/acoes";
import { botao } from "@/components/ui";

// Denuncia um item com problema (gabarito, ambiguidade, lei desatualizada). Ele sai das sessões até ser revisado.
export function MarcarSuspeito({ itemId }: { itemId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<"livre" | "feito" | string>("livre");
  const [pendente, iniciar] = useTransition();

  if (estado === "feito") {
    return <p className="text-sm text-grafite">Item marcado como suspeito. Ele sai das sessões até ser revisado.</p>;
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={`${botao.texto} -ml-4 self-start text-pedra`}>
        <Flag size={16} aria-hidden />
        Item com problema?
      </button>
    );
  }
  return (
    <form
      className="flex max-w-[70ch] flex-col gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        iniciar(async () => {
          const r = await marcarComoSuspeito(itemId, motivo);
          setEstado(r.ok ? "feito" : r.erro);
        });
      }}
    >
      <label htmlFor={`motivo-${itemId}`} className="text-sm font-medium">
        O que está errado?
      </label>
      <textarea
        id={`motivo-${itemId}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={500}
        required
        placeholder="Ex.: o gabarito contradiz o art. 5º da lei."
        className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-[15px] placeholder:text-pedra"
      />
      {estado !== "livre" && <p className="text-sm text-vermelho">{estado}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente || !motivo.trim()} className={botao.contorno}>
          Marcar como suspeito
        </button>
        <button type="button" onClick={() => setAberto(false)} className={botao.texto}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

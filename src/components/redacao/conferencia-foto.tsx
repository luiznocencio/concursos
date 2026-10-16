"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarTranscricao } from "@/app/(app)/redacao/acoes";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";

// Foto ao lado da transcrição: o usuário corrige o que a IA leu errado antes da correção.
export function ConferenciaFoto({
  redacaoId,
  fotos,
  linhasIniciais,
  duvidosas,
  linhasMax,
}: {
  redacaoId: string;
  fotos: string[];
  linhasIniciais: string[];
  duvidosas: number[];
  linhasMax: number;
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState(linhasIniciais.length ? linhasIniciais : [""]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function alterar(i: number, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? valor : l)));
  }

  function confirmar() {
    iniciar(async () => {
      const r = await confirmarTranscricao(redacaoId, linhas);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        {fotos.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage, sem otimização.
          <img key={url} src={url} alt={`Foto ${i + 1} da folha`} className="w-full rounded-lg border border-borda" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-sm text-grafite">
          Confira cada linha com a foto. Nas linhas marcadas em amarelo, a leitura ficou incerta.
        </p>
        <ol className="flex flex-col gap-1">
          {linhas.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-pedra tabular-nums">{i + 1}</span>
              <input
                aria-label={`Linha ${i + 1}`}
                value={l}
                onChange={(e) => alterar(i, e.target.value)}
                className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-mono text-[13px] ${
                  duvidosas.includes(i + 1) ? "border-marigold bg-marigold-claro" : "border-borda-campo bg-superficie"
                }`}
              />
            </li>
          ))}
        </ol>
        {linhas.length < linhasMax && (
          <button type="button" onClick={() => setLinhas((ls) => [...ls, ""])} className={`${botao.texto} self-start`}>
            Adicionar linha
          </button>
        )}
        {erro && (
          <p role="alert" className="text-sm text-vermelho">
            {erro}
          </p>
        )}
        <button type="button" onClick={confirmar} disabled={enviando} aria-busy={enviando} className={`${botao.primario} self-start`}>
          {enviando && <Indicador />}
          {enviando ? "Entregando…" : "Confirmar e entregar para correção"}
        </button>
      </div>
    </div>
  );
}

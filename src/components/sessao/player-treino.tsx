"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { responder } from "@/app/(app)/sessao/[id]/acoes";
import { botao } from "@/components/ui";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import { resultadoDe } from "@/estudo/resultado";
import type { Marcacao } from "@/estudo/tipos";
import { Enunciado } from "./enunciado";
import { Feedback, type DadosFeedback } from "./feedback";
import { MarcarSuspeito } from "./marcar-suspeito";

type Corrigido = DadosFeedback & { resposta: Marcacao; duvida: boolean };

function corrigidosIniciais(itens: ItemDaSessao[]): Record<string, Corrigido> {
  const r: Record<string, Corrigido> = {};
  for (const i of itens) {
    if (!i.resposta || !i.correcao) continue;
    r[i.id] = {
      ...i.correcao,
      ...i.resposta,
      resultado: resultadoDe(i.resposta.resposta, i.resposta.duvida, i.correcao.gabarito),
    };
  }
  return r;
}

const COR_MAPA: Record<string, string> = {
  certo: "bg-azul-claro text-azul border-transparent",
  certo_duvida: "bg-azul-claro text-azul border-transparent",
  errado: "bg-vermelho-claro text-vermelho border-transparent",
  branco: "bg-black/5 text-black/60 border-transparent",
};

// Treino e revisão: uma pergunta por vez, correção logo após a resposta. Atalhos: C, E, B, D e Enter.
export function PlayerTreino({ sessaoId, itens }: { sessaoId: string; itens: ItemDaSessao[] }) {
  const router = useRouter();
  const [corrigidos, setCorrigidos] = useState(() => corrigidosIniciais(itens));
  const [indice, setIndice] = useState(() => Math.max(0, itens.findIndex((i) => !i.resposta)));
  const [duvida, setDuvida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inicioItem = useRef(0);

  const item = itens[indice];
  const corrigido = corrigidos[item.id];
  const respondidos = Object.keys(corrigidos).length;
  const terminou = respondidos === itens.length;

  useEffect(() => {
    inicioItem.current = Date.now();
  }, [indice]);

  function irPara(n: number) {
    setIndice(n);
    setDuvida(false);
    setErro(null);
  }

  const marcar = useCallback(
    (resposta: Marcacao) => {
      if (corrigido || pendente) return;
      const tempoMs = Date.now() - inicioItem.current;
      iniciar(async () => {
        const r = await responder({ sessaoId, itemId: item.id, resposta, duvida, tempoMs });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        const { gabarito, justificativa, citacao, fonte, resultado } = r.dados;
        setCorrigidos((c) => ({
          ...c,
          [item.id]: { gabarito, justificativa, citacao, fonte, resultado, resposta: r.dados.resposta, duvida: r.dados.duvida },
        }));
      });
    },
    [corrigido, pendente, sessaoId, item.id, duvida],
  );

  const avancar = useCallback(() => {
    if (terminou) {
      router.refresh();
      return;
    }
    const proximo = itens.findIndex((i, n) => n > indice && !corrigidos[i.id]);
    irPara(proximo >= 0 ? proximo : itens.findIndex((i) => !corrigidos[i.id]));
  }, [terminou, router, itens, indice, corrigidos]);

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      const alvo = ev.target as HTMLElement;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || alvo.closest("textarea, input, select")) return;
      const k = ev.key.toLowerCase();
      if (!corrigido) {
        if (k === "c") marcar("C");
        else if (k === "e") marcar("E");
        else if (k === "b") marcar("branco");
        else if (k === "d") setDuvida((d) => !d);
      } else if (k === "enter" || k === "arrowright") {
        avancar();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [corrigido, marcar, avancar]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <article className="flex min-w-0 flex-col gap-8" aria-live="polite">
        <p className="text-sm text-pedra">
          Item {indice + 1} de {itens.length}
        </p>
        <Enunciado textoBase={item.textoBase} enunciado={item.enunciado} topicos={item.topicos} />

        {corrigido ? (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-pedra">
              Sua resposta: {corrigido.resposta === "branco" ? "em branco" : corrigido.resposta === "C" ? "Certo" : "Errado"}
              {corrigido.duvida ? ", com dúvida" : ""}
            </p>
            <Feedback {...corrigido} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={avancar} className={botao.primario}>
                {terminou ? "Ver resumo" : "Próximo item"}
              </button>
            </div>
            <MarcarSuspeito key={item.id} itemId={item.id} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={pendente} onClick={() => marcar("C")} className={`${botao.contorno} h-12 min-w-32 text-base`}>
                Certo
              </button>
              <button type="button" disabled={pendente} onClick={() => marcar("E")} className={`${botao.contorno} h-12 min-w-32 text-base`}>
                Errado
              </button>
              <button
                type="button"
                aria-pressed={duvida}
                onClick={() => setDuvida((d) => !d)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  duvida ? "border-transparent bg-marigold-claro text-[#8a5a00]" : "border-borda-forte text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                Tenho dúvida
              </button>
              <button type="button" disabled={pendente} onClick={() => marcar("branco")} className={botao.texto}>
                Deixar em branco
              </button>
            </div>
            {erro && (
              <p role="alert" className="text-sm text-vermelho">
                {erro}
              </p>
            )}
            <p className="hidden text-xs text-pedra md:block">Atalhos: C certo, E errado, B em branco, D dúvida, Enter próximo.</p>
          </div>
        )}
      </article>

      <aside className="order-first lg:order-none">
        <p className="mb-3 text-sm font-medium">
          {respondidos} de {itens.length} respondidos
        </p>
        <ol className="grid grid-cols-10 gap-1.5 lg:grid-cols-5" aria-label="Itens da sessão">
          {itens.map((i, n) => {
            const c = corrigidos[i.id];
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => irPara(n)}
                  aria-label={`Item ${n + 1}`}
                  aria-current={n === indice ? "step" : undefined}
                  className={`flex aspect-square w-full items-center justify-center rounded-md border text-xs font-medium transition-colors duration-200 ${
                    c ? COR_MAPA[c.resultado] : "border-borda-forte bg-white text-black/60"
                  } ${n === indice ? "ring-2 ring-azul ring-offset-1" : ""}`}
                >
                  {n + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}

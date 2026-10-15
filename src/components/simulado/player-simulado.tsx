"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { entregar, marcar } from "@/app/(app)/simulado/[id]/acoes";
import { Enunciado } from "@/components/sessao/enunciado";
import { botao } from "@/components/ui";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import type { Marcacao } from "@/estudo/tipos";
import { Cronometro } from "./cronometro";

interface Marcada {
  resposta: Marcacao;
  duvida: boolean;
}

export interface ProvaNoSimulado {
  slug: string;
  nome: string;
  inicio: number;
  fim: number;
}

// Simulado completo: sem correção até a entrega; cada marcação é salva na hora e pode ser trocada.
export function PlayerSimulado({
  sessaoId,
  itens,
  provas,
  prazo,
}: {
  sessaoId: string;
  itens: ItemDaSessao[];
  provas: ProvaNoSimulado[];
  prazo: string;
}) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Record<string, Marcada>>(() =>
    Object.fromEntries(itens.filter((i) => i.resposta).map((i) => [i.id, i.resposta!])),
  );
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [entregando, iniciarEntrega] = useTransition();
  const entregue = useRef(false);

  const item = itens[indice];
  const atual = marcadas[item.id];
  const prova = provas.find((p) => indice >= p.inicio && indice < p.fim);
  const brancos = itens.filter((i) => !marcadas[i.id] || marcadas[i.id].resposta === "branco").length;

  function gravar(itemId: string, nova: Marcada) {
    const anterior = marcadas[itemId];
    setMarcadas((m) => ({ ...m, [itemId]: nova }));
    setErro(null);
    marcar({ sessaoId, itemId, ...nova }).then((r) => {
      if (r.ok) return;
      setErro(r.erro);
      setMarcadas((m) => {
        const copia = { ...m };
        if (anterior) copia[itemId] = anterior;
        else delete copia[itemId];
        return copia;
      });
    });
  }

  const finalizar = useCallback(() => {
    if (entregue.current) return;
    entregue.current = true;
    iniciarEntrega(async () => {
      const r = await entregar(sessaoId);
      if (r.ok) router.push(`/simulado/${sessaoId}/resultado`);
      else {
        entregue.current = false;
        setErro(r.erro);
      }
    });
  }, [sessaoId, router]);

  const escolha = (resposta: Marcacao) =>
    `${botao.contorno} h-12 min-w-32 text-base ${atual?.resposta === resposta ? "!border-azul !bg-azul-claro !text-azul" : ""}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <article className="flex min-w-0 flex-col gap-8">
        <p className="text-sm text-pedra">
          {prova?.nome} · item {indice + 1} de {itens.length}
        </p>
        <Enunciado textoBase={item.textoBase} enunciado={item.enunciado} topicos={[]} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-pressed={atual?.resposta === "C"} onClick={() => gravar(item.id, { resposta: "C", duvida: atual?.duvida ?? false })} className={escolha("C")}>
            Certo
          </button>
          <button type="button" aria-pressed={atual?.resposta === "E"} onClick={() => gravar(item.id, { resposta: "E", duvida: atual?.duvida ?? false })} className={escolha("E")}>
            Errado
          </button>
          <button
            type="button"
            aria-pressed={atual?.duvida ?? false}
            onClick={() => gravar(item.id, { resposta: atual?.resposta ?? "branco", duvida: !(atual?.duvida ?? false) })}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              atual?.duvida ? "border-transparent bg-marigold-claro text-[#8a5a00]" : "border-borda-forte text-black/70 hover:bg-black/[0.03]"
            }`}
          >
            Tenho dúvida
          </button>
          {atual && atual.resposta !== "branco" && (
            <button type="button" onClick={() => gravar(item.id, { resposta: "branco", duvida: atual.duvida })} className={botao.texto}>
              Deixar em branco
            </button>
          )}
        </div>
        {erro && (
          <p role="alert" className="text-sm text-vermelho">
            {erro}
          </p>
        )}
        <div className="flex gap-2 border-t border-borda pt-6">
          <button type="button" disabled={indice === 0} onClick={() => setIndice(indice - 1)} className={botao.texto}>
            Anterior
          </button>
          <button type="button" disabled={indice === itens.length - 1} onClick={() => setIndice(indice + 1)} className={botao.contorno}>
            Próximo
          </button>
        </div>
      </article>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <Cronometro prazo={prazo} aoTerminar={finalizar} />
        {provas.map((p) => (
          <div key={p.slug}>
            <p className="mb-2 text-sm font-medium">{p.nome}</p>
            <ol className="grid grid-cols-10 gap-1">
              {itens.slice(p.inicio, p.fim).map((i, k) => {
                const n = p.inicio + k;
                const m = marcadas[i.id];
                const marcado = m && m.resposta !== "branco";
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setIndice(n)}
                      aria-label={`Item ${n + 1}${marcado ? ", marcado" : ""}${m?.duvida ? ", com dúvida" : ""}`}
                      aria-current={n === indice ? "step" : undefined}
                      className={`flex aspect-square w-full items-center justify-center rounded text-[10px] font-medium transition-colors duration-200 ${
                        marcado ? "bg-azul-claro text-azul" : "bg-white text-black/50 ring-1 ring-borda-forte ring-inset"
                      } ${m?.duvida ? "!bg-marigold-claro !text-[#8a5a00]" : ""} ${n === indice ? "outline-2 outline-offset-1 outline-azul" : ""}`}
                    >
                      {n + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        {confirmando ? (
          <div className="flex flex-col gap-3 rounded-xl border border-borda bg-white p-4">
            <p className="text-sm">
              Entregar agora? {brancos > 0 ? `${brancos} ${brancos === 1 ? "item está" : "itens estão"} em branco.` : "Todos os itens foram marcados."}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={entregando} onClick={finalizar} className={botao.primario}>
                Entregar
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className={botao.texto}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className={`${botao.contorno} self-start`}>
            Entregar simulado
          </button>
        )}
      </aside>
    </div>
  );
}

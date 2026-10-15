"use client";

import { X } from "@phosphor-icons/react";
import type { GrupoPrevia } from "@/importacao/previa";
import type { OpcaoTopico } from "@/importacao/topicos";
import { LinhaItem, TextoBase } from "./previa-prova";

// Tópicos de cada item: os escolhidos viram etiquetas removíveis; o seletor acrescenta outro.
export function EscolhaTopicos({
  grupos,
  opcoes,
  topicos,
  sugeridos,
  aoMudar,
}: {
  grupos: GrupoPrevia[];
  opcoes: OpcaoTopico[];
  topicos: Record<number, string[]>;
  sugeridos: Record<number, string[]>;
  aoMudar: (numero: number, canonicos: string[]) => void;
}) {
  const porCanonico = new Map(opcoes.map((o) => [o.canonico, o]));
  const disciplinas = [...new Set(opcoes.map((o) => o.disciplina))];

  return (
    <ol className="flex flex-col gap-4">
      {grupos.map((g) => (
        <li key={g.itens[0].numero} className="rounded-xl border border-borda bg-white px-6 pt-5 pb-1">
          {g.textoBase ? <TextoBase texto={g.textoBase} /> : <p className="text-sm text-pedra">Itens sem texto-base</p>}
          <ul className="divide-y divide-borda">
            {g.itens.map((i) => {
              const escolhidos = topicos[i.numero] ?? [];
              return (
                <LinhaItem key={i.numero} item={i}>
                  <div className="flex flex-wrap items-center gap-2">
                    {escolhidos.length === 0 && <span className="text-sm text-[#8a5a00]">Sem tópico</span>}
                    {escolhidos.map((c) => {
                      const o = porCanonico.get(c);
                      const daIa = sugeridos[i.numero]?.includes(c);
                      return (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-black/5 py-1 pr-1 pl-3 text-xs font-medium text-black/80">
                          {o ? `${o.titulo} (${o.disciplina})` : c}
                          {daIa && <span className="text-pedra">· IA</span>}
                          <button
                            type="button"
                            onClick={() => aoMudar(i.numero, escolhidos.filter((x) => x !== c))}
                            aria-label={`Remover ${o?.titulo ?? c} do item ${i.numero}`}
                            className="rounded-full p-1 text-pedra transition-colors duration-200 hover:bg-black/10 hover:text-black"
                          >
                            <X size={12} weight="bold" aria-hidden />
                          </button>
                        </span>
                      );
                    })}
                    {escolhidos.length < 3 && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && aoMudar(i.numero, [...escolhidos, e.target.value])}
                        aria-label={`Adicionar tópico ao item ${i.numero}`}
                        className="max-w-full rounded-lg border border-borda-forte bg-white px-2 py-1 text-sm text-grafite"
                      >
                        <option value="">Adicionar tópico</option>
                        {disciplinas.map((d) => (
                          <optgroup key={d} label={d}>
                            {opcoes
                              .filter((o) => o.disciplina === d && !escolhidos.includes(o.canonico))
                              .map((o) => (
                                <option key={o.canonico} value={o.canonico}>
                                  {o.titulo}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                </LinhaItem>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

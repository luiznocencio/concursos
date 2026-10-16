"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useState } from "react";
import { cookieDoTema, type Tema } from "@/lib/tema";

const OPCOES = [
  { tema: "claro", rotulo: "Claro", Icone: Sun },
  { tema: "escuro", rotulo: "Escuro", Icone: Moon },
  { tema: "sistema", rotulo: "Sistema", Icone: Desktop },
] as const;

// Troca o tema na hora (atributo no <html>) e grava o cookie para a próxima renderização do servidor.
// No celular, um botão só que alterna Claro → Escuro → Sistema, para sobrar espaço à navegação;
// a partir do md, as três opções lado a lado.
export function SeletorTema({ inicial }: { inicial: Tema }) {
  const [tema, setTema] = useState<Tema>(inicial);
  const indice = OPCOES.findIndex((o) => o.tema === tema);
  const atual = OPCOES[indice];
  const proxima = OPCOES[(indice + 1) % OPCOES.length];

  function escolher(novo: Tema) {
    setTema(novo);
    document.documentElement.dataset.tema = novo;
    document.cookie = cookieDoTema(novo);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => escolher(proxima.tema)}
        aria-label={`Tema: ${atual.rotulo}. Mudar para ${proxima.rotulo}`}
        title={`Tema: ${atual.rotulo}`}
        className="grid size-9 shrink-0 place-items-center rounded-lg text-tinta/80 transition-colors duration-200 hover:bg-tinta/5 md:hidden"
      >
        <atual.Icone size={18} aria-hidden />
      </button>
      <div role="radiogroup" aria-label="Tema" className="hidden shrink-0 rounded-lg bg-tinta/5 p-0.5 md:flex">
        {OPCOES.map(({ tema: t, rotulo, Icone }) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tema === t}
            aria-label={rotulo}
            title={rotulo}
            onClick={() => escolher(t)}
            className={`grid size-8 place-items-center rounded-md transition-colors duration-200 ${
              tema === t ? "bg-superficie text-tinta shadow-[0_0_0_1px_var(--color-borda-forte)]" : "text-tinta/60 hover:text-tinta"
            }`}
          >
            <Icone size={16} weight={tema === t ? "fill" : "regular"} aria-hidden />
          </button>
        ))}
      </div>
    </>
  );
}

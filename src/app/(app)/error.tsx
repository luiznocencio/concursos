"use client";

import { WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";

// Falha ao carregar uma página do app: diz o que houve, sem detalhes técnicos, e oferece tentar de novo.
export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className={`${cartao} flex flex-col items-start gap-4 p-8`}>
      <WarningCircle size={28} className="text-vermelho" aria-hidden />
      <h1 className={titulo.secao}>Não foi possível carregar esta página</h1>
      <p className={`${textoApoio} max-w-[56ch]`}>
        Pode ter sido a conexão ou uma instabilidade momentânea. O que você já respondeu ou escreveu continua salvo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className={botao.primario}>
          Tentar de novo
        </button>
        <Link href="/" className={botao.texto}>
          Voltar ao início
        </Link>
      </div>
      {error.digest && <p className="text-xs text-pedra">Código do erro: {error.digest}</p>}
    </section>
  );
}

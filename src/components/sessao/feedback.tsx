import { CheckCircle, MinusCircle, XCircle } from "@phosphor-icons/react/ssr";
import type { ResultadoResposta } from "@/core";

const ESTILO: Record<ResultadoResposta, { caixa: string; titulo: string }> = {
  certo: { caixa: "bg-azul-claro text-[#00447f]", titulo: "Você acertou" },
  certo_duvida: { caixa: "bg-azul-claro text-[#00447f]", titulo: "Você acertou, com dúvida" },
  errado: { caixa: "bg-vermelho-claro text-[#8f1c0c]", titulo: "Você errou" },
  branco: { caixa: "bg-black/5 text-black/80", titulo: "Em branco" },
};

export interface DadosFeedback {
  resultado: ResultadoResposta;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
}

export function nomeGabarito(g: string): string {
  return g === "C" ? "Certo" : g === "E" ? "Errado" : g;
}

// Correção de um item: resultado, gabarito, justificativa e o trecho da fonte.
export function Feedback({ resultado, gabarito, justificativa, citacao, fonte }: DadosFeedback) {
  const e = ESTILO[resultado];
  const Icone = resultado === "errado" ? XCircle : resultado === "branco" ? MinusCircle : CheckCircle;
  return (
    <div className="flex flex-col gap-4">
      <p className={`flex items-center gap-2 rounded-lg px-4 py-3 font-medium ${e.caixa}`}>
        <Icone size={20} weight="fill" aria-hidden />
        {e.titulo}. Gabarito: {nomeGabarito(gabarito)}.
      </p>
      {justificativa && <p className="max-w-[70ch] leading-relaxed text-grafite">{justificativa}</p>}
      {citacao && (
        <blockquote className="max-w-[70ch] border-l-2 border-borda-forte pl-4 text-[15px] leading-relaxed text-black/70">
          {citacao}
          {fonte && <span className="mt-1 block text-sm text-pedra">{fonte}</span>}
        </blockquote>
      )}
    </div>
  );
}

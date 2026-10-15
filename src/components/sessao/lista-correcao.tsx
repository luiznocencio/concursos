import { resultadoDe } from "@/estudo/resultado";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import { Enunciado } from "./enunciado";
import { Feedback } from "./feedback";

const ROTULO = { certo: "Certo", certo_duvida: "Certo com dúvida", errado: "Errado", branco: "Em branco" } as const;
const COR = {
  certo: "text-azul",
  certo_duvida: "text-azul",
  errado: "text-vermelho",
  branco: "text-pedra",
} as const;

// Itens já corrigidos, recolhidos: abre um por vez para rever a justificativa.
export function ListaCorrecao({ itens }: { itens: ItemDaSessao[] }) {
  return (
    <ol className="divide-y divide-borda border-y border-borda">
      {itens.map((i, n) => {
        if (!i.correcao) return null;
        const resposta = i.resposta ?? { resposta: "branco" as const, duvida: false };
        const resultado = resultadoDe(resposta.resposta, resposta.duvida, i.correcao.gabarito);
        return (
          <li key={i.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-3 hover:bg-realce">
                <span className="w-8 shrink-0 text-sm text-pedra">{n + 1}</span>
                <span className="line-clamp-1 flex-1 text-[15px]">{i.enunciado}</span>
                <span className={`shrink-0 text-sm font-medium ${COR[resultado]}`}>{ROTULO[resultado]}</span>
              </summary>
              <div className="flex flex-col gap-6 pt-2 pb-6 pl-12">
                <Enunciado textoBase={i.textoBase} enunciado={i.enunciado} topicos={i.topicos} />
                <Feedback resultado={resultado} {...i.correcao} />
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

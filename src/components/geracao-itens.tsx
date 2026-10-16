import { AutoAtualizar } from "@/components/auto-atualizar";
import { Indicador } from "@/components/carregando";
import { topicosEmGeracao, type PedidoIa } from "@/lib/pedidos";

// Faixa enquanto há itens sendo gerados para o usuário; some sozinha quando a fila esvazia.
export function GeracaoDeItens({ pedidos }: { pedidos: PedidoIa[] }) {
  const n = topicosEmGeracao(pedidos);
  if (n === 0) return null;
  return (
    <div role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-realce px-4 py-3 text-[15px] text-grafite">
      <AutoAtualizar intervaloMs={20_000} />
      <Indicador className="mt-0.5" />
      <span>
        Gerando itens para {n === 1 ? "1 tópico" : `${n} tópicos`}… Leva alguns minutos; os itens novos entram nas próximas
        sessões.
      </span>
    </div>
  );
}

import { z } from "zod";
import type { PedidoIa } from "@/lib/pedidos";
import type { Cliente } from "./estudo";

const pedidosSchema = z.array(
  z.object({
    tipo: z.enum(["gerar_itens", "gerar_tema"]),
    status: z.enum(["pendente", "processando", "concluido", "falhou"]),
    canonico: z.string().nullable(),
    criadoEm: z.string(),
    atualizadoEm: z.string(),
  }),
);

// Pedidos de geração do próprio usuário (em aberto ou dos últimos 30 min). O status é só informativo:
// se a leitura falhar, a página segue sem ele.
export async function meusPedidosIa(db: Cliente): Promise<PedidoIa[]> {
  const { data, error } = await db.rpc("meus_pedidos_ia");
  const lidos = error ? null : pedidosSchema.safeParse(data);
  if (!lidos?.success) {
    console.error("meus_pedidos_ia:", error?.message ?? lidos?.error.message);
    return [];
  }
  return lidos.data;
}

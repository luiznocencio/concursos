// Andamento das tarefas de IA em segundo plano, para as telas mostrarem o status (heurística 1 de Nielsen).

export interface PedidoIa {
  tipo: "gerar_itens" | "gerar_tema";
  status: "pendente" | "processando" | "concluido" | "falhou";
  canonico: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const emAberto = (p: PedidoIa) => p.status === "pendente" || p.status === "processando";

// Tópicos com geração de itens ainda na fila (um tópico pode ter mais de um pedido).
export function topicosEmGeracao(pedidos: PedidoIa[]): number {
  return new Set(pedidos.filter((p) => p.tipo === "gerar_itens" && emAberto(p)).map((p) => p.canonico)).size;
}

export type EstadoTema = { tipo: "gerando"; desde: string } | { tipo: "reprovado" } | { tipo: "falhou" } | null;

/**
 * O que dizer sobre o último pedido de tema: ainda gerando, falhou, ou terminou sem tema novo na lista
 * (a revisão da outra IA reprovou). Se um tema gerado apareceu depois do pedido, não há o que avisar.
 */
export function estadoDoTema(pedidos: PedidoIa[], temas: { origem: string; criadoEm: string }[]): EstadoTema {
  const ultimo = pedidos
    .filter((p) => p.tipo === "gerar_tema")
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  if (!ultimo) return null;
  if (emAberto(ultimo)) return { tipo: "gerando", desde: ultimo.criadoEm };
  if (ultimo.status === "falhou") return { tipo: "falhou" };
  const chegou = temas.some((t) => t.origem === "gerado" && new Date(t.criadoEm) >= new Date(ultimo.criadoEm));
  return chegou ? null : { tipo: "reprovado" };
}

// "há 40 s", "há 2 min"; `demorando` depois do limite (padrão 3 min), para avisar que está mais lento que o normal.
export function tempoDeEspera(desde: string, agora: Date, limiteSegundos = 180): { texto: string; demorando: boolean } {
  const s = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 1000));
  const texto = s < 60 ? `há ${s} s` : `há ${Math.floor(s / 60)} min`;
  return { texto, demorando: s > limiteSegundos };
}

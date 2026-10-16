import { Info } from "@phosphor-icons/react/ssr";

function mensagem(codigo: string, pedidos: number): string | null {
  const fila =
    pedidos > 0
      ? `Pedimos a geração de itens para ${pedidos === 1 ? "1 tópico" : `${pedidos} tópicos`}. Volte em alguns minutos.`
      : "Os tópicos já estão na fila de geração ou o limite de 3 pedidos em aberto foi atingido.";
  switch (codigo) {
    case "sem-itens":
      return `Ainda não há itens aprovados suficientes. ${fila}`;
    case "geracao":
      return fila;
    case "sem-revisao":
      return "Nenhuma revisão vencida agora. Os itens errados voltam 1, 3, 7 e 15 dias depois.";
    case "sem-concurso":
      return "Nenhum concurso foi carregado ainda.";
    case "escolha":
      return "Escolha pelo menos um tópico.";
    case "faltam":
      return "Ainda faltam itens para montar o simulado completo.";
    case "tema-pedido":
      return "Pedimos um tema novo. Ele aparece na lista em cerca de 1 minuto, se a revisão por outra IA aprovar; se não aparecer, peça outro.";
    case "tema-ja-pedido":
      return "Você já tem um tema novo a caminho. Espere ele ficar pronto para pedir outro.";
    case "sem-tema":
      return "Não há tema de redação para a prova discursiva. Gere um tema em Redação ou comece o simulado só com as objetivas.";
    case "encerrada":
      return "Esta sessão já foi encerrada.";
    default:
      return null;
  }
}

export function Aviso({ codigo, pedidos }: { codigo?: string; pedidos?: string }) {
  const texto = codigo ? mensagem(codigo, Number(pedidos ?? 0)) : null;
  if (!texto) return null;
  return (
    <p role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-azul-claro px-4 py-3 text-[15px] text-azul-tinta">
      <Info size={20} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}

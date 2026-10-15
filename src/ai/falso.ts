import type { z } from "zod/v4";
import { ErroIa, type PedidoJson, type Provedor, type ProvedorIa, type RespostaJson } from "./tipos";

export type RespostaFalsa = unknown | ErroIa;

// Provedor para testes: devolve as respostas na ordem dada e registra os pedidos recebidos.
export function criarProvedorFalso(nome: Provedor, respostas: RespostaFalsa[]) {
  const pedidos: PedidoJson<z.ZodType>[] = [];
  const fila = [...respostas];
  const provedor: ProvedorIa = {
    nome,
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      pedidos.push(pedido);
      const proxima = fila.shift();
      if (proxima === undefined) throw new ErroIa(nome, "api", "provedor falso sem respostas");
      if (proxima instanceof ErroIa) throw proxima;
      const r = pedido.schema.safeParse(proxima);
      if (!r.success) throw new ErroIa(nome, "saida_invalida", r.error.message);
      return {
        dados: r.data as z.infer<S>,
        uso: { provedor: nome, modelo: `${nome}-falso`, tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.01 },
      };
    },
  };
  return { provedor, pedidos };
}

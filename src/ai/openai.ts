import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";
import { custoUsd, type PrecoModelo } from "./custo";
import { ErroIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigOpenAI {
  apiKey?: string;
  modelo: string;
  preco: PrecoModelo;
}

export function criarProvedorOpenAI(config: ConfigOpenAI): ProvedorIa {
  const client = new OpenAI(config.apiKey ? { apiKey: config.apiKey } : {});

  return {
    nome: "openai",
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      let resposta;
      try {
        resposta = await client.responses.parse({
          model: config.modelo,
          instructions: pedido.sistema,
          input: pedido.prompt,
          text: { format: zodTextFormat(pedido.schema, pedido.nomeSchema) },
        });
      } catch (e) {
        throw new ErroIa("openai", "api", e instanceof Error ? e.message : String(e));
      }

      const entrada = resposta.usage?.input_tokens ?? 0;
      const saida = resposta.usage?.output_tokens ?? 0;
      const uso: UsoIa = {
        provedor: "openai",
        modelo: config.modelo,
        tokensEntrada: entrada,
        tokensSaida: saida,
        custoUsd: custoUsd(config.preco, { entrada, saida }),
      };
      if (resposta.output_parsed == null) {
        throw new ErroIa("openai", "saida_invalida", `Saída fora do schema (status: ${resposta.status})`, uso);
      }
      return { dados: resposta.output_parsed as z.infer<S>, uso };
    },
  };
}

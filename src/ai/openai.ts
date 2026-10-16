import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";
import { custoUsd, type PrecoModelo } from "./custo";
import { ErroIa, type ImagemIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigOpenAI {
  apiKey?: string;
  modelo: string;
  preco: PrecoModelo;
}

// Entrada da Responses API: só texto, ou uma mensagem com o texto e as imagens em data URL.
export function entradaOpenAI(prompt: string, imagens: ImagemIa[] = []) {
  if (imagens.length === 0) return prompt;
  return [
    {
      role: "user" as const,
      content: [
        { type: "input_text" as const, text: prompt },
        ...imagens.map((i) => ({
          type: "input_image" as const,
          image_url: `data:${i.midia};base64,${i.base64}`,
          detail: "high" as const,
        })),
      ],
    },
  ];
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
          input: entradaOpenAI(pedido.prompt, pedido.imagens),
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

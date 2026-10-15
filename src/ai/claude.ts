import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { custoUsd, PRECOS_CLAUDE } from "./custo";
import { ErroIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigClaude {
  apiKey?: string;
  modelo?: string;
  esforco?: "low" | "medium" | "high" | "xhigh" | "max";
}

// O Haiku 5.5 não tem fallback no servidor: com "default" a recusa continua recusa.
export function suportaFallbackServidor(modelo: string): boolean {
  return !modelo.startsWith("claude-haiku-");
}

export function criarProvedorClaude(config: ConfigClaude = {}): ProvedorIa {
  const client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  const modelo = config.modelo ?? "claude-opus-5-5";
  if (!PRECOS_CLAUDE[modelo]) throw new Error(`Preço desconhecido para o modelo ${modelo}`);
  // Em recusa por política, a própria API refaz o pedido no modelo de fallback padrão.
  const fallback = suportaFallbackServidor(modelo)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  return {
    nome: "anthropic",
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      let resposta;
      try {
        resposta = await client.beta.messages.parse({
          model: modelo,
          max_tokens: 16000,
          ...fallback,
          output_config: { effort: config.esforco ?? "high", format: betaZodOutputFormat(pedido.schema) },
          system: [{ type: "text", text: pedido.sistema, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: pedido.prompt }],
        });
      } catch (e) {
        throw new ErroIa("anthropic", "api", e instanceof Error ? e.message : String(e));
      }

      const u = resposta.usage;
      const preco = PRECOS_CLAUDE[resposta.model] ?? PRECOS_CLAUDE[modelo];
      const uso: UsoIa = {
        provedor: "anthropic",
        modelo: resposta.model,
        tokensEntrada: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        tokensSaida: u.output_tokens,
        custoUsd: custoUsd(preco, {
          entrada: u.input_tokens,
          saida: u.output_tokens,
          escritaCache: u.cache_creation_input_tokens ?? 0,
          leituraCache: u.cache_read_input_tokens ?? 0,
        }),
      };

      if (resposta.stop_reason === "refusal") {
        throw new ErroIa("anthropic", "recusa", "O modelo recusou o pedido", uso);
      }
      if (resposta.parsed_output == null) {
        throw new ErroIa("anthropic", "saida_invalida", `Saída fora do schema (stop_reason: ${resposta.stop_reason})`, uso);
      }
      return { dados: resposta.parsed_output as z.infer<S>, uso };
    },
  };
}

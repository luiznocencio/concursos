import { z } from "zod/v4";
import { criarProvedorClaude } from "../ai/claude";
import { criarProvedorOpenAI } from "../ai/openai";
import type { ProvedorIa } from "../ai/tipos";

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().min(1).default("claude-opus-5-5"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  OPENAI_PRECO_ENTRADA_USD_MTOK: z.coerce.number().positive(),
  OPENAI_PRECO_SAIDA_USD_MTOK: z.coerce.number().positive(),
});

export type ConfigIa = z.infer<typeof schema>;

export function lerConfigIa(env: Record<string, string | undefined> = process.env): ConfigIa {
  const r = schema.safeParse(env);
  if (!r.success) {
    const campos = [...new Set(r.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Configuração de IA ausente ou inválida: ${campos.join(", ")}`);
  }
  return r.data;
}

export function criarProvedores(config: ConfigIa = lerConfigIa()): [ProvedorIa, ProvedorIa] {
  return [
    criarProvedorClaude({ apiKey: config.ANTHROPIC_API_KEY, modelo: config.CLAUDE_MODEL }),
    criarProvedorOpenAI({
      apiKey: config.OPENAI_API_KEY,
      modelo: config.OPENAI_MODEL,
      preco: {
        entradaUsdPorMTok: config.OPENAI_PRECO_ENTRADA_USD_MTOK,
        saidaUsdPorMTok: config.OPENAI_PRECO_SAIDA_USD_MTOK,
        cacheLeituraUsdPorMTok: config.OPENAI_PRECO_ENTRADA_USD_MTOK,
      },
    }),
  ];
}

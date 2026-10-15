import { z } from "zod/v4";

// Schemas simples (sem limites numéricos) para caber nas saídas estruturadas dos dois provedores.
export const loteGeradoSchema = z.object({
  texto_base: z.string().nullable(),
  itens: z.array(
    z.object({
      enunciado: z.string(),
      gabarito: z.enum(["C", "E"]),
      justificativa: z.string(),
      citacao: z.string().nullable(),
      dificuldade: z.number(),
    }),
  ),
});
export type LoteGerado = z.infer<typeof loteGeradoSchema>;

export const julgamentosSchema = z.object({
  julgamentos: z.array(
    z.object({
      indice: z.number(),
      gabarito: z.enum(["C", "E"]),
      justificativa: z.string(),
    }),
  ),
});
export type Julgamentos = z.infer<typeof julgamentosSchema>;

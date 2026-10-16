import { z } from "zod/v4";
import { CATEGORIAS_ERRO, TIPOS_ERRO } from "../../core/discursiva/tipos";

// Schemas simples (sem limites numéricos) para caber nas saídas estruturadas dos dois provedores.

export const correcaoConteudoSchema = z.object({
  aspectos: z.array(z.object({ codigo: z.string(), nota: z.number(), justificativa: z.string() })),
  fuga_tema: z.boolean(),
  comentario: z.string(),
});
export type CorrecaoConteudo = z.infer<typeof correcaoConteudoSchema>;

export const correcaoLinguaSchema = z.object({
  erros: z.array(
    z.object({
      linha: z.number(),
      trecho: z.string(),
      tipo: z.enum(TIPOS_ERRO),
      categoria: z.enum(CATEGORIAS_ERRO),
      correcao: z.string(),
      explicacao: z.string(),
    }),
  ),
});
export type CorrecaoLingua = z.infer<typeof correcaoLinguaSchema>;

export const transcricaoSchema = z.object({
  linhas: z.array(z.object({ texto: z.string(), ilegivel: z.boolean() })),
});
export type Transcricao = z.infer<typeof transcricaoSchema>;

export const temaGeradoSchema = z.object({
  enunciado: z.string(),
  textos_apoio: z.array(z.object({ titulo: z.string(), texto: z.string(), fonte: z.string() })),
  padrao_resposta: z.object({
    aspectos: z.array(z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() })),
    expectativas: z.string(),
  }),
});
export type TemaGerado = z.infer<typeof temaGeradoSchema>;

export const avaliacaoTemaSchema = z.object({
  aprovado: z.boolean(),
  problemas: z.array(z.string()),
});
export type AvaliacaoTema = z.infer<typeof avaliacaoTemaSchema>;

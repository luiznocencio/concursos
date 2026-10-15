import { z } from "zod/v4";
import { hashNormalizado } from "../pipeline/hash";

const itemSchema = z.object({
  numero: z.number().int().min(1).max(999),
  enunciado: z.string().trim().min(1).max(4_000),
  gabarito: z.enum(["C", "E"]),
});
const textoBaseSchema = z.string().max(20_000).nullable();

// Grupos da prévia, enviados para a sugestão de tópicos. Validado no servidor.
export const previaSchema = z
  .array(z.object({ textoBase: textoBaseSchema, itens: z.array(itemSchema).min(1) }))
  .min(1)
  .max(300);

// O que a tela envia para gravar, depois de o moderador confirmar os tópicos. Validado no servidor.
export const importacaoSchema = z.object({
  provaOrigem: z.string().trim().min(3).max(120),
  grupos: z
    .array(
      z.object({
        textoBase: textoBaseSchema,
        itens: z.array(itemSchema.extend({ canonicos: z.array(z.string().min(1)).max(3) })).min(1),
      }),
    )
    .min(1)
    .max(300),
});

export type Importacao = z.infer<typeof importacaoSchema>;

// Formato de public.itens_importar_reais (migração 0008).
export interface LoteReal {
  banca: string;
  prova_origem: string;
  importado_por: string;
  grupos: {
    texto_base: string | null;
    itens: { numero: number; enunciado: string; gabarito: "C" | "E"; hash: string; canonicos: string[] }[];
  }[];
}

export class ErroImportacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroImportacao";
  }
}

// Confere os tópicos (ao menos um por item, todos do concurso) e calcula o hash de deduplicação
// com a mesma normalização do pipeline de geração.
export function montarLoteReal(p: {
  banca: string;
  importadoPor: string;
  importacao: Importacao;
  canonicosPermitidos: Set<string>;
}): LoteReal {
  const itens = p.importacao.grupos.flatMap((g) => g.itens);
  const semTopico = itens.filter((i) => i.canonicos.length === 0).map((i) => i.numero);
  if (semTopico.length > 0) throw new ErroImportacao(`Escolha ao menos um tópico para os itens ${semTopico.join(", ")}.`);
  const fora = [...new Set(itens.flatMap((i) => i.canonicos))].filter((c) => !p.canonicosPermitidos.has(c));
  if (fora.length > 0) throw new ErroImportacao(`Tópicos fora do edital: ${fora.join(", ")}.`);
  if (itens.length > 300) throw new ErroImportacao("No máximo 300 itens por importação.");

  return {
    banca: p.banca,
    prova_origem: p.importacao.provaOrigem.trim(),
    importado_por: p.importadoPor,
    grupos: p.importacao.grupos.map((g) => {
      const textoBase = g.textoBase?.trim() || null;
      return {
        texto_base: textoBase,
        itens: g.itens.map((i) => ({
          numero: i.numero,
          enunciado: i.enunciado.trim(),
          gabarito: i.gabarito,
          hash: hashNormalizado(i.enunciado, textoBase),
          canonicos: [...new Set(i.canonicos)],
        })),
      };
    }),
  };
}

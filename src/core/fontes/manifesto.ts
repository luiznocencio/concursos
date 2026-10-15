import { parse } from "yaml";
import { z } from "zod";

const slugCanonico = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)+$/, "slug canônico inválido");

export const manifestoFontesSchema = z.object({
  fontes: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido"),
        tipo: z.enum(["lei", "decreto", "constituicao", "conceito"]),
        titulo: z.string().min(1),
        url_oficial: z.string().url().nullable().default(null),
        arquivo: z.string().regex(/^[\w.-]+\.txt$/, "arquivo deve ser um .txt na pasta fontes/"),
        canonicos: z.array(slugCanonico).min(1),
      }),
    )
    .min(1),
});

export type ManifestoFontes = z.infer<typeof manifestoFontesSchema>;

export function parseManifestoFontes(texto: string): ManifestoFontes {
  const r = manifestoFontesSchema.safeParse(parse(texto));
  if (!r.success) {
    throw new Error(`fontes.yaml inválido:\n${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return r.data;
}

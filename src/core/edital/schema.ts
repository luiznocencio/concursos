import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido");
const slugCanonico = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)+$/, "slug canônico inválido");

export const regraPontuacaoSchema = z.discriminatedUnion("regra", [
  z.object({ regra: z.literal("certo_errado_penalidade") }),
  z.object({
    regra: z.literal("multipla_escolha"),
    peso: z.number().positive(),
    penalidade: z.number().min(0).default(0),
  }),
]);

export const regraCorteSchema = z.discriminatedUnion("regra", [
  z.object({ regra: z.literal("piso_fator"), fator: z.number().positive().max(1) }),
  z.object({ regra: z.literal("minimo_percentual"), percentual: z.number().positive().max(1) }),
  z.object({ regra: z.literal("minimo_absoluto"), valor: z.number().min(0) }),
]);

export interface Topico {
  codigo: string;
  titulo: string;
  canonico?: string;
  subtopicos?: Topico[];
}

export const topicoSchema: z.ZodType<Topico> = z.lazy(() =>
  z.object({
    codigo: z.string().min(1),
    titulo: z.string().min(1),
    canonico: slugCanonico.optional(),
    subtopicos: z.array(topicoSchema).min(1).optional(),
  }),
);

const distribuicaoSchema = z.object({
  estimada: z.boolean(),
  disciplinas: z.record(z.string(), z.number().int().min(0)),
});

const provaObjetivaSchema = z.object({
  slug,
  nome: z.string().min(1),
  tipo: z.literal("objetiva"),
  formato: z.enum(["certo_errado", "multipla_escolha"]),
  itens: z.number().int().positive(),
  alternativas: z.number().int().min(2).max(5).optional(),
  pontuacao: regraPontuacaoSchema,
  corte: regraCorteSchema.optional(),
  disciplinas: z.array(slug).min(1),
  distribuicao_estimada: distribuicaoSchema,
});

const provaDiscursivaSchema = z.object({
  slug,
  nome: z.string().min(1),
  tipo: z.literal("discursiva"),
  pontuacao_maxima: z.number().positive(),
  linhas_max: z.number().int().positive(),
  nota_minima: z.number().min(0),
  disciplinas: z.array(slug).min(1),
});

const provaSchema = z.discriminatedUnion("tipo", [provaObjetivaSchema, provaDiscursivaSchema]);

const cargoSchema = z.object({
  slug,
  nome: z.string().min(1),
  qualificacoes: z.array(z.string().min(1)).optional(),
  duracao_min: z.number().int().positive(),
  provas: z.array(slug).min(1),
  corte_conjunto: z
    .object({ provas: z.array(slug).min(2), corte: regraCorteSchema })
    .optional(),
});

const disciplinaSchema = z.object({
  slug,
  nome: z.string().min(1),
  topicos: z.array(topicoSchema).min(1),
});

const editalBaseSchema = z.object({
  slug,
  nome: z.string().min(1),
  banca: slug,
  data_prova: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser AAAA-MM-DD"),
  editais_fonte: z.array(z.string().min(1)).min(1),
  ressalvas: z.array(z.string()).default([]),
  cargos: z.array(cargoSchema).min(1),
  provas: z.array(provaSchema).min(1),
  disciplinas: z.array(disciplinaSchema).min(1),
});

type EditalBase = z.infer<typeof editalBaseSchema>;

function duplicados(valores: string[]): string[] {
  const vistos = new Set<string>();
  const dup = new Set<string>();
  for (const v of valores) (vistos.has(v) ? dup : vistos).add(v);
  return [...dup];
}

function verificarTopicos(disciplina: string, topicos: Topico[], codigos: string[], problemas: string[]) {
  for (const t of topicos) {
    codigos.push(t.codigo);
    if (t.subtopicos) verificarTopicos(disciplina, t.subtopicos, codigos, problemas);
    else if (!t.canonico) problemas.push(`tópico folha sem canônico: ${disciplina} ${t.codigo}`);
  }
}

export function problemasDeReferencia(e: EditalBase): string[] {
  const problemas: string[] = [];
  const provas = new Map(e.provas.map((p) => [p.slug, p]));
  const disciplinas = new Set(e.disciplinas.map((d) => d.slug));

  for (const [nome, lista] of [
    ["cargo", e.cargos.map((c) => c.slug)],
    ["prova", e.provas.map((p) => p.slug)],
    ["disciplina", e.disciplinas.map((d) => d.slug)],
  ] as const) {
    for (const d of duplicados(lista)) problemas.push(`${nome} duplicado: ${d}`);
  }

  for (const c of e.cargos) {
    for (const p of c.provas) if (!provas.has(p)) problemas.push(`cargo ${c.slug} referencia prova inexistente: ${p}`);
    for (const p of c.corte_conjunto?.provas ?? []) {
      if (!c.provas.includes(p)) problemas.push(`corte_conjunto referencia prova fora do cargo: ${p}`);
      else if (provas.get(p)?.tipo !== "objetiva") problemas.push(`corte_conjunto referencia prova não objetiva: ${p}`);
    }
  }

  for (const p of e.provas) {
    for (const d of p.disciplinas) {
      if (!disciplinas.has(d)) problemas.push(`prova ${p.slug} referencia disciplina inexistente: ${d}`);
    }
    if (p.tipo !== "objetiva") continue;
    if (p.formato === "multipla_escolha" && p.alternativas === undefined) {
      problemas.push(`múltipla escolha sem alternativas: ${p.slug}`);
    }
    const chaves = Object.keys(p.distribuicao_estimada.disciplinas).sort();
    if (chaves.join(",") !== [...p.disciplinas].sort().join(",")) {
      problemas.push(`prova ${p.slug}: disciplinas da distribuição diferem das disciplinas da prova`);
    }
    const soma = Object.values(p.distribuicao_estimada.disciplinas).reduce((a, b) => a + b, 0);
    if (soma !== p.itens) problemas.push(`prova ${p.slug}: distribuição soma ${soma}, esperado ${p.itens}`);
  }

  for (const d of e.disciplinas) {
    const codigos: string[] = [];
    verificarTopicos(d.slug, d.topicos, codigos, problemas);
    for (const c of duplicados(codigos)) problemas.push(`código duplicado: ${d.slug} ${c}`);
  }

  return problemas;
}

export const editalSchema = editalBaseSchema.superRefine((e, ctx) => {
  for (const message of problemasDeReferencia(e)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

export type Edital = z.infer<typeof editalSchema>;
export type Cargo = Edital["cargos"][number];
export type Prova = Edital["provas"][number];
export type ProvaObjetiva = Extract<Prova, { tipo: "objetiva" }>;
export type ProvaDiscursiva = Extract<Prova, { tipo: "discursiva" }>;
export type Disciplina = Edital["disciplinas"][number];
export type RegraPontuacao = z.infer<typeof regraPontuacaoSchema>;
export type RegraCorte = z.infer<typeof regraCorteSchema>;

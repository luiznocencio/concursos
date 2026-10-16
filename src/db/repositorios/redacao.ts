import { z } from "zod";
import type { ConfigDiscursiva } from "@/core";
import { BUCKET_FOTOS } from "@/lib/redacao";
import type { Database, Json } from "../types";
import type { Cliente } from "./estudo";

// Leitura e escrita das redações pelo próprio usuário (cliente com RLS). O worker usa repositorios/discursiva.ts.

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

// Erro de uma função do banco (limites, estado inválido): a mensagem vai para mensagemDoBanco.
export class ErroRedacao extends Error {}


const aspectoSchema = z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() });
const temaSchema = z.object({
  textos_apoio: z.array(z.object({ titulo: z.string().default(""), texto: z.string(), fonte: z.string().default("") })),
  padrao_resposta: z.object({ aspectos: z.array(aspectoSchema), expectativas: z.string().default("") }),
});
const configSchema = z.object({
  pontuacao_maxima: z.number(),
  linhas_max: z.number(),
  nota_minima: z.number(),
  caracteres_por_linha: z.number().default(70),
});
const detalhesSchema = z
  .object({
    aspectos: z.array(aspectoSchema.extend({ nota: z.number() })),
    usadas: z.array(z.string()),
    erros_descartados: z.number(),
  })
  .nullable();
const prioridadeSchema = z.object({
  tipo: z.enum(["aspecto", "erro"]),
  titulo: z.string(),
  detalhe: z.string(),
  canonico: z.string().optional(),
});

export interface TemaResumo {
  id: string;
  enunciado: string;
  origem: "gerado" | "real";
  provaOrigem: string | null;
  feito: boolean;
}

export interface RedacaoResumo {
  id: string;
  tema: string;
  status: string;
  npd: number | null;
  criadaEm: string;
  corrigidaEm: string | null;
}

export interface RedacaoCompleta {
  id: string;
  status: string;
  aviso: string | null;
  entrada: string;
  texto: string;
  linhas: string[];
  excedente: string[];
  fotos: string[];
  nc: number | null;
  ne: number | null;
  tl: number | null;
  npd: number | null;
  zeradaMotivo: string | null;
  terceiraCorrecao: boolean;
  prioridades: z.infer<typeof prioridadeSchema>[];
  detalhes: z.infer<typeof detalhesSchema>;
  tema: {
    enunciado: string;
    origem: string;
    provaOrigem: string | null;
    textosApoio: { titulo: string; texto: string; fonte: string }[];
    padrao: { aspectos: z.infer<typeof aspectoSchema>[]; expectativas: string };
  };
  config: ConfigDiscursiva;
  correcoes: { papel: string; provedor: string; modelo: string; resposta: Json }[];
  erros: Database["public"]["Tables"]["erros_redacao"]["Row"][];
}

// Temas aprovados do concurso: reais primeiro, depois os mais recentes. `feito` marca os que o usuário já usou.
export async function listarTemas(db: Cliente, concursoSlug: string, limite = 30): Promise<TemaResumo[]> {
  const { data, error } = await db
    .from("temas_discursiva")
    .select("id, enunciado, origem, prova_origem, criado_em, concursos!inner(slug), redacoes(id)")
    .eq("concursos.slug", concursoSlug)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) falhou("listar temas", error);
  return data
    .map((t) => ({
      id: t.id,
      enunciado: t.enunciado,
      origem: t.origem === "real" ? ("real" as const) : ("gerado" as const),
      provaOrigem: t.prova_origem,
      feito: t.redacoes.length > 0,
    }))
    .sort((a, b) => Number(b.origem === "real") - Number(a.origem === "real"));
}

export async function listarRedacoes(db: Cliente, limite = 50): Promise<RedacaoResumo[]> {
  const { data, error } = await db
    .from("redacoes")
    .select("id, status, npd, criado_em, corrigida_em, temas_discursiva!inner(enunciado)")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) falhou("listar redações", error);
  return data.map((r) => ({
    id: r.id,
    tema: r.temas_discursiva.enunciado,
    status: r.status,
    npd: r.npd,
    criadaEm: r.criado_em,
    corrigidaEm: r.corrigida_em,
  }));
}

export async function criarRedacao(db: Cliente, usuarioId: string, temaId: string): Promise<string> {
  const { data, error } = await db.from("redacoes").insert({ usuario_id: usuarioId, tema_id: temaId }).select("id").single();
  if (error) falhou("criar redação", error);
  return data.id;
}

export async function carregarRedacao(db: Cliente, id: string): Promise<RedacaoCompleta | null> {
  const { data, error } = await db
    .from("redacoes")
    .select(
      `id, status, aviso, entrada, texto, linhas, excedente, fotos, nc, ne, tl, npd, zerada_motivo, terceira_correcao,
       prioridades, detalhes,
       temas_discursiva!inner(enunciado, origem, prova_origem, textos_apoio, padrao_resposta, provas!inner(config_discursiva)),
       correcoes_discursiva(papel, provedor, modelo, resposta),
       erros_redacao(id, redacao_id, usuario_id, linha, trecho, tipo, categoria, correcao, explicacao, canonico, criado_em)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar redação", error);
  if (!data) return null;
  const tema = temaSchema.parse(data.temas_discursiva);
  const config = configSchema.parse(data.temas_discursiva.provas.config_discursiva);
  return {
    id: data.id,
    status: data.status,
    aviso: data.aviso,
    entrada: data.entrada,
    texto: data.texto,
    linhas: data.linhas,
    excedente: data.excedente,
    fotos: data.fotos,
    nc: data.nc,
    ne: data.ne,
    tl: data.tl,
    npd: data.npd,
    zeradaMotivo: data.zerada_motivo,
    terceiraCorrecao: data.terceira_correcao,
    prioridades: z.array(prioridadeSchema).catch([]).parse(data.prioridades ?? []),
    detalhes: detalhesSchema.catch(null).parse(data.detalhes),
    tema: {
      enunciado: data.temas_discursiva.enunciado,
      origem: data.temas_discursiva.origem,
      provaOrigem: data.temas_discursiva.prova_origem,
      textosApoio: tema.textos_apoio,
      padrao: tema.padrao_resposta,
    },
    config: {
      pontuacaoMaxima: config.pontuacao_maxima,
      linhasMax: config.linhas_max,
      notaMinima: config.nota_minima,
      caracteresPorLinha: config.caracteres_por_linha,
    },
    correcoes: data.correcoes_discursiva,
    erros: [...data.erros_redacao].sort((a, b) => a.linha - b.linha),
  };
}

// Só grava enquanto a redação é rascunho (a RLS recusa depois); devolve false se nada foi alterado.
export async function salvarTexto(
  db: Cliente,
  id: string,
  dados: { texto?: string; linhas: string[]; excedente: string[] },
): Promise<boolean> {
  const { data, error } = await db.from("redacoes").update(dados).eq("id", id).select("id");
  if (error) falhou("salvar redação", error);
  return data.length > 0;
}

async function rpc(db: Cliente, chamada: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await chamada;
  if (error) throw new ErroRedacao(error.message);
}

export function entregarRedacao(db: Cliente, id: string) {
  return rpc(db, db.rpc("discursiva_entregar", { p_redacao: id }));
}

export function enviarFotos(db: Cliente, id: string, caminhos: string[]) {
  return rpc(db, db.rpc("discursiva_enviar_fotos", { p_redacao: id, p_fotos: caminhos }));
}

// true se enfileirou; false se o usuário já tinha um pedido de tema aberto.
export async function pedirTema(db: Cliente, concursoSlug: string): Promise<boolean> {
  const { data, error } = await db.rpc("discursiva_pedir_tema", { p_concurso: concursoSlug });
  if (error) throw new ErroRedacao(error.message);
  return data;
}

// URLs temporárias (30 min) para mostrar as fotos da folha ao lado da transcrição.
export async function urlsDasFotos(db: Cliente, caminhos: string[]): Promise<string[]> {
  if (caminhos.length === 0) return [];
  const { data, error } = await db.storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, 60 * 30);
  if (error) falhou("assinar fotos", error);
  return data.map((d) => d.signedUrl ?? "").filter(Boolean);
}

// Configuração da prova discursiva do concurso (nota máxima e mínimo), para a lista de redações.
export async function configDaDiscursiva(db: Cliente, concursoSlug: string): Promise<ConfigDiscursiva | null> {
  const { data, error } = await db
    .from("provas")
    .select("config_discursiva, concursos!inner(slug)")
    .eq("tipo", "discursiva")
    .eq("concursos.slug", concursoSlug)
    .limit(1)
    .maybeSingle();
  if (error) falhou("configuração da discursiva", error);
  if (!data) return null;
  const c = configSchema.parse(data.config_discursiva);
  return { pontuacaoMaxima: c.pontuacao_maxima, linhasMax: c.linhas_max, notaMinima: c.nota_minima, caracteresPorLinha: c.caracteres_por_linha };
}

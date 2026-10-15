import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ItemCandidato } from "@/core";
import { montarEstruturaCargo, type EstruturaCargo, type LinhaCargo } from "@/estudo/estrutura";
import type { ConfigSessao, Marcacao, ModoSessao, RepositorioEstudo, ResultadoSessao } from "@/estudo/tipos";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import type { Database, Json } from "../types";

export type Cliente = SupabaseClient<Database>;

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

const candidatosSchema = z.array(
  z.object({
    id: z.string(),
    textoBaseId: z.string().nullable(),
    canonicos: z.array(z.string()),
    visto: z.boolean(),
    origem: z.enum(["real", "ia"]),
  }),
);
const historicoSchema = z.array(
  z.object({
    canonico: z.string(),
    resultado: z.enum(["certo", "certo_duvida", "errado", "branco"]),
    respondidaEm: z.string(),
  }),
);
export const configSessaoSchema: z.ZodType<ConfigSessao> = z.union([
  z.object({ tipo: z.literal("estudar_agora") }),
  z.object({ tipo: z.literal("topico"), canonicos: z.array(z.string()) }),
  z.object({ tipo: z.literal("revisao") }),
  z.object({
    tipo: z.literal("completo"),
    duracaoMin: z.number(),
    provas: z.array(z.object({ slug: z.string(), itens: z.array(z.string()) })),
    disciplinaDoItem: z.record(z.string(), z.string()),
  }),
]);

const SELECT_ESTRUTURA = `id, slug, nome, duracao_min, corte_conjunto,
  concursos!inner(id, slug, nome, data_prova),
  cargo_provas(ordem, provas!inner(id, slug, nome, tipo, n_itens, regra_pontuacao, regra_corte, distribuicao,
    prova_disciplinas(ordem, disciplinas!inner(slug, nome,
      topicos(id, codigo, titulo, parent_id, ordem, topicos_canonicos(slug))))))`;

export async function carregarEstrutura(db: Cliente, cargoId: string): Promise<EstruturaCargo> {
  const { data, error } = await db.from("cargos").select(SELECT_ESTRUTURA).eq("id", cargoId).single();
  if (error) falhou(`cargo ${cargoId}`, error);
  return montarEstruturaCargo(data as unknown as LinhaCargo);
}

// Em modo produto (itensReais = false) os itens reais saem das sessões: sem candidato, eles também
// não entram em treino, simulado nem revisão. O gerador continua a usá-los como referência de estilo.
export function filtrarCandidatos(linhas: z.infer<typeof candidatosSchema>, itensReais: boolean): ItemCandidato[] {
  return linhas
    .filter((l) => itensReais || l.origem !== "real")
    .map(({ id, textoBaseId, canonicos, visto }) => ({ id, textoBaseId, canonicos, visto }));
}

// Implementação com o cliente do usuário: o RLS garante que cada um só vê e grava o que é seu.
export function criarRepositorioEstudo(db: Cliente, opcoes: { itensReais?: boolean } = {}): RepositorioEstudo {
  const itensReais = opcoes.itensReais ?? itensReaisVisiveis();
  const estruturas = new Map<string, Promise<EstruturaCargo>>();

  return {
    estrutura(cargoId) {
      if (!estruturas.has(cargoId)) estruturas.set(cargoId, carregarEstrutura(db, cargoId));
      return estruturas.get(cargoId)!;
    },

    async candidatos(cargoId) {
      const { data, error } = await db.rpc("estudo_candidatos", { p_cargo: cargoId });
      if (error) falhou("candidatos", error);
      return filtrarCandidatos(candidatosSchema.parse(data), itensReais);
    },

    async historico(cargoId) {
      const { data, error } = await db.rpc("estudo_historico", { p_cargo: cargoId });
      if (error) falhou("histórico", error);
      return historicoSchema.parse(data).map((r) => ({ ...r, respondidaEm: new Date(r.respondidaEm) }));
    },

    async revisoesVencidas(agora) {
      const { data, error } = await db
        .from("revisao_espacada")
        .select("item_id")
        .lte("proxima_em", agora.toISOString())
        .order("proxima_em")
        .limit(500);
      if (error) falhou("revisões vencidas", error);
      return data.map((r) => r.item_id);
    },

    async criarSessao(cargoId, modo, config, itens) {
      const { data, error } = await db.rpc("simulado_criar", {
        p_cargo: cargoId,
        p_modo: modo,
        p_config: config as unknown as Json,
        p_itens: itens,
      });
      if (error) falhou("criar sessão", error);
      return data;
    },

    async pedirGeracao(concurso, canonicos) {
      const { data, error } = await db.rpc("estudo_pedir_geracao", { p_concurso: concurso, p_canonicos: canonicos });
      if (error) falhou("pedir geração", error);
      return data;
    },

    async sessao(id) {
      const { data, error } = await db
        .from("simulados")
        .select("id, cargo_id, modo, config, iniciado_em, finalizado_em, simulado_itens(item_id, ordem)")
        .eq("id", id)
        .maybeSingle();
      if (error) falhou("sessão", error);
      if (!data) return null;
      return {
        id: data.id,
        cargoId: data.cargo_id,
        modo: data.modo as ModoSessao,
        config: configSessaoSchema.parse(data.config),
        iniciadaEm: new Date(data.iniciado_em),
        finalizadaEm: data.finalizado_em ? new Date(data.finalizado_em) : null,
        itens: [...data.simulado_itens].sort((a, b) => a.ordem - b.ordem).map((i) => i.item_id),
      };
    },

    async itensCorrecao(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db.from("itens").select("id, gabarito, justificativa, citacao, fontes(titulo)").in("id", ids);
      if (error) falhou("itens", error);
      return data.map((i) => ({
        id: i.id,
        gabarito: i.gabarito,
        justificativa: i.justificativa,
        citacao: i.citacao,
        fonte: i.fontes?.titulo ?? null,
      }));
    },

    async respostas(sessaoId) {
      const { data, error } = await db.from("respostas").select("item_id, resposta, duvida").eq("simulado_id", sessaoId);
      if (error) falhou("respostas", error);
      return data.map((r) => ({ itemId: r.item_id, resposta: r.resposta as Marcacao, duvida: r.duvida }));
    },

    async gravarResposta(sessaoId, r, substituir) {
      const { data, error } = await db
        .from("respostas")
        .upsert(
          {
            simulado_id: sessaoId,
            item_id: r.itemId,
            resposta: r.resposta,
            duvida: r.duvida,
            tempo_ms: r.tempoMs,
            respondida_em: new Date().toISOString(),
          },
          { onConflict: "simulado_id,item_id", ignoreDuplicates: !substituir },
        )
        .select("id");
      if (error) falhou("gravar resposta", error);
      return data.length > 0;
    },

    async estadosRevisao(ids) {
      if (ids.length === 0) return new Map();
      const { data, error } = await db.from("revisao_espacada").select("item_id, etapa, proxima_em").in("item_id", ids);
      if (error) falhou("revisão espaçada", error);
      return new Map(data.map((r) => [r.item_id, { etapa: r.etapa, proximaEm: new Date(r.proxima_em) }]));
    },

    async salvarRevisao(itemId, estado) {
      const { error } = estado
        ? await db
            .from("revisao_espacada")
            .upsert({ item_id: itemId, etapa: estado.etapa, proxima_em: estado.proximaEm.toISOString() }, { onConflict: "user_id,item_id" })
        : await db.from("revisao_espacada").delete().eq("item_id", itemId);
      if (error) falhou("salvar revisão", error);
    },

    async finalizar(sessaoId, resultado: ResultadoSessao, agora) {
      const { error } = await db
        .from("simulados")
        .update({ finalizado_em: agora.toISOString(), resultado: resultado as unknown as Json })
        .eq("id", sessaoId)
        .is("finalizado_em", null);
      if (error) falhou("finalizar sessão", error);
    },
  };
}

// ---- Leituras das telas ----

export async function listarCargos(db: Cliente) {
  const { data, error } = await db
    .from("cargos")
    .select("id, slug, nome, concursos!inner(slug, nome, data_prova)")
    .order("nome");
  if (error) falhou("cargos", error);
  return data.map((c) => ({
    id: c.id,
    nome: c.nome,
    concurso: c.concursos.nome,
    dataProva: c.concursos.data_prova,
  }));
}

export interface SessaoResumo {
  id: string;
  modo: ModoSessao;
  config: ConfigSessao;
  iniciadaEm: string;
  finalizadaEm: string | null;
  total: number;
  respondidos: number;
  resultado: ResultadoSessao | null;
}

export async function listarSessoes(
  db: Cliente,
  cargoId: string,
  filtro: { abertas?: boolean; modo?: ModoSessao; limite?: number } = {},
): Promise<SessaoResumo[]> {
  let q = db
    .from("simulados")
    .select("id, modo, config, iniciado_em, finalizado_em, resultado, simulado_itens(count), respostas(count)")
    .eq("cargo_id", cargoId)
    .order("iniciado_em", { ascending: false })
    .limit(filtro.limite ?? 20);
  if (filtro.abertas !== undefined) q = filtro.abertas ? q.is("finalizado_em", null) : q.not("finalizado_em", "is", null);
  if (filtro.modo) q = q.eq("modo", filtro.modo);
  const { data, error } = await q;
  if (error) falhou("sessões", error);
  return data.map((s) => ({
    id: s.id,
    modo: s.modo as ModoSessao,
    config: configSessaoSchema.parse(s.config),
    iniciadaEm: s.iniciado_em,
    finalizadaEm: s.finalizado_em,
    total: s.simulado_itens[0]?.count ?? 0,
    respondidos: s.respostas[0]?.count ?? 0,
    resultado: (s.resultado as ResultadoSessao | null) ?? null,
  }));
}

export async function contarRevisoesVencidas(db: Cliente, agora: Date): Promise<number> {
  const { count, error } = await db
    .from("revisao_espacada")
    .select("item_id", { count: "exact", head: true })
    .lte("proxima_em", agora.toISOString());
  if (error) falhou("contar revisões", error);
  return count ?? 0;
}

export interface ItemDaSessao {
  id: string;
  ordem: number;
  enunciado: string;
  textoBase: string | null;
  topicos: string[];
  resposta: { resposta: Marcacao; duvida: boolean } | null;
  // Só vem preenchida quando a pessoa já pode ver: item respondido no treino ou simulado entregue.
  correcao: { gabarito: string; justificativa: string; citacao: string | null; fonte: string | null } | null;
}

// Itens para a tela da sessão. O gabarito nunca vai ao navegador antes da hora.
export async function itensDaSessao(db: Cliente, sessaoId: string, podeVerCorrecao: (respondido: boolean) => boolean) {
  const { data, error } = await db
    .from("simulado_itens")
    .select(
      "ordem, itens!inner(id, enunciado, gabarito, justificativa, citacao, fontes(titulo), textos_base(conteudo), item_topicos(topicos_canonicos(titulo)))",
    )
    .eq("simulado_id", sessaoId)
    .order("ordem");
  if (error) falhou("itens da sessão", error);
  const { data: respostas, error: e2 } = await db
    .from("respostas")
    .select("item_id, resposta, duvida")
    .eq("simulado_id", sessaoId);
  if (e2) falhou("respostas da sessão", e2);
  const porItem = new Map(respostas.map((r) => [r.item_id, { resposta: r.resposta as Marcacao, duvida: r.duvida }]));

  return data.map<ItemDaSessao>(({ ordem, itens: i }) => {
    const resposta = porItem.get(i.id) ?? null;
    return {
      id: i.id,
      ordem,
      enunciado: i.enunciado,
      textoBase: i.textos_base?.conteudo ?? null,
      topicos: i.item_topicos.map((t) => t.topicos_canonicos.titulo),
      resposta,
      correcao: podeVerCorrecao(resposta !== null)
        ? { gabarito: i.gabarito, justificativa: i.justificativa, citacao: i.citacao, fonte: i.fontes?.titulo ?? null }
        : null,
    };
  });
}

export async function marcarSuspeito(db: Cliente, itemId: string, motivo: string): Promise<void> {
  const { error } = await db.rpc("itens_marcar_suspeito", { p_item: itemId, p_motivo: motivo });
  if (error) falhou("marcar suspeito", error);
}

export interface ItemParaRevisar {
  id: string;
  status: "revisao" | "suspeito";
  enunciado: string;
  textoBase: string | null;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
  topicos: string[];
  validacao: Json;
  criadoEm: string;
}

export async function filaRevisaoItens(db: Cliente, limite = 50): Promise<ItemParaRevisar[]> {
  const { data, error } = await db
    .from("itens")
    .select(
      "id, status, enunciado, gabarito, justificativa, citacao, validacao, criado_em, fontes(titulo), textos_base(conteudo), item_topicos(topicos_canonicos(titulo))",
    )
    .in("status", ["suspeito", "revisao"])
    .order("status", { ascending: false })
    .order("criado_em")
    .limit(limite);
  if (error) falhou("fila de revisão", error);
  return data.map((i) => ({
    id: i.id,
    status: i.status as ItemParaRevisar["status"],
    enunciado: i.enunciado,
    textoBase: i.textos_base?.conteudo ?? null,
    gabarito: i.gabarito,
    justificativa: i.justificativa,
    citacao: i.citacao,
    fonte: i.fontes?.titulo ?? null,
    topicos: i.item_topicos.map((t) => t.topicos_canonicos.titulo),
    validacao: i.validacao,
    criadoEm: i.criado_em,
  }));
}

export async function resultadoGuardado(db: Cliente, sessaoId: string): Promise<ResultadoSessao | null> {
  const { data, error } = await db.from("simulados").select("resultado").eq("id", sessaoId).maybeSingle();
  if (error) falhou("resultado", error);
  return (data?.resultado as ResultadoSessao | null) ?? null;
}

export async function contarFilaItens(db: Cliente): Promise<number> {
  const { count, error } = await db
    .from("itens")
    .select("id", { count: "exact", head: true })
    .in("status", ["suspeito", "revisao"]);
  if (error) falhou("contar fila de itens", error);
  return count ?? 0;
}

import type { UsoIa } from "../../ai/tipos";
import type { ContextoGeracao, FilaJobs } from "../../pipeline/executar-job";
import type { LoteParaGravar, RepositorioPipeline } from "../../pipeline/gerar-lote";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export function criarRepositorioPipeline(db: ClienteServico): RepositorioPipeline {
  return {
    async hashesExistentes(hashes) {
      if (hashes.length === 0) return new Set();
      const { data, error } = await db.from("itens").select("hash_normalizado").in("hash_normalizado", hashes);
      if (error) falhou("hashesExistentes", error);
      return new Set(data.map((d) => d.hash_normalizado));
    },

    async exemplosReais(canonico, limite) {
      const { data, error } = await db
        .from("itens")
        .select("enunciado, gabarito, item_topicos!inner(topicos_canonicos!inner(slug))")
        .eq("origem", "real")
        .eq("status", "aprovado")
        .eq("item_topicos.topicos_canonicos.slug", canonico)
        .limit(limite);
      if (error) falhou("exemplosReais", error);
      return data.map((d) => ({ enunciado: d.enunciado, gabarito: d.gabarito }));
    },

    async registrarLote(lote: LoteParaGravar) {
      const { data, error } = await db.rpc("itens_registrar_lote", { p_lote: lote as unknown as Json });
      if (error) falhou("registrarLote", error);
      return data;
    },

    async registrarUso(uso: UsoIa, finalidade, jobId) {
      const { error } = await db.rpc("ia_registrar_uso", {
        p_uso: {
          provedor: uso.provedor,
          modelo: uso.modelo,
          finalidade,
          tokens_entrada: uso.tokensEntrada,
          tokens_saida: uso.tokensSaida,
          custo_usd: uso.custoUsd,
          job_id: jobId,
        },
      });
      if (error) falhou("registrarUso", error);
    },
  };
}

export function criarFilaJobs(db: ClienteServico): FilaJobs {
  return {
    async reservar() {
      const { data, error } = await db.rpc("jobs_reservar");
      if (error) falhou("reservar job", error);
      const job = data[0];
      return job ? { id: job.id, tipo: job.tipo, payload: job.payload, tentativas: job.tentativas } : null;
    },
    async concluir(id) {
      const { error } = await db.rpc("jobs_concluir", { p_id: id });
      if (error) falhou("concluir job", error);
    },
    async falhar(id, erro, maxTentativas) {
      const { error } = await db.rpc("jobs_falhar", { p_id: id, p_erro: erro, p_max_tentativas: maxTentativas });
      if (error) falhou("registrar falha do job", error);
    },
  };
}

export async function enfileirarGeracao(db: ClienteServico, concurso: string, canonico: string, quantidade: number) {
  const { data, error } = await db.rpc("jobs_enfileirar_geracao", {
    p_concurso: concurso,
    p_canonico: canonico,
    p_quantidade: quantidade,
  });
  if (error) falhou("enfileirar geração", error);
  return data;
}

// Monta o contexto do tópico canônico no concurso: banca, disciplina, caminho no programa e fonte legal.
export async function carregarContexto(db: ClienteServico, concurso: string, canonico: string): Promise<ContextoGeracao> {
  const { data: c, error: e1 } = await db.from("concursos").select("id, bancas(slug)").eq("slug", concurso).single();
  if (e1) falhou(`concurso ${concurso}`, e1);

  const { data: topicos, error: e2 } = await db
    .from("topicos")
    .select("codigo, titulo, parent_id, disciplinas!inner(nome, concurso_id), topicos_canonicos!inner(slug)")
    .eq("topicos_canonicos.slug", canonico)
    .eq("disciplinas.concurso_id", c.id)
    .order("ordem")
    .limit(1);
  if (e2) falhou(`tópico ${canonico}`, e2);
  const topico = topicos[0];
  if (!topico) throw new Error(`Tópico ${canonico} não existe no concurso ${concurso}`);

  const caminho = [`${topico.codigo} ${topico.titulo}`];
  let pai = topico.parent_id;
  while (pai) {
    const { data, error } = await db.from("topicos").select("codigo, titulo, parent_id").eq("id", pai).single();
    if (error) falhou("tópico pai", error);
    caminho.unshift(`${data.codigo} ${data.titulo}`);
    pai = data.parent_id;
  }

  const { data: fonte, error: e3 } = await db
    .from("fontes")
    .select("slug, titulo, fonte_dispositivos(referencia, texto, ordem)")
    .contains("canonicos", [canonico])
    .maybeSingle();
  if (e3) falhou("fonte legal", e3);

  return {
    banca: c.bancas.slug,
    topico: { canonico, disciplina: topico.disciplinas.nome, programa: caminho.join(" > ") },
    fonte: fonte
      ? {
          slug: fonte.slug,
          titulo: fonte.titulo,
          dispositivos: [...fonte.fonte_dispositivos]
            .sort((x, y) => x.ordem - y.ordem)
            .map((d) => ({ referencia: d.referencia, texto: d.texto })),
        }
      : null,
  };
}

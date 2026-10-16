import { z } from "zod/v4";
import { CANONICO_POR_CATEGORIA } from "../../core/discursiva/erros";
import type { ImagemIa } from "../../ai/tipos";
import { hashTema } from "../../pipeline/discursiva/hash";
import type { PapelCorrecao, RepositorioDiscursiva } from "../../pipeline/discursiva/tipos";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";
import { criarRepositorioPipeline } from "./pipeline";

export const BUCKET_FOTOS = "redacoes-fotos";
const DIAS_GUARDAR_FOTOS = 30;
const PAPEIS: PapelCorrecao[] = ["conteudo_1", "conteudo_2", "conteudo_3", "lingua", "transcricao"];

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

const temaSchema = z.object({
  enunciado: z.string(),
  textos_apoio: z.array(z.object({ titulo: z.string().default(""), texto: z.string(), fonte: z.string().default("") })),
  padrao_resposta: z.object({
    aspectos: z.array(z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() })),
    expectativas: z.string().default(""),
  }),
});

const configSchema = z.object({
  pontuacao_maxima: z.number(),
  linhas_max: z.number(),
  nota_minima: z.number(),
  caracteres_por_linha: z.number().default(70),
});

function daquiADias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

function midiaDoCaminho(caminho: string): ImagemIa["midia"] {
  const ext = caminho.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export function criarRepositorioDiscursiva(db: ClienteServico): RepositorioDiscursiva {
  const pipeline = criarRepositorioPipeline(db);

  async function idsDoConcurso(concurso: string) {
    const { data, error } = await db
      .from("provas")
      .select("id, concurso_id, config_discursiva, concursos!inner(slug)")
      .eq("tipo", "discursiva")
      .eq("concursos.slug", concurso)
      .limit(1)
      .maybeSingle();
    if (error) falhou(`prova discursiva de ${concurso}`, error);
    if (!data) throw new Error(`Concurso ${concurso} sem prova discursiva`);
    return { provaId: data.id, concursoId: data.concurso_id, config: configSchema.parse(data.config_discursiva) };
  }

  return {
    async carregarRedacao(id) {
      const { data, error } = await db
        .from("redacoes")
        .select(
          "id, usuario_id, status, linhas, fotos, temas_discursiva!inner(enunciado, textos_apoio, padrao_resposta, provas!inner(config_discursiva))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) falhou("carregar redação", error);
      if (!data) return null;
      const tema = temaSchema.parse(data.temas_discursiva);
      const config = configSchema.parse(data.temas_discursiva.provas.config_discursiva);
      return {
        id: data.id,
        usuarioId: data.usuario_id,
        status: data.status,
        linhas: data.linhas,
        fotos: data.fotos,
        tema: { enunciado: tema.enunciado, textosApoio: tema.textos_apoio, padrao: tema.padrao_resposta },
        config: {
          pontuacaoMaxima: config.pontuacao_maxima,
          linhasMax: config.linhas_max,
          notaMinima: config.nota_minima,
          caracteresPorLinha: config.caracteres_por_linha,
        },
      };
    },

    async correcoes(redacaoId) {
      const { data, error } = await db.from("correcoes_discursiva").select("papel, resposta").eq("redacao_id", redacaoId);
      if (error) falhou("ler correções", error);
      const feitas: Partial<Record<PapelCorrecao, unknown>> = {};
      for (const c of data) if (PAPEIS.includes(c.papel as PapelCorrecao)) feitas[c.papel as PapelCorrecao] = c.resposta;
      return feitas;
    },

    async gravarCorrecao(redacaoId, papel, uso, resposta) {
      const { error } = await db.from("correcoes_discursiva").upsert(
        {
          redacao_id: redacaoId,
          papel,
          provedor: uso.provedor,
          modelo: uso.modelo,
          resposta: resposta as Json,
          custo_usd: uso.custoUsd,
        },
        { onConflict: "redacao_id,papel" },
      );
      if (error) falhou(`gravar correção ${papel}`, error);
    },

    async marcarStatus(redacaoId, status, aviso) {
      const { error } = await db
        .from("redacoes")
        .update({ status, aviso: aviso ?? null, atualizado_em: new Date().toISOString() })
        .eq("id", redacaoId);
      if (error) falhou(`marcar redação como ${status}`, error);
    },

    // Erros primeiro e o estado "corrigida" por último: se algo falhar no meio, a nova tentativa refaz tudo.
    async gravarResultado(r, res) {
      const { error: e1 } = await db.from("erros_redacao").delete().eq("redacao_id", r.id);
      if (e1) falhou("limpar erros da redação", e1);
      if (res.erros.length) {
        const { error: e2 } = await db.from("erros_redacao").insert(
          res.erros.map((e) => ({
            redacao_id: r.id,
            usuario_id: r.usuarioId,
            linha: e.linha,
            trecho: e.trecho,
            tipo: e.tipo,
            categoria: e.categoria,
            correcao: e.correcao,
            explicacao: e.explicacao,
            canonico: CANONICO_POR_CATEGORIA[e.categoria],
          })),
        );
        if (e2) falhou("gravar erros da redação", e2);
      }
      const papeis = ["conteudo_1", "conteudo_2", "conteudo_3"];
      const agora = new Date().toISOString();
      const { error: e3 } = await db
        .from("redacoes")
        .update({
          status: "corrigida",
          aviso: null,
          nc: res.nc,
          ne: res.ne,
          tl: res.tl,
          npd: res.npd,
          zerada_motivo: res.zeradaMotivo,
          terceira_correcao: res.terceiraCorrecao,
          prioridades: res.prioridades as unknown as Json,
          detalhes: {
            aspectos: res.aspectos,
            usadas: res.usadas.map((i) => papeis[i]),
            erros_descartados: res.errosDescartados,
          } as unknown as Json,
          corrigida_em: agora,
          fotos_apagar_em: r.fotos.length ? daquiADias(DIAS_GUARDAR_FOTOS) : null,
          atualizado_em: agora,
        })
        .eq("id", r.id);
      if (e3) falhou("gravar resultado da redação", e3);
    },

    async baixarFotos(caminhos) {
      return Promise.all(
        caminhos.map(async (caminho) => {
          const { data, error } = await db.storage.from(BUCKET_FOTOS).download(caminho);
          if (error) falhou(`baixar foto ${caminho}`, error);
          return { midia: midiaDoCaminho(caminho), base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
        }),
      );
    },

    // Foto ilegível: apaga as fotos e devolve a redação ao rascunho com o aviso, para o usuário enviar outra.
    async gravarTranscricao(r, t) {
      const agora = new Date().toISOString();
      if (t.ok) {
        const { error } = await db
          .from("redacoes")
          .update({
            status: "aguardando_confirmacao",
            linhas: t.linhas,
            excedente: t.excedente,
            aviso: null,
            fotos_apagar_em: daquiADias(DIAS_GUARDAR_FOTOS),
            atualizado_em: agora,
          })
          .eq("id", r.id);
        if (error) falhou("gravar transcrição", error);
        return;
      }
      if (r.fotos.length) {
        const { error } = await db.storage.from(BUCKET_FOTOS).remove(r.fotos);
        if (error) falhou("apagar fotos ilegíveis", error);
      }
      const { error } = await db
        .from("redacoes")
        .update({ status: "rascunho", aviso: t.aviso, fotos: [], fotos_apagar_em: null, atualizado_em: agora })
        .eq("id", r.id);
      if (error) falhou("devolver redação ao rascunho", error);
    },

    async contextoTema(concurso) {
      const { provaId, concursoId, config } = await idsDoConcurso(concurso);
      const { data: c, error: e1 } = await db.from("concursos").select("nome, bancas(slug)").eq("id", concursoId).single();
      if (e1) falhou(`concurso ${concurso}`, e1);
      const { data: disc, error: e2 } = await db
        .from("prova_disciplinas")
        .select("disciplinas(nome, topicos(titulo, ordem))")
        .eq("prova_id", provaId);
      if (e2) falhou("disciplinas da discursiva", e2);
      const { data: recentes, error: e3 } = await db
        .from("temas_discursiva")
        .select("enunciado")
        .eq("concurso_id", concursoId)
        .order("criado_em", { ascending: false })
        .limit(20);
      if (e3) falhou("temas recentes", e3);
      const disciplinas = disc.map((d) => d.disciplinas);
      return {
        banca: c.bancas.slug,
        concurso: c.nome,
        disciplina: disciplinas.map((d) => d.nome).join(", "),
        programa: disciplinas
          .flatMap((d) => [...d.topicos].sort((x, y) => x.ordem - y.ordem).map((t) => t.titulo))
          .join("; "),
        pontuacaoMaxima: config.pontuacao_maxima,
        linhasMax: config.linhas_max,
        temasRecentes: recentes.map((t) => t.enunciado.slice(0, 160)),
      };
    },

    async gravarTema(concurso, tema, status) {
      const { provaId, concursoId } = await idsDoConcurso(concurso);
      const { error } = await db.from("temas_discursiva").insert({
        concurso_id: concursoId,
        prova_id: provaId,
        origem: "gerado",
        status,
        enunciado: tema.enunciado,
        textos_apoio: tema.textos_apoio as unknown as Json,
        padrao_resposta: tema.padrao_resposta as unknown as Json,
        hash: hashTema(tema.enunciado),
      });
      if (error?.code === "23505") return false;
      if (error) falhou("gravar tema", error);
      return true;
    },

    registrarUso: pipeline.registrarUso,
  };
}

// Apaga do Storage as fotos de redações cujo prazo de guarda venceu (chamada pelo worker quando a fila está vazia).
export async function limparFotosVencidas(db: ClienteServico, limite = 20): Promise<number> {
  const { data, error } = await db
    .from("redacoes")
    .select("id, fotos")
    .lt("fotos_apagar_em", new Date().toISOString())
    .not("fotos", "eq", "{}")
    .limit(limite);
  if (error) falhou("listar fotos vencidas", error);
  for (const r of data) {
    const { error: e1 } = await db.storage.from(BUCKET_FOTOS).remove(r.fotos);
    if (e1) falhou("apagar fotos vencidas", e1);
    const { error: e2 } = await db.from("redacoes").update({ fotos: [], fotos_apagar_em: null }).eq("id", r.id);
    if (e2) falhou("limpar fotos da redação", e2);
  }
  return data.length;
}

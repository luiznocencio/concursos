import { z } from "zod/v4";
import type { UsoIa } from "../../ai/tipos";
import type { LoteReal } from "../../importacao/gravacao";
import { opcoesDeTopicos, type OpcaoTopico } from "../../importacao/topicos";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";
import type { Cliente } from "./estudo";
import { criarRepositorioPipeline } from "./pipeline";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export interface DadosImportacao {
  concurso: { id: string; nome: string };
  banca: string;
  opcoes: OpcaoTopico[];
}

// Concurso do cargo escolhido, a banca dele e os tópicos canônicos de todas as disciplinas do
// concurso (a P1 é compartilhada e uma prova antiga pode cobrir qualquer cargo). Leitura com o
// cliente do usuário: as tabelas do edital são públicas para autenticados.
export async function dadosDaImportacao(db: Cliente, cargoId: string): Promise<DadosImportacao> {
  const { data: cargo, error: e1 } = await db
    .from("cargos")
    .select("concursos!inner(id, nome, bancas!inner(slug))")
    .eq("id", cargoId)
    .single();
  if (e1) falhou(`cargo ${cargoId}`, e1);
  const concurso = cargo.concursos;

  const { data: topicos, error: e2 } = await db
    .from("topicos")
    .select("titulo, disciplinas!inner(nome, concurso_id), topicos_canonicos!inner(slug, titulo)")
    .eq("disciplinas.concurso_id", concurso.id)
    .limit(5_000);
  if (e2) falhou("tópicos do concurso", e2);

  return {
    concurso: { id: concurso.id, nome: concurso.nome },
    banca: concurso.bancas.slug,
    opcoes: opcoesDeTopicos(
      topicos.map((t) => ({
        canonico: t.topicos_canonicos.slug,
        titulo: t.topicos_canonicos.titulo,
        disciplina: t.disciplinas.nome,
      })),
    ),
  };
}

const resultadoSchema = z.object({ gravados: z.number(), duplicados: z.array(z.number()) });
export type ResultadoImportacao = z.infer<typeof resultadoSchema>;

// Chave secreta: a função SQL só executa como service_role. Quem chama confere o moderador.
export async function importarItensReais(db: ClienteServico, lote: LoteReal): Promise<ResultadoImportacao> {
  const { data, error } = await db.rpc("itens_importar_reais", { p_prova: lote as unknown as Json });
  if (error) falhou("importar itens reais", error);
  return resultadoSchema.parse(data);
}

export function registrarUsoSugestao(db: ClienteServico) {
  const repo = criarRepositorioPipeline(db);
  return (uso: UsoIa) => repo.registrarUso(uso, "sugerir_topicos", null);
}

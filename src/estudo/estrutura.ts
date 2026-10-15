import { z } from "zod";
import {
  regraCorteSchema,
  regraPontuacaoSchema,
  type DemandaDisciplina,
  type RegraCorte,
  type RegraPontuacao,
  type TopicoAlvo,
} from "@/core";

// Formato devolvido pela consulta aninhada do Supabase (ver repositorios/estudo.ts).
export interface LinhaTopico {
  id: string;
  codigo: string;
  titulo: string;
  parent_id: string | null;
  ordem: number;
  topicos_canonicos: { slug: string } | null;
}

export interface LinhaCargo {
  id: string;
  slug: string;
  nome: string;
  duracao_min: number;
  corte_conjunto: unknown;
  concursos: { id: string; slug: string; nome: string; data_prova: string };
  cargo_provas: {
    ordem: number;
    provas: {
      id: string;
      slug: string;
      nome: string;
      tipo: string;
      n_itens: number | null;
      regra_pontuacao: unknown;
      regra_corte: unknown;
      distribuicao: unknown;
      prova_disciplinas: {
        ordem: number;
        disciplinas: { slug: string; nome: string; topicos: LinhaTopico[] };
      }[];
    };
  }[];
}

export interface ProvaDoCargo {
  id: string;
  slug: string;
  nome: string;
  nItens: number;
  regra: RegraPontuacao;
  corte?: RegraCorte;
  demandas: DemandaDisciplina[];
}

export interface EstruturaCargo {
  cargo: { id: string; slug: string; nome: string; duracaoMin: number };
  concurso: { id: string; slug: string; nome: string; dataProva: string };
  provas: ProvaDoCargo[];
  temDiscursiva: boolean;
  corteConjunto?: { provas: string[]; corte: RegraCorte };
  topicosAlvo: TopicoAlvo[];
  disciplinas: Record<string, string>;
}

const distribuicaoSchema = z.object({ disciplinas: z.record(z.string(), z.number()) });
const corteConjuntoSchema = z.object({ provas: z.array(z.string()), corte: regraCorteSchema }).nullable();

function folhas(topicos: LinhaTopico[]): LinhaTopico[] {
  const pais = new Set(topicos.map((t) => t.parent_id).filter(Boolean));
  return topicos.filter((t) => !pais.has(t.id) && t.topicos_canonicos).sort((a, b) => a.ordem - b.ordem);
}

// Mesmas regras de core/edital/consultas.ts, a partir das tabelas: peso = itens estimados da
// disciplina na prova ÷ número de tópicos folha da disciplina.
export function montarEstruturaCargo(l: LinhaCargo): EstruturaCargo {
  const provas: ProvaDoCargo[] = [];
  const topicosAlvo: TopicoAlvo[] = [];
  const disciplinas: Record<string, string> = {};
  let temDiscursiva = false;

  for (const { provas: p } of [...l.cargo_provas].sort((a, b) => a.ordem - b.ordem)) {
    if (p.tipo !== "objetiva") {
      temDiscursiva = true;
      continue;
    }
    const distribuicao = distribuicaoSchema.parse(p.distribuicao).disciplinas;
    const demandas: DemandaDisciplina[] = [];
    for (const { disciplinas: d } of [...p.prova_disciplinas].sort((a, b) => a.ordem - b.ordem)) {
      disciplinas[d.slug] = d.nome;
      const lista = folhas(d.topicos);
      const quantidade = distribuicao[d.slug] ?? 0;
      for (const t of lista) {
        topicosAlvo.push({
          disciplina: d.slug,
          codigo: t.codigo,
          titulo: t.titulo,
          canonico: t.topicos_canonicos!.slug,
          chave: `${d.slug}:${t.codigo}`,
          peso: quantidade / lista.length,
        });
      }
      demandas.push({
        disciplina: d.slug,
        canonicos: [...new Set(lista.map((t) => t.topicos_canonicos!.slug))],
        quantidade,
      });
    }
    provas.push({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      nItens: p.n_itens ?? demandas.reduce((s, d) => s + d.quantidade, 0),
      regra: regraPontuacaoSchema.parse(p.regra_pontuacao),
      corte: p.regra_corte ? regraCorteSchema.parse(p.regra_corte) : undefined,
      demandas,
    });
  }

  const corteConjunto = corteConjuntoSchema.parse(l.corte_conjunto ?? null) ?? undefined;
  return {
    cargo: { id: l.id, slug: l.slug, nome: l.nome, duracaoMin: l.duracao_min },
    concurso: { id: l.concursos.id, slug: l.concursos.slug, nome: l.concursos.nome, dataProva: l.concursos.data_prova },
    provas,
    temDiscursiva,
    corteConjunto,
    topicosAlvo,
    disciplinas,
  };
}

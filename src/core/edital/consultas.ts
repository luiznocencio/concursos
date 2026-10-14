import type { Disciplina, Edital, ProvaObjetiva, Topico } from "./schema";

export interface TopicoFolha {
  disciplina: string;
  codigo: string;
  titulo: string;
  canonico: string;
}

export interface TopicoAlvo extends TopicoFolha {
  chave: string;
  peso: number;
}

export interface DemandaDisciplina {
  disciplina: string;
  canonicos: string[];
  quantidade: number;
}

function folhas(disciplina: string, topicos: Topico[]): TopicoFolha[] {
  return topicos.flatMap((t) =>
    t.subtopicos
      ? folhas(disciplina, t.subtopicos)
      : [{ disciplina, codigo: t.codigo, titulo: t.titulo, canonico: t.canonico as string }],
  );
}

export function topicosFolha(d: Disciplina): TopicoFolha[] {
  return folhas(d.slug, d.topicos);
}

function disciplinaPorSlug(e: Edital, slug: string): Disciplina {
  const d = e.disciplinas.find((x) => x.slug === slug);
  if (!d) throw new Error(`Disciplina desconhecida: ${slug}`);
  return d;
}

function provaObjetiva(e: Edital, slug: string): ProvaObjetiva {
  const p = e.provas.find((x) => x.slug === slug);
  if (!p || p.tipo !== "objetiva") throw new Error(`Prova objetiva desconhecida: ${slug}`);
  return p;
}

export function provasObjetivasDoCargo(e: Edital, cargo: string): ProvaObjetiva[] {
  const c = e.cargos.find((x) => x.slug === cargo);
  if (!c) throw new Error(`Cargo desconhecido: ${cargo}`);
  return e.provas.filter((p): p is ProvaObjetiva => p.tipo === "objetiva" && c.provas.includes(p.slug));
}

export function topicosAlvoDoCargo(e: Edital, cargo: string): TopicoAlvo[] {
  return provasObjetivasDoCargo(e, cargo).flatMap((p) =>
    p.disciplinas.flatMap((slug) => {
      const lista = topicosFolha(disciplinaPorSlug(e, slug));
      const itens = p.distribuicao_estimada.disciplinas[slug];
      return lista.map((t) => ({ ...t, chave: `${t.disciplina}:${t.codigo}`, peso: itens / lista.length }));
    }),
  );
}

export function demandasDaProva(e: Edital, prova: string): DemandaDisciplina[] {
  const p = provaObjetiva(e, prova);
  return p.disciplinas.map((slug) => ({
    disciplina: slug,
    canonicos: [...new Set(topicosFolha(disciplinaPorSlug(e, slug)).map((t) => t.canonico))],
    quantidade: p.distribuicao_estimada.disciplinas[slug],
  }));
}

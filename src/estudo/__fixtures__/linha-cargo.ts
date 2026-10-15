import type { Edital, Topico } from "@/core";
import type { LinhaCargo, LinhaTopico } from "../estrutura";

// Reproduz o que o seed grava no banco (ids, pais e ordem em profundidade por disciplina)
// para testar a estrutura montada a partir das tabelas contra core/edital/consultas.ts.
export function linhaDoEdital(e: Edital, cargo: string): LinhaCargo {
  const c = e.cargos.find((x) => x.slug === cargo)!;
  const topicosDa = (slug: string): LinhaTopico[] => {
    const linhas: LinhaTopico[] = [];
    const visitar = (ts: Topico[], pai: string | null) => {
      for (const t of ts) {
        const id = `${slug}:${t.codigo}`;
        linhas.push({
          id,
          codigo: t.codigo,
          titulo: t.titulo,
          parent_id: pai,
          ordem: linhas.length,
          topicos_canonicos: t.canonico ? { slug: t.canonico } : null,
        });
        if (t.subtopicos) visitar(t.subtopicos, id);
      }
    };
    visitar(e.disciplinas.find((d) => d.slug === slug)!.topicos, null);
    // o banco não garante ordem: embaralha de forma determinística
    return linhas.reverse();
  };
  return {
    id: `cargo-${cargo}`,
    slug: c.slug,
    nome: c.nome,
    duracao_min: c.duracao_min,
    corte_conjunto: c.corte_conjunto ?? null,
    concursos: { id: "concurso", slug: e.slug, nome: e.nome, data_prova: e.data_prova },
    cargo_provas: c.provas
      .map((slug, i) => {
        const p = e.provas.find((x) => x.slug === slug)!;
        return {
          ordem: i + 1,
          provas:
            p.tipo === "objetiva"
              ? {
                  id: `prova-${p.slug}`,
                  slug: p.slug,
                  nome: p.nome,
                  tipo: p.tipo,
                  n_itens: p.itens,
                  regra_pontuacao: p.pontuacao,
                  regra_corte: p.corte ?? null,
                  distribuicao: p.distribuicao_estimada,
                  prova_disciplinas: p.disciplinas.map((d, j) => ({
                    ordem: j + 1,
                    disciplinas: { slug: d, nome: e.disciplinas.find((x) => x.slug === d)!.nome, topicos: topicosDa(d) },
                  })),
                }
              : {
                  id: `prova-${p.slug}`, slug: p.slug, nome: p.nome, tipo: p.tipo, n_itens: null,
                  regra_pontuacao: null, regra_corte: null, distribuicao: null, prova_disciplinas: [],
                },
        };
      })
      .reverse(),
  };
}

import type { DemandaDisciplina } from "../edital/consultas";
import type { PrioridadeTopico } from "../foco/prioridade";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

function rodizio(canonicos: string[], itens: ItemCandidato[], usados: Set<string>, quantidade: number): string[] {
  const escolhidos: string[] = [];
  let progresso = true;
  while (escolhidos.length < quantidade && progresso) {
    progresso = false;
    for (const c of canonicos) {
      if (escolhidos.length >= quantidade) break;
      const [id] = escolherDoTopico(c, itens, usados, 1);
      if (id === undefined) continue;
      escolhidos.push(id);
      usados.add(id);
      progresso = true;
    }
  }
  return escolhidos;
}

export function montarTreinoTopico(p: { canonicos: string[]; itens: ItemCandidato[]; total: number }): string[] {
  return agruparPorTextoBase(rodizio(p.canonicos, p.itens, new Set(), p.total), p.itens);
}

export interface SimuladoMontado {
  itens: string[];
  faltantes: { disciplina: string; faltam: number }[];
}

export function montarSimuladoProva(
  demandas: DemandaDisciplina[],
  itens: ItemCandidato[],
  excluir: Set<string> = new Set(),
): SimuladoMontado {
  const usados = new Set(excluir);
  const selecionados: string[] = [];
  const faltantes: SimuladoMontado["faltantes"] = [];
  for (const d of demandas) {
    const escolhidos = rodizio(d.canonicos, itens, usados, d.quantidade);
    selecionados.push(...escolhidos);
    if (escolhidos.length < d.quantidade) faltantes.push({ disciplina: d.disciplina, faltam: d.quantidade - escolhidos.length });
  }
  return { itens: agruparPorTextoBase(selecionados, itens), faltantes };
}

export function topicosQuePrecisamGeracao(
  prioridades: PrioridadeTopico[],
  itens: ItemCandidato[],
  opcoes: { top?: number; minimoNaoVistos?: number } = {},
): string[] {
  const top = opcoes.top ?? 10;
  const minimo = opcoes.minimoNaoVistos ?? 10;
  const canonicos = [...new Set(prioridades.slice(0, top).map((p) => p.canonico))];
  return canonicos.filter((c) => itens.filter((i) => !i.visto && i.canonicos.includes(c)).length < minimo);
}

import type { PrioridadeTopico } from "../foco/prioridade";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

export interface ParamsEstudarAgora {
  prioridades: PrioridadeTopico[];
  itens: ItemCandidato[];
  revisaoVencida: string[];
  total?: number;
  proporcaoRevisao?: number;
  proporcaoManutencao?: number;
  maxPorTopico?: number;
}

export function montarEstudarAgora(p: ParamsEstudarAgora): string[] {
  const total = p.total ?? 20;
  const maxPorTopico = p.maxPorTopico ?? 3;
  const cotaRevisao = Math.round(total * (p.proporcaoRevisao ?? 0.2));
  const cotaManutencao = Math.round(total * (p.proporcaoManutencao ?? 0.1));
  const candidatos = new Set(p.itens.map((i) => i.id));
  const usados = new Set<string>();

  const revisao: string[] = [];
  for (const id of p.revisaoVencida) {
    if (revisao.length >= cotaRevisao) break;
    if (candidatos.has(id) && !usados.has(id)) {
      revisao.push(id);
      usados.add(id);
    }
  }

  const manutencao: string[] = [];
  for (const t of [...p.prioridades].reverse()) {
    if (manutencao.length >= cotaManutencao) break;
    for (const id of escolherDoTopico(t.canonico, p.itens, usados, 1)) {
      manutencao.push(id);
      usados.add(id);
    }
  }

  const foco: string[] = [];
  for (const limite of [maxPorTopico, Number.POSITIVE_INFINITY]) {
    for (const t of p.prioridades) {
      const restante = total - revisao.length - manutencao.length - foco.length;
      if (restante <= 0) break;
      const jaDoTopico = foco.filter((id) => p.itens.find((i) => i.id === id)?.canonicos.includes(t.canonico)).length;
      const vagas = Math.min(restante, limite - jaDoTopico);
      if (vagas <= 0) continue;
      for (const id of escolherDoTopico(t.canonico, p.itens, usados, vagas)) {
        foco.push(id);
        usados.add(id);
      }
    }
  }

  return agruparPorTextoBase([...foco, ...revisao, ...manutencao], p.itens);
}

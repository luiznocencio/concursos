import { calcularPrioridades, VALOR_RESULTADO, type PrioridadeTopico, type RespostaHistorico, type TopicoAlvo } from "@/core";

const DIA_MS = 86_400_000;
const SEMANA_MS = 7 * DIA_MS;

export interface LinhaTopicoPainel {
  disciplina: string;
  codigo: string;
  titulo: string;
  canonico: string;
  n: number;
  aproveitamento: number;
  taxaBrancos: number;
  // Aproveitamento líquido de cada uma das últimas 4 semanas, da mais antiga para a atual (null = sem respostas).
  tendencia: (number | null)[];
  prioridade: number;
}

export interface LinhaDisciplina {
  disciplina: string;
  n: number;
  aproveitamento: number;
  taxaBrancos: number;
  topicos: LinhaTopicoPainel[];
}

function media(valores: number[]): number {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

export function tendenciaSemanal(respostas: RespostaHistorico[], agora: Date, semanas = 4): (number | null)[] {
  return Array.from({ length: semanas }, (_, i) => {
    const fim = agora.getTime() - (semanas - 1 - i) * SEMANA_MS;
    const doPeriodo = respostas.filter((r) => r.respondidaEm.getTime() > fim - SEMANA_MS && r.respondidaEm.getTime() <= fim);
    return doPeriodo.length ? media(doPeriodo.map((r) => VALOR_RESULTADO[r.resultado])) : null;
  });
}

// Itens respondidos, sem os erros de redação (que só entram na prioridade do motor de foco).
export function soItens(historico: RespostaHistorico[]): RespostaHistorico[] {
  return historico.filter((r) => r.peso === undefined);
}

// Tabela do painel: tópicos na ordem do edital, agrupados por disciplina. A prioridade vem do motor de foco
// (com os erros de redação); respostas, aproveitamento, brancos e tendência contam só os itens.
export function tabelaDesempenho(
  topicosAlvo: TopicoAlvo[],
  prioridades: PrioridadeTopico[],
  historicoCompleto: RespostaHistorico[],
  agora: Date,
): LinhaDisciplina[] {
  const historico = soItens(historicoCompleto);
  const doItens = new Map(calcularPrioridades(topicosAlvo, historico, agora).map((p) => [p.chave, p]));
  const porCanonico = new Map<string, RespostaHistorico[]>();
  for (const r of historico) porCanonico.set(r.canonico, [...(porCanonico.get(r.canonico) ?? []), r]);

  const posicao = new Map(topicosAlvo.map((t, i) => [t.chave, i]));
  const ordenadas = [...prioridades].sort((a, b) => (posicao.get(a.chave) ?? 0) - (posicao.get(b.chave) ?? 0));
  const disciplinas = new Map<string, LinhaTopicoPainel[]>();
  for (const p of ordenadas) {
    const rs = porCanonico.get(p.canonico) ?? [];
    const linha: LinhaTopicoPainel = {
      disciplina: p.disciplina,
      codigo: p.codigo,
      titulo: p.titulo,
      canonico: p.canonico,
      n: doItens.get(p.chave)?.n ?? 0,
      aproveitamento: doItens.get(p.chave)?.aproveitamento ?? 0,
      taxaBrancos: rs.length ? rs.filter((r) => r.resultado === "branco").length / rs.length : 0,
      tendencia: tendenciaSemanal(rs, agora),
      prioridade: p.prioridade,
    };
    disciplinas.set(p.disciplina, [...(disciplinas.get(p.disciplina) ?? []), linha]);
  }

  return [...disciplinas.entries()].map(([disciplina, topicos]) => {
    const canonicos = new Set(topicos.map((t) => t.canonico));
    const rs = historico.filter((r) => canonicos.has(r.canonico));
    return {
      disciplina,
      n: rs.length,
      aproveitamento: media(rs.map((r) => VALOR_RESULTADO[r.resultado])),
      taxaBrancos: rs.length ? rs.filter((r) => r.resultado === "branco").length / rs.length : 0,
      topicos,
    };
  });
}

export function diasAte(dataProva: string, agora: Date): number {
  const prova = new Date(`${dataProva}T00:00:00-03:00`).getTime();
  return Math.max(0, Math.ceil((prova - agora.getTime()) / DIA_MS));
}

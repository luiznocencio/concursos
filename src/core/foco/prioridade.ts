import type { TopicoAlvo } from "../edital/consultas";
import type { ResultadoResposta } from "../tipos";

export interface ConfigFoco {
  meiaVidaDias: number;
  tauEsquecimentoDias: number;
  esquecimentoMinimo: number;
  escalaIncerteza: number;
  // Peso de um erro de redação no histórico, relativo a um item respondido (peso 1).
  pesoErroRedacao: number;
}

export const CONFIG_FOCO: ConfigFoco = {
  meiaVidaDias: 14,
  tauEsquecimentoDias: 7,
  esquecimentoMinimo: 0.1,
  escalaIncerteza: 5,
  pesoErroRedacao: 0.5,
};

export const VALOR_RESULTADO: Record<ResultadoResposta, number> = {
  certo: 1,
  certo_duvida: 0.5,
  errado: -1,
  branco: 0,
};

export interface RespostaHistorico {
  canonico: string;
  resultado: ResultadoResposta;
  respondidaEm: Date;
  // Padrão 1 (item respondido). Erros de redação entram com CONFIG_FOCO.pesoErroRedacao.
  peso?: number;
}

export interface PrioridadeTopico extends TopicoAlvo {
  prioridade: number;
  fraqueza: number;
  esquecimento: number;
  incerteza: number;
  aproveitamento: number;
  n: number;
}

const DIA_MS = 86_400_000;

function diasEntre(antes: Date, depois: Date): number {
  return Math.max(0, (depois.getTime() - antes.getTime()) / DIA_MS);
}

export function calcularPrioridades(
  topicos: TopicoAlvo[],
  historico: RespostaHistorico[],
  agora: Date,
  config: ConfigFoco = CONFIG_FOCO,
): PrioridadeTopico[] {
  const porCanonico = new Map<string, RespostaHistorico[]>();
  for (const r of historico) {
    const lista = porCanonico.get(r.canonico) ?? [];
    lista.push(r);
    porCanonico.set(r.canonico, lista);
  }

  return topicos
    .map((t) => {
      const rs = porCanonico.get(t.canonico) ?? [];
      const n = rs.length;
      let aproveitamento = 0;
      let esquecimento = 1;
      if (n > 0) {
        let somaPesos = 0;
        let somaValores = 0;
        let ultima = rs[0].respondidaEm;
        for (const r of rs) {
          const w = (r.peso ?? 1) * 0.5 ** (diasEntre(r.respondidaEm, agora) / config.meiaVidaDias);
          somaPesos += w;
          somaValores += w * VALOR_RESULTADO[r.resultado];
          if (r.respondidaEm > ultima) ultima = r.respondidaEm;
        }
        aproveitamento = somaValores / somaPesos;
        esquecimento = Math.max(
          config.esquecimentoMinimo,
          1 - Math.exp(-diasEntre(ultima, agora) / config.tauEsquecimentoDias),
        );
      }
      const fraqueza = (1 - aproveitamento) / 2;
      const incerteza = 1 + 1 / (1 + n / config.escalaIncerteza);
      const prioridade = t.peso * fraqueza * esquecimento * incerteza;
      return { ...t, prioridade, fraqueza, esquecimento, incerteza, aproveitamento, n };
    })
    .sort((a, b) => b.prioridade - a.prioridade || a.chave.localeCompare(b.chave));
}

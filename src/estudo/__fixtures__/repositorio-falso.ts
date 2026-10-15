import type { EstadoRevisao, ItemCandidato, RespostaHistorico } from "@/core";
import type { EstruturaCargo } from "../estrutura";
import type { ItemCorrecao, RepositorioEstudo, RespostaGravada, ResultadoSessao, Sessao } from "../tipos";

export interface EstadoFalso {
  estrutura: EstruturaCargo;
  candidatos: ItemCandidato[];
  historico: RespostaHistorico[];
  gabaritos: Record<string, string>;
  // Itens reais e a prova de onde vieram; os demais são de IA.
  provasOrigem: Record<string, string>;
  vencidas: string[];
  sessoes: Map<string, Sessao>;
  respostas: Map<string, RespostaGravada[]>;
  revisao: Map<string, EstadoRevisao>;
  resultados: Map<string, ResultadoSessao>;
  pedidos: string[][];
  falharGeracao: boolean;
}

export function criarRepositorioFalso(inicial: Partial<EstadoFalso> & { estrutura: EstruturaCargo }) {
  const estado: EstadoFalso = {
    candidatos: [],
    historico: [],
    gabaritos: {},
    provasOrigem: {},
    vencidas: [],
    sessoes: new Map(),
    respostas: new Map(),
    revisao: new Map(),
    resultados: new Map(),
    pedidos: [],
    falharGeracao: false,
    ...inicial,
  };
  let proximoId = 1;

  const repo: RepositorioEstudo = {
    async estrutura() {
      return estado.estrutura;
    },
    async candidatos() {
      return estado.candidatos;
    },
    async historico() {
      return estado.historico;
    },
    async revisoesVencidas() {
      return estado.vencidas;
    },
    async criarSessao(cargoId, modo, config, itens) {
      const id = `s${proximoId++}`;
      estado.sessoes.set(id, { id, cargoId, modo, config, iniciadaEm: new Date("2026-10-15T12:00:00Z"), finalizadaEm: null, itens });
      return id;
    },
    async pedirGeracao(_concurso, canonicos) {
      if (estado.falharGeracao) throw new Error("sem chave");
      estado.pedidos.push(canonicos);
      return Math.min(3, canonicos.length);
    },
    async sessao(id) {
      return estado.sessoes.get(id) ?? null;
    },
    async itensCorrecao(ids) {
      return ids.map<ItemCorrecao>((id) => ({
        id,
        gabarito: estado.gabaritos[id] ?? "C",
        justificativa: `porque ${id}`,
        citacao: null,
        fonte: null,
        provaOrigem: estado.provasOrigem[id] ?? null,
      }));
    },
    async respostas(sessaoId) {
      return [...(estado.respostas.get(sessaoId) ?? [])];
    },
    async gravarResposta(sessaoId, r, substituir) {
      const lista = estado.respostas.get(sessaoId) ?? [];
      const i = lista.findIndex((x) => x.itemId === r.itemId);
      if (i >= 0 && !substituir) return false;
      const nova = { itemId: r.itemId, resposta: r.resposta, duvida: r.duvida };
      if (i >= 0) lista[i] = nova;
      else lista.push(nova);
      estado.respostas.set(sessaoId, lista);
      return true;
    },
    async estadosRevisao(ids) {
      return new Map(ids.filter((id) => estado.revisao.has(id)).map((id) => [id, estado.revisao.get(id)!]));
    },
    async salvarRevisao(itemId, e) {
      if (e) estado.revisao.set(itemId, e);
      else estado.revisao.delete(itemId);
    },
    async finalizar(sessaoId, resultado, agora) {
      const s = estado.sessoes.get(sessaoId)!;
      s.finalizadaEm = agora;
      estado.resultados.set(sessaoId, resultado);
    },
  };
  return { repo, estado };
}

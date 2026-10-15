import type {
  AnaliseDuvida,
  EstadoRevisao,
  ItemCandidato,
  ResultadoProva,
  ResultadoResposta,
  RespostaHistorico,
} from "@/core";
import type { EstruturaCargo } from "./estrutura";

// Resposta marcada na tela: Certo, Errado ou em branco.
export type Marcacao = "C" | "E" | "branco";

export type ModoSessao = "treino" | "revisao" | "completo";

export type ConfigSessao =
  | { tipo: "estudar_agora" }
  | { tipo: "topico"; canonicos: string[] }
  | { tipo: "revisao" }
  | {
      tipo: "completo";
      duracaoMin: number;
      provas: { slug: string; itens: string[] }[];
      disciplinaDoItem: Record<string, string>;
    };

export interface Sessao {
  id: string;
  cargoId: string;
  modo: ModoSessao;
  config: ConfigSessao;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  itens: string[];
}

export interface ItemCorrecao {
  id: string;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
  // Prova de onde a questão real foi tirada; null nos itens gerados por IA.
  provaOrigem: string | null;
}

export interface RespostaGravada {
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
}

export interface ResumoTreino {
  tipo: "treino";
  certos: number;
  errados: number;
  brancos: number;
  comDuvida: number;
}

export interface DesempenhoDisciplina {
  disciplina: string;
  nome: string;
  certos: number;
  errados: number;
  brancos: number;
}

export interface ResultadoCompleto {
  tipo: "completo";
  provas: (ResultadoProva & { nome: string; nItens: number })[];
  total: number;
  corteConjunto: number | null;
  aprovado: boolean;
  motivos: string[];
  porDisciplina: DesempenhoDisciplina[];
  duvidas: (AnaliseDuvida & { nome: string })[];
}

export type ResultadoSessao = ResumoTreino | ResultadoCompleto;

export interface RepositorioEstudo {
  estrutura(cargoId: string): Promise<EstruturaCargo>;
  candidatos(cargoId: string): Promise<ItemCandidato[]>;
  historico(cargoId: string): Promise<RespostaHistorico[]>;
  revisoesVencidas(agora: Date): Promise<string[]>;
  criarSessao(cargoId: string, modo: ModoSessao, config: ConfigSessao, itens: string[]): Promise<string>;
  pedirGeracao(concurso: string, canonicos: string[]): Promise<number>;
  sessao(id: string): Promise<Sessao | null>;
  itensCorrecao(ids: string[]): Promise<ItemCorrecao[]>;
  respostas(sessaoId: string): Promise<RespostaGravada[]>;
  // substituir = false: não altera uma resposta já gravada e devolve false.
  gravarResposta(
    sessaoId: string,
    r: RespostaGravada & { tempoMs: number | null },
    substituir: boolean,
  ): Promise<boolean>;
  estadosRevisao(itemIds: string[]): Promise<Map<string, EstadoRevisao>>;
  salvarRevisao(itemId: string, estado: EstadoRevisao | null): Promise<void>;
  finalizar(sessaoId: string, resultado: ResultadoSessao, agora: Date): Promise<void>;
}

export type { ResultadoResposta };

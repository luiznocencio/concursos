import type { ImagemIa, ProvedorIa, UsoIa } from "../../ai/tipos";
import type { ConfigDiscursiva } from "../../core/discursiva/tipos";
import type { ResultadoCorrecao } from "./consolidar";
import type { TemaParaPrompt } from "./prompts";
import type { TemaGerado } from "./schemas";

export type PapelCorrecao = "conteudo_1" | "conteudo_2" | "conteudo_3" | "lingua" | "transcricao";

export interface RedacaoParaProcessar {
  id: string;
  usuarioId: string;
  status: string;
  linhas: string[];
  fotos: string[];
  tema: TemaParaPrompt;
  config: ConfigDiscursiva;
}

export type TranscricaoParaGravar =
  | { ok: true; linhas: string[]; excedente: string[] }
  | { ok: false; aviso: string };

export interface ContextoTema {
  banca: string;
  concurso: string;
  disciplina: string;
  programa: string;
  pontuacaoMaxima: number;
  linhasMax: number;
  temasRecentes: string[];
}

export interface RepositorioDiscursiva {
  carregarRedacao(id: string): Promise<RedacaoParaProcessar | null>;
  // Respostas já gravadas, por papel (o que torna a correção retomável sem pagar de novo).
  correcoes(redacaoId: string): Promise<Partial<Record<PapelCorrecao, unknown>>>;
  gravarCorrecao(redacaoId: string, papel: PapelCorrecao, uso: UsoIa, resposta: unknown): Promise<void>;
  marcarStatus(redacaoId: string, status: "corrigindo" | "falhou", aviso?: string): Promise<void>;
  gravarResultado(redacao: RedacaoParaProcessar, resultado: ResultadoCorrecao): Promise<void>;
  baixarFotos(caminhos: string[]): Promise<ImagemIa[]>;
  gravarTranscricao(redacao: RedacaoParaProcessar, transcricao: TranscricaoParaGravar): Promise<void>;
  contextoTema(concurso: string): Promise<ContextoTema>;
  // Devolve false quando já existe tema com o mesmo enunciado no concurso.
  gravarTema(concurso: string, tema: TemaGerado, status: "aprovado" | "revisao"): Promise<boolean>;
  registrarUso(uso: UsoIa, finalidade: string, jobId: string | null): Promise<void>;
}

export interface DepsDiscursiva {
  // [Claude, GPT]: as duas bancas de conteúdo são provedores diferentes, como os dois examinadores do edital.
  provedores: [ProvedorIa, ProvedorIa];
  repo: RepositorioDiscursiva;
  jobId: string | null;
}

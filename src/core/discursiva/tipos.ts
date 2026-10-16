import type { ProvaDiscursiva } from "../edital/schema";

// Aspectos gramaticais que a Cebraspe conta em NE (edital, item 9.7.5, alínea b).
export const TIPOS_ERRO = ["grafia", "morfossintaxe", "propriedade_vocabular"] as const;
export type TipoErro = (typeof TIPOS_ERRO)[number];

// Lista fechada para a IA classificar cada erro; cada categoria leva a um tópico de LP (ver erros.ts).
export const CATEGORIAS_ERRO = [
  "ortografia",
  "acentuacao",
  "hifen",
  "concordancia",
  "regencia",
  "crase",
  "pontuacao",
  "colocacao_pronominal",
  "tempos_modos_verbais",
  "coesao_conectores",
  "classes_de_palavras",
  "coordenacao",
  "subordinacao",
  "propriedade_vocabular",
] as const;
export type CategoriaErro = (typeof CATEGORIAS_ERRO)[number];

export interface ErroLingua {
  linha: number;
  trecho: string;
  tipo: TipoErro;
  categoria: CategoriaErro;
  correcao: string;
  explicacao: string;
}

export type MotivoZero = "fuga_tema" | "sem_texto" | "npd_negativo";

export interface ConfigDiscursiva {
  pontuacaoMaxima: number;
  linhasMax: number;
  notaMinima: number;
  caracteresPorLinha: number;
}

export function configDaProva(prova: ProvaDiscursiva): ConfigDiscursiva {
  return {
    pontuacaoMaxima: prova.pontuacao_maxima,
    linhasMax: prova.linhas_max,
    notaMinima: prova.nota_minima,
    caracteresPorLinha: prova.caracteres_por_linha,
  };
}

import { filtrarErrosValidos } from "../../core/discursiva/erros";
import { contarTL } from "../../core/discursiva/linhas";
import { arredondar2, calcularNPD, notaConteudo } from "../../core/discursiva/nota";
import { escolherPrioridades, type AspectoAvaliado, type PrioridadeRedacao } from "../../core/discursiva/prioridades";
import type { ErroLingua, MotivoZero } from "../../core/discursiva/tipos";
import type { AspectoPadrao } from "./prompts";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

export interface ResultadoCorrecao {
  nc: number;
  ne: number;
  tl: number;
  npd: number;
  zeradaMotivo: MotivoZero | null;
  terceiraCorrecao: boolean;
  // Índices (em `conteudos`) das correções que entraram na nota.
  usadas: [number, number];
  aspectos: AspectoAvaliado[];
  erros: ErroLingua[];
  errosDescartados: number;
  prioridades: PrioridadeRedacao[];
}

export type Consolidacao = { precisaTerceira: true } | { precisaTerceira: false; resultado: ResultadoCorrecao };

// Nota de um examinador por aspecto: códigos desconhecidos são ignorados, ausentes valem 0, e cada nota fica entre 0 e o máximo.
export function notasPorAspecto(c: CorrecaoConteudo, aspectos: AspectoPadrao[]): number[] {
  const dadas = new Map(c.aspectos.map((a) => [a.codigo.trim(), a.nota]));
  return aspectos.map((a) => Math.min(a.pontos, Math.max(0, dadas.get(a.codigo) ?? 0)));
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/**
 * Junta as correções de conteúdo (2 ou 3) e a de língua na nota final, pelas regras do edital (9.7.4 e 9.7.5).
 * Com 2 correções, pede a terceira se as notas divergirem ou se só uma apontar fuga ao tema.
 * Fuga ao tema só zera a nota quando as duas correções usadas concordam.
 */
export function consolidarCorrecao(e: {
  aspectos: AspectoPadrao[];
  pontuacaoMaxima: number;
  linhas: string[];
  conteudos: CorrecaoConteudo[];
  lingua: CorrecaoLingua;
}): Consolidacao {
  const porAspecto = e.conteudos.map((c) => notasPorAspecto(c, e.aspectos));
  const conteudo = notaConteudo(porAspecto.map(soma), e.pontuacaoMaxima);
  if (conteudo.precisaTerceira) return { precisaTerceira: true };
  if (e.conteudos.length === 2 && e.conteudos[0].fuga_tema !== e.conteudos[1].fuga_tema) return { precisaTerceira: true };

  const [i, j] = conteudo.usadas;
  const fugaTema = e.conteudos[i].fuga_tema && e.conteudos[j].fuga_tema;
  const tl = contarTL(e.linhas);
  const { validos, descartados } = filtrarErrosValidos(e.lingua.erros, e.linhas);
  const nc = arredondar2(conteudo.nc);
  const { npd, motivoZero } = calcularNPD({ nc, ne: validos.length, tl, fugaTema });
  const aspectos = e.aspectos.map((a, k) => ({ ...a, nota: arredondar2((porAspecto[i][k] + porAspecto[j][k]) / 2) }));

  return {
    precisaTerceira: false,
    resultado: {
      nc,
      ne: validos.length,
      tl,
      npd,
      zeradaMotivo: motivoZero,
      terceiraCorrecao: e.conteudos.length === 3,
      usadas: [i, j],
      aspectos,
      erros: validos,
      errosDescartados: descartados,
      prioridades: escolherPrioridades(aspectos, validos),
    },
  };
}

// Texto vazio: nota zero sem chamar IA (edital, 9.7.5, alínea f).
export function resultadoSemTexto(aspectos: AspectoPadrao[]): ResultadoCorrecao {
  return {
    nc: 0,
    ne: 0,
    tl: 0,
    npd: 0,
    zeradaMotivo: "sem_texto",
    terceiraCorrecao: false,
    usadas: [0, 1],
    aspectos: aspectos.map((a) => ({ ...a, nota: 0 })),
    erros: [],
    errosDescartados: 0,
    prioridades: [],
  };
}

import { z } from "zod/v4";
import { ErroIa, type ProvedorIa, type UsoIa } from "../ai/tipos";
import type { GrupoPrevia } from "./previa";

export const PROMPT_TOPICOS_VERSAO = "2026-10-15.1";
export const ITENS_POR_CHAMADA = 25;
export const MAX_TOPICOS_POR_ITEM = 2;
const LIMITE_TEXTO_BASE = 1_500;

// Um tópico canônico do concurso, como aparece para o moderador e para a IA.
export interface OpcaoTopico {
  canonico: string;
  titulo: string;
  disciplina: string;
}

export const sugestoesSchema = z.object({
  sugestoes: z.array(z.object({ numero: z.number(), canonicos: z.array(z.string()) })),
});

export interface DepsSugestao {
  provedor: ProvedorIa;
  registrarUso(uso: UsoIa): Promise<void>;
}

export interface ResultadoSugestao {
  porItem: Record<number, string[]>;
  custoUsd: number;
}

// Uma linha de tópico canônico por linha do banco (topicos do edital com canônico), sem repetir o
// canônico; fica na disciplina em que aparece primeiro. Ordena por disciplina e título.
export function opcoesDeTopicos(linhas: { canonico: string; titulo: string; disciplina: string }[]): OpcaoTopico[] {
  const porCanonico = new Map<string, OpcaoTopico>();
  for (const l of linhas) if (!porCanonico.has(l.canonico)) porCanonico.set(l.canonico, { ...l });
  return [...porCanonico.values()].sort(
    (a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR") || a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

export function sistemaTopicos(opcoes: OpcaoTopico[]): string {
  const lista = opcoes.map((o) => `${o.canonico} | ${o.disciplina} | ${o.titulo}`).join("\n");
  return `Você classifica itens de provas de concursos públicos brasileiros nos tópicos do edital.
Para cada item, escolha 1 tópico (no máximo ${MAX_TOPICOS_POR_ITEM}, só se o item cobrar dois assuntos de fato) da lista abaixo, usando o identificador exato da primeira coluna.
Classifique pelo conhecimento que o item cobra, não pelas palavras do texto-base: um item de interpretação sobre um texto que fala de incêndios é de língua portuguesa.
Se nenhum tópico servir, devolva a lista vazia para o item.
Responda somente no formato estruturado pedido.

<topicos>
${lista}
</topicos>`;
}

export function promptTopicos(grupos: GrupoPrevia[]): string {
  const blocos = grupos.map((g) => {
    const texto = g.textoBase
      ? `<texto_base>\n${g.textoBase.length > LIMITE_TEXTO_BASE ? `${g.textoBase.slice(0, LIMITE_TEXTO_BASE)}...` : g.textoBase}\n</texto_base>\n`
      : "";
    return `${texto}${g.itens.map((i) => `${i.numero}. ${i.enunciado}`).join("\n")}`;
  });
  return `Classifique os itens abaixo. Devolva uma sugestão por item, com o mesmo \`numero\`.

${blocos.join("\n\n")}`;
}

// Divide em chamadas de até ITENS_POR_CHAMADA itens, sem separar um item do seu texto-base.
export function lotesDeSugestao(grupos: GrupoPrevia[]): GrupoPrevia[][] {
  const lotes: GrupoPrevia[][] = [];
  let atual: GrupoPrevia[] = [];
  let n = 0;
  for (const g of grupos) {
    for (let k = 0; k < g.itens.length; k += ITENS_POR_CHAMADA) {
      const parte = { textoBase: g.textoBase, itens: g.itens.slice(k, k + ITENS_POR_CHAMADA) };
      if (n > 0 && n + parte.itens.length > ITENS_POR_CHAMADA) {
        lotes.push(atual);
        atual = [];
        n = 0;
      }
      atual.push(parte);
      n += parte.itens.length;
    }
  }
  if (atual.length > 0) lotes.push(atual);
  return lotes;
}

// Pede à IA os tópicos de cada item, com os lotes em paralelo para caber no tempo de uma Server
// Action. A saída é restrita à lista do concurso: identificadores fora dela e números que não
// estavam no lote são ignorados; itens sem sugestão ficam com lista vazia.
export async function sugerirTopicos(
  deps: DepsSugestao,
  entrada: { grupos: GrupoPrevia[]; opcoes: OpcaoTopico[] },
): Promise<ResultadoSugestao> {
  const permitidos = new Set(entrada.opcoes.map((o) => o.canonico));
  const sistema = sistemaTopicos(entrada.opcoes);

  const chamar = async (lote: GrupoPrevia[]) => {
    try {
      const r = await deps.provedor.gerarJson({
        finalidade: "sugerir_topicos",
        sistema,
        prompt: promptTopicos(lote),
        schema: sugestoesSchema,
        nomeSchema: "sugestoes_topicos",
      });
      await deps.registrarUso(r.uso);
      return r;
    } catch (e) {
      if (e instanceof ErroIa && e.uso) await deps.registrarUso(e.uso);
      throw e;
    }
  };

  const lotes = lotesDeSugestao(entrada.grupos);
  const respostas = await Promise.all(lotes.map(chamar));

  const porItem: Record<number, string[]> = {};
  let custoUsd = 0;
  lotes.forEach((lote, k) => {
    const numeros = new Set(lote.flatMap((g) => g.itens.map((i) => i.numero)));
    for (const n of numeros) porItem[n] = [];
    custoUsd += respostas[k].uso.custoUsd;
    for (const s of respostas[k].dados.sugestoes) {
      if (!numeros.has(s.numero)) continue;
      porItem[s.numero] = [...new Set(s.canonicos.filter((c) => permitidos.has(c)))].slice(0, MAX_TOPICOS_POR_ITEM);
    }
  });
  return { porItem, custoUsd };
}

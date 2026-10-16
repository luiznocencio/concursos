import { CANONICO_POR_CATEGORIA, ROTULO_CATEGORIA } from "./erros";
import type { CategoriaErro, ErroLingua } from "./tipos";

export interface AspectoAvaliado {
  codigo: string;
  descricao: string;
  pontos: number;
  nota: number;
}

export type PrioridadeRedacao =
  | { tipo: "aspecto"; codigo: string; titulo: string; detalhe: string }
  | { tipo: "erro"; categoria: CategoriaErro; canonico: string; titulo: string; detalhe: string };

// Três erros da mesma categoria já pesam tanto quanto um aspecto zerado.
const ERROS_PARA_PESO_MAXIMO = 3;

function numero(x: number): string {
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Escolhe o que estudar primeiro: aspectos do padrão de resposta com mais pontos perdidos (proporcionalmente)
 * e categorias de erro mais frequentes. Em empate, erro vem antes (leva direto a um treino).
 */
export function escolherPrioridades(
  aspectos: AspectoAvaliado[],
  erros: ErroLingua[],
  quantidade = 3,
): PrioridadeRedacao[] {
  const candidatos: { peso: number; ordem: string; p: PrioridadeRedacao }[] = [];

  for (const a of aspectos) {
    const perda = a.pontos - a.nota;
    if (a.pontos <= 0 || perda <= 0) continue;
    candidatos.push({
      peso: perda / a.pontos,
      ordem: `1|${a.codigo}`,
      p: {
        tipo: "aspecto",
        codigo: a.codigo,
        titulo: `Aprofunde: ${a.descricao}`,
        detalhe: `Você fez ${numero(a.nota)} de ${numero(a.pontos)} pontos neste aspecto.`,
      },
    });
  }

  const porCategoria = new Map<CategoriaErro, number>();
  for (const e of erros) porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + 1);
  for (const [categoria, n] of porCategoria) {
    candidatos.push({
      peso: Math.min(1, n / ERROS_PARA_PESO_MAXIMO),
      ordem: `0|${categoria}`,
      p: {
        tipo: "erro",
        categoria,
        canonico: CANONICO_POR_CATEGORIA[categoria],
        titulo: `Revise ${ROTULO_CATEGORIA[categoria]}`,
        detalhe: n === 1 ? "1 erro na redação." : `${n} erros na redação.`,
      },
    });
  }

  return candidatos
    .sort((x, y) => y.peso - x.peso || x.ordem.localeCompare(y.ordem))
    .slice(0, quantidade)
    .map((c) => c.p);
}

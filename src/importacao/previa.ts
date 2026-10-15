import { lerGabarito } from "./gabarito";
import { analisarProva } from "./prova";

export interface ItemPrevia {
  numero: number;
  enunciado: string;
  gabarito: "C" | "E";
}

export interface GrupoPrevia {
  textoBase: string | null;
  itens: ItemPrevia[];
}

// O que será gravado e o que ficou de fora. Puro: a tela calcula no navegador, sem ida ao servidor.
export interface PreviaImportacao {
  grupos: GrupoPrevia[];
  total: number;
  anulados: number[];
  semGabarito: number[];
  gabaritoSemItem: number[];
  avisos: string[];
}

// [1, 2, 3, 7, 9, 10] → "1 a 3, 7, 9 e 10"
export function faixas(numeros: number[]): string {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ordenados.length; ) {
    let j = i;
    while (j + 1 < ordenados.length && ordenados[j + 1] === ordenados[j] + 1) j++;
    const [a, b] = [ordenados[i], ordenados[j]];
    if (a === b) partes.push(String(a));
    else if (b === a + 1) partes.push(String(a), String(b));
    else partes.push(`${a} a ${b}`);
    i = j + 1;
  }
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

// Cruza os itens lidos com o gabarito oficial: anulados (X) e itens sem gabarito ou sem texto ficam de fora.
export function montarPrevia(textoProva: string, textoGabarito: string): PreviaImportacao {
  const prova = analisarProva(textoProva);
  const gabarito = lerGabarito(textoGabarito);
  const anulados: number[] = [];
  const semGabarito: number[] = [];
  const lidos = new Set<number>();

  const grupos: GrupoPrevia[] = [];
  for (const g of prova.grupos) {
    const itens: ItemPrevia[] = [];
    for (const it of g.itens) {
      lidos.add(it.numero);
      const resposta = gabarito.respostas.get(it.numero);
      if (resposta === undefined) semGabarito.push(it.numero);
      else if (resposta === "X") anulados.push(it.numero);
      else if (it.enunciado) itens.push({ numero: it.numero, enunciado: it.enunciado, gabarito: resposta });
    }
    if (itens.length > 0) grupos.push({ textoBase: g.textoBase, itens });
  }

  const gabaritoSemItem = [...gabarito.respostas.keys()].filter((n) => !lidos.has(n));
  return {
    grupos,
    total: grupos.reduce((s, g) => s + g.itens.length, 0),
    anulados,
    semGabarito,
    gabaritoSemItem,
    avisos: [...prova.avisos, ...gabarito.problemas],
  };
}

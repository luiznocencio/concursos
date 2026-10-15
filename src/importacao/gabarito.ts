// Leitura do gabarito oficial colado: pares "1 C 2 E 3 X", uma resposta por linha ("1 - C"), ou a
// tabela do Cebraspe com uma linha de números e outra de respostas. X, ANULADO ou * marcam item anulado.
// Puro: roda no navegador e no servidor.

export type RespostaOficial = "C" | "E" | "X";

export interface GabaritoLido {
  respostas: Map<number, RespostaOficial>;
  problemas: string[];
}

type Token = { tipo: "numero"; valor: number } | { tipo: "resposta"; valor: RespostaOficial };

// Letras sozinhas só em maiúscula: um "e" minúsculo é a conjunção, não "Errado".
function classificar(palavra: string): Token | null {
  if (/^\d+$/.test(palavra)) {
    const n = Number(palavra);
    return n >= 1 && n <= 999 ? { tipo: "numero", valor: n } : null;
  }
  if (palavra === "C" || palavra === "E" || palavra === "X") return { tipo: "resposta", valor: palavra };
  if (palavra === "*") return { tipo: "resposta", valor: "X" };
  const p = palavra.toUpperCase();
  if (p === "CERTO") return { tipo: "resposta", valor: "C" };
  if (p === "ERRADO") return { tipo: "resposta", valor: "E" };
  if (p === "ANULADO" || p === "ANULADA" || p === "ANUL" || p === "NULO" || p === "NULA") return { tipo: "resposta", valor: "X" };
  return null;
}

export function lerGabarito(texto: string): GabaritoLido {
  const tokens = (texto.match(/\d+|\*|[A-Za-zÀ-ÿ]+/g) ?? []).map(classificar).filter((t): t is Token => t !== null);

  // Blocos alternados: uma sequência de números seguida de uma de respostas. Pares "1 C 2 E" viram
  // blocos de tamanho 1; a tabela do Cebraspe vira blocos de 10 a 25.
  const blocos: { numeros: number[]; respostas: RespostaOficial[] }[] = [];
  for (const t of tokens) {
    const ultimo = blocos[blocos.length - 1];
    if (t.tipo === "numero") {
      if (!ultimo || ultimo.respostas.length > 0) blocos.push({ numeros: [t.valor], respostas: [] });
      else ultimo.numeros.push(t.valor);
    } else if (ultimo) {
      ultimo.respostas.push(t.valor);
    } else {
      blocos.push({ numeros: [], respostas: [t.valor] });
    }
  }

  const respostas = new Map<number, RespostaOficial>();
  const conflitos = new Set<number>();
  const problemas: string[] = [];

  for (const b of blocos) {
    let { numeros, respostas: rs } = b;
    if (numeros.length > rs.length && rs.length > 0) {
      // Números soltos antes da tabela (ex.: "Cargo 1") ficam de fora.
      const sobra = numeros.slice(0, numeros.length - rs.length);
      problemas.push(`Números sem resposta ignorados no gabarito: ${sobra.join(", ")}.`);
      numeros = numeros.slice(sobra.length);
    } else if (rs.length > numeros.length) {
      const perto = numeros.length ? ` depois do item ${numeros[numeros.length - 1]}` : " no começo";
      problemas.push(`Há ${rs.length - numeros.length} resposta(s) sem número${perto}.`);
      rs = rs.slice(0, numeros.length);
    } else if (rs.length === 0) {
      problemas.push(`Números sem resposta ignorados no gabarito: ${numeros.join(", ")}.`);
      continue;
    }
    numeros.forEach((n, k) => {
      const anterior = respostas.get(n);
      if (anterior !== undefined && anterior !== rs[k]) conflitos.add(n);
      respostas.set(n, rs[k]);
    });
  }

  for (const n of [...conflitos].sort((a, b) => a - b)) {
    respostas.delete(n);
    problemas.push(`O item ${n} aparece com respostas diferentes no gabarito e foi deixado de fora.`);
  }
  if (respostas.size === 0 && problemas.length === 0) problemas.push("Nenhuma resposta encontrada no gabarito.");
  return { respostas: new Map([...respostas].sort((a, b) => a[0] - b[0])), problemas };
}

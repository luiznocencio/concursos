// Leitura do texto de uma prova Certo/Errado colado do PDF (formato Cebraspe): textos-base e comandos
// ("Julgue os itens a seguir...") seguidos de itens numerados. Puro: roda no navegador e no servidor.

export interface ItemLido {
  numero: number;
  enunciado: string;
}

export interface GrupoLido {
  textoBase: string | null;
  itens: ItemLido[];
}

export interface ProvaLida {
  grupos: GrupoLido[];
  avisos: string[];
}

// "12 Texto", "12. Texto", "12) Texto", "12 – Texto" ou o número sozinho na linha.
const INICIO_ITEM = /^(\d{1,3})(?:\s*[.)\-–—:]\s*|\s+|$)(.*)$/;

// Linhas que abrem um novo texto-base mesmo sem linha em branco antes, quando o item anterior já
// terminou numa pontuação final. Sensível à caixa: "do\ntexto CB1A1" continua o item.
const INICIO_TEXTO =
  /^(Texto|Julgue|Considerando|Considere|Com base|Com rela[çc][ãa]o|Acerca|A respeito|No que se refere|No que concerne|Em rela[çc][ãa]o|Tendo como refer[êe]ncia|Tendo em vista|Nos itens|Cada um dos itens|Figura|Tabela|Quadro)\b/;
const FIM_DE_FRASE = /[.?!:)"”]$/;

// Título curto de texto-base, como "Texto CB1A1-I" ou "Figura 2".
const TITULO = /^(Texto|Figura|Tabela|Quadro)\b.{0,24}$/;

// Quanto cada item que falta numa sequência tira da pontuação. Com 0,5, pular um item ainda soma
// (+0,5) e a numeração de linhas dos textos (1, 4, 7...) não soma nada.
const PENALIDADE_POR_FALTANTE = 0.5;

interface Candidata {
  linha: number;
  numero: number;
  resto: string;
}

function normalizar(texto: string): string[] {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f\t]/g, " ")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim());
}

// Escolhe, entre as linhas que parecem início de item, a sequência crescente de maior pontuação:
// +1 por item, menos a penalidade dos números que faltam entre um e outro. Em empate, prefere o
// antecessor mais próximo e a sequência que termina primeiro.
function sequenciaDeItens(candidatas: Candidata[]): Candidata[] {
  const melhor: number[] = [];
  const anterior: number[] = [];
  for (let i = 0; i < candidatas.length; i++) {
    melhor[i] = 1;
    anterior[i] = -1;
    for (let j = 0; j < i; j++) {
      if (candidatas[j].numero >= candidatas[i].numero) continue;
      const faltantes = candidatas[i].numero - candidatas[j].numero - 1;
      const passo = 1 - PENALIDADE_POR_FALTANTE * faltantes;
      if (melhor[j] + passo >= melhor[i]) {
        melhor[i] = melhor[j] + passo;
        anterior[i] = j;
      }
    }
  }
  let fim = -1;
  for (let i = 0; i < candidatas.length; i++) if (fim < 0 || melhor[i] > melhor[fim]) fim = i;
  const cadeia: Candidata[] = [];
  for (let i = fim; i >= 0; i = anterior[i]) cadeia.unshift(candidatas[i]);
  return cadeia;
}

function juntarLinhas(linhas: string[]): string {
  return linhas.join(" ").replace(/ {2,}/g, " ").trim();
}

function juntarParagrafos(paragrafos: string[][]): string | null {
  const texto = paragrafos
    .map(juntarLinhas)
    .filter(Boolean)
    .join("\n\n");
  return texto || null;
}

export function analisarProva(texto: string): ProvaLida {
  const linhas = normalizar(texto);
  const candidatas: Candidata[] = [];
  linhas.forEach((l, linha) => {
    const m = INICIO_ITEM.exec(l);
    if (m && Number(m[1]) > 0) candidatas.push({ linha, numero: Number(m[1]), resto: m[2].trim() });
  });
  const inicios = new Map(sequenciaDeItens(candidatas).map((c) => [c.linha, c]));
  if (inicios.size === 0) return { grupos: [], avisos: ["Nenhum item numerado encontrado."] };

  const grupos: GrupoLido[] = [];
  let paragrafos: string[][] = [[]];
  let grupo: GrupoLido | null = null;
  let item: { numero: number; linhas: string[] } | null = null;

  const fecharItem = () => {
    if (!item) return;
    grupo!.itens.push({ numero: item.numero, enunciado: juntarLinhas(item.linhas) });
    item = null;
  };

  linhas.forEach((l, i) => {
    const inicio = inicios.get(i);
    if (inicio) {
      fecharItem();
      const textoBase = juntarParagrafos(paragrafos);
      if (!grupo || textoBase) {
        grupo = { textoBase, itens: [] };
        grupos.push(grupo);
      }
      paragrafos = [[]];
      item = { numero: inicio.numero, linhas: inicio.resto ? [inicio.resto] : [] };
      return;
    }
    if (l === "") {
      if (item && item.linhas.length > 0) fecharItem();
      if (!item && paragrafos[paragrafos.length - 1].length > 0) paragrafos.push([]);
      return;
    }
    if (item && !(INICIO_TEXTO.test(l) && FIM_DE_FRASE.test(item.linhas[item.linhas.length - 1] ?? ""))) {
      item.linhas.push(l);
      return;
    }
    fecharItem();
    // Comandos e títulos ("Texto CB1A1-I") ficam em parágrafo próprio.
    if (INICIO_TEXTO.test(l) && paragrafos[paragrafos.length - 1].length > 0) paragrafos.push([]);
    paragrafos[paragrafos.length - 1].push(l);
    if (TITULO.test(l)) paragrafos.push([]);
  });
  fecharItem();

  const avisos: string[] = [];
  const sobra = juntarParagrafos(paragrafos);
  if (sobra) avisos.push(`Texto depois do último item foi ignorado: "${sobra.slice(0, 80)}${sobra.length > 80 ? "..." : ""}"`);
  const numeros = grupos.flatMap((g) => g.itens.map((it) => it.numero));
  for (let k = 1; k < numeros.length; k++) {
    if (numeros[k] > numeros[k - 1] + 1) {
      const de = numeros[k - 1] + 1;
      const ate = numeros[k] - 1;
      avisos.push(de === ate ? `Falta o item ${de} na sequência.` : `Faltam os itens ${de} a ${ate} na sequência.`);
    }
  }
  for (const g of grupos) {
    for (const it of g.itens) if (!it.enunciado) avisos.push(`O item ${it.numero} está sem texto.`);
  }
  return { grupos, avisos };
}

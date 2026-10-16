import { CANONICO_POR_CATEGORIA, ROTULO_CATEGORIA } from "@/core/discursiva/erros";
import type { CategoriaErro } from "@/core/discursiva/tipos";
import type { pilula } from "@/components/ui";

export const BUCKET_FOTOS = "redacoes-fotos";

export type StatusRedacao =
  | "rascunho"
  | "transcrevendo"
  | "aguardando_confirmacao"
  | "na_fila"
  | "corrigindo"
  | "corrigida"
  | "falhou";

export function rotuloStatus(status: string): { texto: string; tom: keyof typeof pilula } {
  switch (status) {
    case "rascunho":
      return { texto: "Rascunho", tom: "neutra" };
    case "transcrevendo":
      return { texto: "Lendo a foto", tom: "alerta" };
    case "aguardando_confirmacao":
      return { texto: "Conferir transcrição", tom: "alerta" };
    case "na_fila":
    case "corrigindo":
      return { texto: "Em correção", tom: "alerta" };
    case "corrigida":
      return { texto: "Corrigida", tom: "azul" };
    default:
      return { texto: "Falhou", tom: "erro" };
  }
}

export interface Passo {
  nome: string;
  feito: boolean;
}

// Passos mostrados enquanto a redação está na fila, a partir dos papéis já gravados em correcoes_discursiva.
export function passosDoAndamento(status: string, papeis: string[]): Passo[] {
  const feito = (p: string) => papeis.includes(p);
  if (status === "transcrevendo") return [{ nome: "Lendo a foto da folha", feito: feito("transcricao") }];
  const passos = [
    { nome: "Banca 1 avaliando o conteúdo", feito: feito("conteudo_1") },
    { nome: "Banca 2 avaliando o conteúdo", feito: feito("conteudo_2") },
    { nome: "Revisão de língua portuguesa", feito: feito("lingua") },
  ];
  // A terceira correção só aparece quando as duas primeiras já terminaram e divergiram (ou já foi feita).
  if (feito("conteudo_3") || (passos.every((p) => p.feito) && status !== "corrigida")) {
    passos.push({ nome: "Terceira correção (as bancas divergiram)", feito: feito("conteudo_3") });
  }
  return passos;
}

export interface Segmento {
  texto: string;
  // Número do erro (1, 2, ...) quando o trecho está marcado.
  erro: number | null;
}

/**
 * Divide a linha em trechos normais e marcados, para sublinhar os erros apontados nela.
 * A busca ignora caixa; erros sobrepostos ou não encontrados ficam só na lista abaixo do texto.
 */
export function segmentosDaLinha(linha: string, erros: { numero: number; trecho: string }[]): Segmento[] {
  const minuscula = linha.toLocaleLowerCase("pt-BR");
  const marcas: { inicio: number; fim: number; numero: number }[] = [];
  for (const e of erros) {
    const alvo = e.trecho.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) continue;
    let inicio = minuscula.indexOf(alvo);
    while (inicio >= 0 && marcas.some((m) => inicio < m.fim && inicio + alvo.length > m.inicio)) {
      inicio = minuscula.indexOf(alvo, inicio + 1);
    }
    if (inicio >= 0) marcas.push({ inicio, fim: inicio + alvo.length, numero: e.numero });
  }
  marcas.sort((a, b) => a.inicio - b.inicio);
  const segmentos: Segmento[] = [];
  let pos = 0;
  for (const m of marcas) {
    if (m.inicio > pos) segmentos.push({ texto: linha.slice(pos, m.inicio), erro: null });
    segmentos.push({ texto: linha.slice(m.inicio, m.fim), erro: m.numero });
    pos = m.fim;
  }
  if (pos < linha.length || segmentos.length === 0) segmentos.push({ texto: linha.slice(pos), erro: null });
  return segmentos;
}

// Traduz os erros levantados pelas funções do banco (discursiva_entregar / enviar_fotos / pedir_tema).
export function mensagemDoBanco(mensagem: string): string {
  if (mensagem.includes("limite_simultaneas")) return "Você já tem 2 redações em correção. Espere uma terminar para entregar outra.";
  if (mensagem.includes("limite_diario")) return "Você atingiu o limite de 10 correções por dia. Tente de novo amanhã.";
  if (mensagem.includes("não pode ser entregue") || mensagem.includes("não pode receber fotos")) {
    return "Esta redação já foi entregue. Atualize a página.";
  }
  if (mensagem.includes("fotos")) return "Envie 1 ou 2 fotos da folha.";
  return "Não foi possível concluir agora. Verifique a conexão e tente de novo.";
}

const ERRO_FORMATO = "Use uma foto em JPEG, PNG ou WebP.";
const MIDIAS = ["image/jpeg", "image/png", "image/webp"];

export function validarFoto(arquivo: { type: string; size: number }): string | null {
  if (!MIDIAS.includes(arquivo.type)) return ERRO_FORMATO;
  if (arquivo.size > 15 * 1024 * 1024) return "A foto passa de 15 MB. Tire outra com resolução menor.";
  return null;
}

// Os enunciados da banca começam quase todos igual ("Considerando que os textos..."); o título útil vem depois de "tema:".
export function resumoDoTema(enunciado: string): string {
  const m = /\btema:\s*([^\n]+)/i.exec(enunciado);
  const titulo = (m ? m[1] : enunciado).trim().replace(/[.:]\s*$/, "");
  return titulo.length > 160 ? `${titulo.slice(0, 157)}…` : titulo;
}

export interface ResumoRedacoes {
  ultima: number | null;
  // Média das últimas 5 corrigidas.
  media: number | null;
  pontos: { id: string; quando: string; npd: number }[];
  categorias: { categoria: string; rotulo: string; canonico: string | null; n: number }[];
}

const DIAS_ERROS = 30;

// Seção "Redação" do painel: notas das corrigidas (até 8 no gráfico) e as categorias de erro mais frequentes em 30 dias.
export function resumoDasRedacoes(
  redacoes: { id: string; status: string; npd: number | null; corrigidaEm: string | null }[],
  erros: { categoria: string; criadoEm: string }[],
  agora: Date,
): ResumoRedacoes {
  const corrigidas = redacoes
    .filter((r) => r.status === "corrigida" && r.npd !== null && r.corrigidaEm)
    .map((r) => ({ id: r.id, quando: r.corrigidaEm!, npd: r.npd! }))
    .sort((a, b) => a.quando.localeCompare(b.quando));
  const ultimas5 = corrigidas.slice(-5);
  const desde = agora.getTime() - DIAS_ERROS * 86_400_000;
  const contagem = new Map<string, number>();
  for (const e of erros) if (new Date(e.criadoEm).getTime() >= desde) contagem.set(e.categoria, (contagem.get(e.categoria) ?? 0) + 1);
  const categorias = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([categoria, n]) => ({
      categoria,
      rotulo: ROTULO_CATEGORIA[categoria as CategoriaErro] ?? categoria,
      canonico: CANONICO_POR_CATEGORIA[categoria as CategoriaErro] ?? null,
      n,
    }));
  return {
    ultima: corrigidas.at(-1)?.npd ?? null,
    media: ultimas5.length ? ultimas5.reduce((s, r) => s + r.npd, 0) / ultimas5.length : null,
    pontos: corrigidas.slice(-8),
    categorias,
  };
}

// Tema da discursiva no simulado: real ainda não feito, depois gerado não feito, depois qualquer um.
export function escolherTemaDoSimulado<T extends { id: string; origem: string; feito: boolean }>(temas: T[]): T | null {
  return (
    temas.find((t) => t.origem === "real" && !t.feito) ??
    temas.find((t) => !t.feito) ??
    temas[0] ??
    null
  );
}

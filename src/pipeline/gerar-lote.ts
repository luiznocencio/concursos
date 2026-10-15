import { ErroIa, type Provedor, type ProvedorIa, type RespostaJson, type UsoIa } from "../ai/tipos";
import { janelaDeDispositivos, type Dispositivo } from "../core/fontes/dispositivos";
import { hashNormalizado } from "./hash";
import {
  PROMPT_VERSAO,
  promptGeracao,
  promptValidacao,
  SISTEMA_GERADOR,
  SISTEMA_VALIDADOR,
  type ContextoTopico,
} from "./prompts";
import { julgamentosSchema, loteGeradoSchema } from "./schemas";

export const MAX_ITENS_POR_LOTE = 5;
export const TAMANHO_JANELA_FONTE = 8;
const AREAS_COM_FONTE_OBRIGATORIA = ["legislacao-cbmal/"];

export interface FonteLegal {
  slug: string;
  titulo: string;
  dispositivos: Dispositivo[];
}

export interface ValidacaoItem {
  prompt_versao: string;
  gerador: { provedor: Provedor; modelo: string };
  validador: { provedor: Provedor; modelo: string };
  gabarito_validador: "C" | "E" | null;
  justificativa_validador: string | null;
  concordancia: boolean;
  mesmo_provedor: boolean;
}

export interface ItemParaGravar {
  enunciado: string;
  gabarito: "C" | "E";
  justificativa: string;
  citacao: string | null;
  dificuldade: 1 | 2 | 3;
  hash: string;
  status: "aprovado" | "revisao";
  validacao: ValidacaoItem;
  canonicos: string[];
}

export interface LoteParaGravar {
  banca: string;
  formato: "certo_errado";
  origem: "ia";
  texto_base: string | null;
  fonte: string | null;
  itens: ItemParaGravar[];
}

export interface RepositorioPipeline {
  hashesExistentes(hashes: string[]): Promise<Set<string>>;
  exemplosReais(canonico: string, limite: number): Promise<{ enunciado: string; gabarito: string }[]>;
  registrarLote(lote: LoteParaGravar): Promise<number>;
  registrarUso(uso: UsoIa, finalidade: string, jobId: string | null): Promise<void>;
}

export interface DepsPipeline {
  provedores: [ProvedorIa, ProvedorIa];
  repo: RepositorioPipeline;
  jobId: string | null;
}

export interface EntradaLote {
  banca: string;
  topico: ContextoTopico;
  quantidade: number;
  rodada: number;
  fonte: FonteLegal | null;
}

export interface ResumoLote {
  gerados: number;
  duplicados: number;
  aprovados: number;
  revisao: number;
  gravados: number;
  custoUsd: number;
  gerador: Provedor | null;
  validador: Provedor | null;
}

// `definitivo` indica que repetir o job não adianta (ex.: falta configurar uma fonte).
export class ErroPipeline extends Error {
  constructor(
    mensagem: string,
    public readonly definitivo = false,
  ) {
    super(mensagem);
    this.name = "ErroPipeline";
  }
}

// Tenta os provedores na ordem dada; registra o uso de cada chamada (inclusive as que falham depois de cobrar).
async function chamarComReserva<T>(
  deps: DepsPipeline,
  ordem: ProvedorIa[],
  finalidade: string,
  custo: { total: number },
  chamada: (p: ProvedorIa) => Promise<RespostaJson<T>>,
): Promise<RespostaJson<T> & { provedor: ProvedorIa }> {
  const erros: string[] = [];
  for (const provedor of ordem) {
    try {
      const r = await chamada(provedor);
      custo.total += r.uso.custoUsd;
      await deps.repo.registrarUso(r.uso, finalidade, deps.jobId);
      return { ...r, provedor };
    } catch (e) {
      if (!(e instanceof ErroIa)) throw e;
      if (e.uso) {
        custo.total += e.uso.custoUsd;
        await deps.repo.registrarUso(e.uso, finalidade, deps.jobId);
      }
      erros.push(`${provedor.nome}: ${e.motivo} (${e.message})`);
    }
  }
  throw new ErroPipeline(`${finalidade} falhou em todos os provedores: ${erros.join("; ")}`);
}

function dificuldade(valor: number): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, Math.round(valor))) as 1 | 2 | 3;
}

export async function gerarLote(deps: DepsPipeline, e: EntradaLote): Promise<ResumoLote> {
  const { canonico } = e.topico;
  if (!e.fonte && AREAS_COM_FONTE_OBRIGATORIA.some((a) => canonico.startsWith(a))) {
    throw new ErroPipeline(`Fonte legal ausente para ${canonico}`, true);
  }

  const quantidade = Math.min(MAX_ITENS_POR_LOTE, Math.max(1, Math.floor(e.quantidade)));
  const [a, b] = deps.provedores;
  const principal = e.rodada % 2 === 0 ? a : b;
  const outro = principal === a ? b : a;
  const fonte = e.fonte
    ? { titulo: e.fonte.titulo, dispositivos: janelaDeDispositivos(e.fonte.dispositivos, e.rodada, TAMANHO_JANELA_FONTE) }
    : null;
  const custo = { total: 0 };

  const exemplos = await deps.repo.exemplosReais(canonico, 5);
  const geracao = await chamarComReserva(deps, [principal, outro], "gerar_itens", custo, (p) =>
    p.gerarJson({
      finalidade: "gerar_itens",
      sistema: SISTEMA_GERADOR,
      prompt: promptGeracao({ banca: e.banca, topico: e.topico, quantidade, fonte, exemplos }),
      schema: loteGeradoSchema,
      nomeSchema: "lote_itens",
    }),
  );

  const textoBase = geracao.dados.texto_base?.trim() || null;
  const itens = geracao.dados.itens.slice(0, quantidade).map((i) => ({ ...i, hash: hashNormalizado(i.enunciado, textoBase) }));
  const existentes = await deps.repo.hashesExistentes(itens.map((i) => i.hash));
  const vistos = new Set<string>();
  const novos = itens.filter((i) => {
    if (existentes.has(i.hash) || vistos.has(i.hash)) return false;
    vistos.add(i.hash);
    return true;
  });

  const resumo: ResumoLote = {
    gerados: itens.length,
    duplicados: itens.length - novos.length,
    aprovados: 0,
    revisao: 0,
    gravados: 0,
    custoUsd: 0,
    gerador: geracao.provedor.nome,
    validador: null,
  };
  if (novos.length === 0) return { ...resumo, custoUsd: custo.total };

  const ordemValidacao = geracao.provedor === a ? [b, a] : [a, b];
  const validacao = await chamarComReserva(deps, ordemValidacao, "validar_itens", custo, (p) =>
    p.gerarJson({
      finalidade: "validar_itens",
      sistema: SISTEMA_VALIDADOR,
      prompt: promptValidacao({ topico: e.topico, textoBase, enunciados: novos.map((n) => n.enunciado), fonte }),
      schema: julgamentosSchema,
      nomeSchema: "julgamentos",
    }),
  );
  const mesmoProvedor = validacao.provedor === geracao.provedor;
  const julgamentos = new Map(validacao.dados.julgamentos.map((j) => [j.indice, j]));

  const paraGravar: ItemParaGravar[] = novos.map((n, indice) => {
    const j = julgamentos.get(indice);
    const concordancia = j?.gabarito === n.gabarito;
    return {
      enunciado: n.enunciado,
      gabarito: n.gabarito,
      justificativa: n.justificativa,
      citacao: n.citacao,
      dificuldade: dificuldade(n.dificuldade),
      hash: n.hash,
      status: concordancia && !mesmoProvedor ? "aprovado" : "revisao",
      validacao: {
        prompt_versao: PROMPT_VERSAO,
        gerador: { provedor: geracao.uso.provedor, modelo: geracao.uso.modelo },
        validador: { provedor: validacao.uso.provedor, modelo: validacao.uso.modelo },
        gabarito_validador: j?.gabarito ?? null,
        justificativa_validador: j?.justificativa ?? null,
        concordancia,
        mesmo_provedor: mesmoProvedor,
      },
      canonicos: [canonico],
    };
  });

  const gravados = await deps.repo.registrarLote({
    banca: e.banca,
    formato: "certo_errado",
    origem: "ia",
    texto_base: textoBase,
    fonte: e.fonte?.slug ?? null,
    itens: paraGravar,
  });

  return {
    ...resumo,
    aprovados: paraGravar.filter((i) => i.status === "aprovado").length,
    revisao: paraGravar.filter((i) => i.status === "revisao").length,
    gravados,
    custoUsd: custo.total,
    validador: validacao.provedor.nome,
  };
}

// Avaliação manual (fora dos testes automáticos): qual modelo Claude serve para GERAR lotes.
// Para 6 tópicos fixos do edital cbmal-2026, cada modelo candidato gera 1 lote de 5 itens com o
// mesmo prompt e o mesmo fluxo do pipeline (gerarLote), e um validador cego fixo (Claude Opus 5.5)
// julga os itens. Mede custo, tempo, concordância de gabarito e problemas, e salva tudo em JSON.
// Não toca no Supabase: o repositório do pipeline é substituído por um em memória.
// Faz chamadas reais e pagas à API da Anthropic; para sozinho ao chegar no orçamento.
// Uso: npx tsx --env-file=.env.local scripts/avaliar-modelos.ts [pasta-de-saida]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod/v4";
import { criarProvedorClaude, type ConfigClaude } from "../src/ai/claude";
import { ErroIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "../src/ai/tipos";
import { parseEdital } from "../src/core/edital/parse";
import type { Edital, Topico } from "../src/core/edital/schema";
import { dividirEmArtigos } from "../src/core/fontes/dispositivos";
import { parseManifestoFontes } from "../src/core/fontes/manifesto";
import {
  gerarLote,
  type FonteLegal,
  type LoteParaGravar,
  type RepositorioPipeline,
  type ResumoLote,
} from "../src/pipeline/gerar-lote";
import { PROMPT_VERSAO, type ContextoTopico } from "../src/pipeline/prompts";

const LIMITE_USD = 1.5;
const CONCURSO = "cbmal-2026";
const BANCA = "cebraspe";
const QUANTIDADE = 5;
// Rodada par: o primeiro provedor (o candidato) gera e o segundo (o validador) julga.
// Também fixa a janela de artigos da lei, igual para todos os modelos.
const RODADA = 4;

const TOPICOS = [
  "portugues/concordancia-verbal-e-nominal",
  "raciocinio-logico/contagem-e-probabilidade",
  "fisica/leis-de-newton",
  "direito-administrativo/ato-administrativo",
  "informatica/virus-worms-e-pragas-virtuais",
  "legislacao-cbmal/lei-5346-1992-estatuto",
];

interface Candidato {
  rotulo: string;
  modelo: string;
  esforco: NonNullable<ConfigClaude["esforco"]>;
  // Estimativa inicial de gasto por lote (geração + validação), só para a trava de orçamento.
  estimativaUsd: number;
}

const CANDIDATOS: Candidato[] = [
  { rotulo: "haiku-5-5/high", modelo: "claude-haiku-5-5", esforco: "high", estimativaUsd: 0.07 },
  { rotulo: "sonnet-5-5/high", modelo: "claude-sonnet-5-5", esforco: "high", estimativaUsd: 0.1 },
  { rotulo: "opus-5-5/high", modelo: "claude-opus-5-5", esforco: "high", estimativaUsd: 0.14 },
];
const VALIDADOR = { modelo: "claude-opus-5-5", esforco: "high" as const };

class OrcamentoEsgotado extends Error {}

interface Chamada {
  papel: "gerador" | "validador";
  finalidade: string;
  modelo: string;
  ms: number;
  uso: UsoIa | null;
  erro: string | null;
  dados: unknown;
}

const gasto = { total: 0 };

// Mede tempo e custo de cada chamada e barra novas chamadas quando o orçamento acaba.
function instrumentar(provedor: ProvedorIa, papel: Chamada["papel"], modelo: string, chamadas: Chamada[]): ProvedorIa {
  return {
    nome: provedor.nome,
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      if (papel === "validador" && pedido.finalidade === "gerar_itens") {
        // Sem isto o pipeline cairia no validador como gerador reserva e contaminaria a comparação.
        throw new ErroIa("anthropic", "api", "o validador da avaliação não gera itens");
      }
      if (papel === "gerador" && pedido.finalidade === "validar_itens") {
        // Idem: se o validador falhar, o candidato não pode julgar os próprios itens.
        throw new ErroIa("anthropic", "api", "o candidato não valida itens na avaliação");
      }
      if (gasto.total >= LIMITE_USD) throw new OrcamentoEsgotado(`orçamento de US$ ${LIMITE_USD} esgotado`);
      const inicio = performance.now();
      try {
        const r = await provedor.gerarJson(pedido);
        gasto.total += r.uso.custoUsd;
        chamadas.push({ papel, finalidade: pedido.finalidade, modelo, ms: performance.now() - inicio, uso: r.uso, erro: null, dados: r.dados });
        return r;
      } catch (e) {
        const uso = e instanceof ErroIa ? (e.uso ?? null) : null;
        if (uso) gasto.total += uso.custoUsd;
        const erro = e instanceof ErroIa ? `${e.motivo}: ${e.message}` : String(e);
        chamadas.push({ papel, finalidade: pedido.finalidade, modelo, ms: performance.now() - inicio, uso, erro, dados: null });
        throw e;
      }
    },
  };
}

function repositorioEmMemoria(lotes: LoteParaGravar[]): RepositorioPipeline {
  return {
    hashesExistentes: async () => new Set(),
    exemplosReais: async () => [],
    registrarLote: async (lote) => {
      lotes.push(lote);
      return lote.itens.length;
    },
    registrarUso: async () => {},
  };
}

function caminhoDoTopico(topicos: Topico[], canonico: string): string[] | null {
  for (const t of topicos) {
    const rotulo = `${t.codigo} ${t.titulo}`;
    if (t.canonico === canonico) return [rotulo];
    if (t.subtopicos) {
      const resto = caminhoDoTopico(t.subtopicos, canonico);
      if (resto) return [rotulo, ...resto];
    }
  }
  return null;
}

// Mesmo formato que carregarContexto monta a partir do banco.
function contextoDoTopico(edital: Edital, canonico: string): ContextoTopico {
  for (const d of edital.disciplinas) {
    const caminho = caminhoDoTopico(d.topicos, canonico);
    if (caminho) return { canonico, disciplina: d.nome, programa: caminho.join(" > ") };
  }
  throw new Error(`Tópico ${canonico} não está no edital`);
}

function carregarFonte(canonico: string): FonteLegal | null {
  const pasta = `editais/${CONCURSO}/fontes`;
  const manifesto = parseManifestoFontes(readFileSync(`${pasta}/fontes.yaml`, "utf8"));
  const f = manifesto.fontes.find((x) => x.canonicos.includes(canonico));
  if (!f) return null;
  return { slug: f.slug, titulo: f.titulo, dispositivos: dividirEmArtigos(readFileSync(`${pasta}/${f.arquivo}`, "utf8")) };
}

interface ResultadoLote {
  candidato: string;
  modelo: string;
  esforco: string;
  topico: string;
  comFonte: boolean;
  resumo: ResumoLote | null;
  erro: string | null;
  chamadas: Chamada[];
  lote: LoteParaGravar | null;
}

function problemasDoLote(r: ResultadoLote): string[] {
  const p: string[] = [];
  if (r.erro) p.push(`falhou: ${r.erro}`);
  const geracao = r.chamadas.find((c) => c.finalidade === "gerar_itens" && c.dados);
  const brutos = (geracao?.dados as { itens?: unknown[] } | undefined)?.itens?.length ?? 0;
  if (geracao && brutos !== QUANTIDADE) p.push(`gerou ${brutos} itens em vez de ${QUANTIDADE}`);
  if (r.resumo?.duplicados) p.push(`${r.resumo.duplicados} duplicados`);
  const itens = r.lote?.itens ?? [];
  if (itens.length && itens.every((i) => i.gabarito === itens[0].gabarito)) p.push(`gabarito todo ${itens[0].gabarito}`);
  if (r.comFonte && itens.some((i) => !i.citacao)) p.push("item sem citação do dispositivo");
  if (itens.some((i) => i.validacao.gabarito_validador == null)) p.push("item sem julgamento do validador");
  const dificuldades = (geracao?.dados as { itens?: { dificuldade: number }[] } | undefined)?.itens ?? [];
  if (dificuldades.some((i) => ![1, 2, 3].includes(i.dificuldade))) p.push("dificuldade fora de 1 a 3");
  return p;
}

function custoDe(chamadas: Chamada[], papel: Chamada["papel"]): number {
  return chamadas.filter((c) => c.papel === papel).reduce((s, c) => s + (c.uso?.custoUsd ?? 0), 0);
}

function msDe(chamadas: Chamada[], papel: Chamada["papel"]): number {
  return chamadas.filter((c) => c.papel === papel).reduce((s, c) => s + c.ms, 0);
}

function resumir(resultados: ResultadoLote[]) {
  return CANDIDATOS.map((c) => {
    const rs = resultados.filter((r) => r.candidato === c.rotulo);
    const ok = rs.filter((r) => r.lote);
    const itens = ok.flatMap((r) => r.lote!.itens);
    const julgados = itens.filter((i) => i.validacao.gabarito_validador != null);
    const concordantes = julgados.filter((i) => i.validacao.concordancia).length;
    const custoGeracao = rs.reduce((s, r) => s + custoDe(r.chamadas, "gerador"), 0);
    const custoValidacao = rs.reduce((s, r) => s + custoDe(r.chamadas, "validador"), 0);
    const tokensSaida = rs.flatMap((r) => r.chamadas.filter((x) => x.papel === "gerador")).reduce((s, x) => s + (x.uso?.tokensSaida ?? 0), 0);
    return {
      candidato: c.rotulo,
      lotes: rs.length,
      lotesOk: ok.length,
      itens: itens.length,
      itensEsperados: rs.length * QUANTIDADE,
      concordancia: julgados.length ? concordantes / julgados.length : null,
      discordantes: julgados.length - concordantes,
      gabaritoC: itens.filter((i) => i.gabarito === "C").length,
      gabaritoE: itens.filter((i) => i.gabarito === "E").length,
      custoGeracaoUsd: custoGeracao,
      custoGeracaoPorLoteUsd: rs.length ? custoGeracao / rs.length : null,
      custoValidacaoUsd: custoValidacao,
      tokensSaidaGeracaoPorLote: rs.length ? tokensSaida / rs.length : null,
      tempoGeracaoMedioS: rs.length ? rs.reduce((s, r) => s + msDe(r.chamadas, "gerador"), 0) / rs.length / 1000 : null,
      problemas: rs.flatMap((r) => problemasDoLote(r).map((p) => `${r.topico}: ${p}`)),
    };
  });
}

async function main() {
  const saida = process.argv[2] ?? "avaliacao-modelos";
  mkdirSync(saida, { recursive: true });
  const edital = parseEdital(readFileSync(`editais/${CONCURSO}/edital.yaml`, "utf8"));
  const validadorBase = criarProvedorClaude({ modelo: VALIDADOR.modelo, esforco: VALIDADOR.esforco });
  const geradores = new Map(CANDIDATOS.map((c) => [c.rotulo, criarProvedorClaude({ modelo: c.modelo, esforco: c.esforco })]));
  const resultados: ResultadoLote[] = [];
  const maiorGasto = new Map<string, number>();
  let interrompido: string | null = null;

  const salvar = () =>
    writeFileSync(
      path.join(saida, "resultados.json"),
      JSON.stringify(
        {
          geradoEm: new Date().toISOString(),
          promptVersao: PROMPT_VERSAO,
          rodada: RODADA,
          limiteUsd: LIMITE_USD,
          gastoTotalUsd: gasto.total,
          interrompido,
          validador: VALIDADOR,
          candidatos: CANDIDATOS,
          resumo: resumir(resultados),
          resultados,
        },
        null,
        2,
      ),
    );

  externo: for (const canonico of TOPICOS) {
    const topico = contextoDoTopico(edital, canonico);
    const fonte = carregarFonte(canonico);
    for (const c of CANDIDATOS) {
      const previsto = maiorGasto.get(c.rotulo) ?? c.estimativaUsd;
      if (gasto.total + previsto > LIMITE_USD) {
        interrompido = `parou antes de ${canonico} / ${c.rotulo}: gasto US$ ${gasto.total.toFixed(4)} + previsto US$ ${previsto.toFixed(4)} passaria de US$ ${LIMITE_USD}`;
        console.log(interrompido);
        break externo;
      }
      const chamadas: Chamada[] = [];
      const lotes: LoteParaGravar[] = [];
      const gerador = instrumentar(geradores.get(c.rotulo)!, "gerador", c.modelo, chamadas);
      const validador = instrumentar(validadorBase, "validador", VALIDADOR.modelo, chamadas);
      let resumo: ResumoLote | null = null;
      let erro: string | null = null;
      try {
        resumo = await gerarLote(
          { provedores: [gerador, validador], repo: repositorioEmMemoria(lotes), jobId: null },
          { banca: BANCA, topico, quantidade: QUANTIDADE, rodada: RODADA, fonte },
        );
      } catch (e) {
        erro = e instanceof Error ? e.message : String(e);
        if (e instanceof OrcamentoEsgotado) interrompido = erro;
      }
      const r: ResultadoLote = {
        candidato: c.rotulo,
        modelo: c.modelo,
        esforco: c.esforco,
        topico: canonico,
        comFonte: fonte != null,
        resumo,
        erro,
        chamadas,
        lote: lotes[0] ?? null,
      };
      resultados.push(r);
      const custoLote = chamadas.reduce((s, x) => s + (x.uso?.custoUsd ?? 0), 0);
      if (custoLote > 0) maiorGasto.set(c.rotulo, Math.max(maiorGasto.get(c.rotulo) ?? 0, custoLote));
      const itens = r.lote?.itens ?? [];
      console.log(
        `${canonico} | ${c.rotulo} | ${itens.length} itens | concordância ${itens.filter((i) => i.validacao.concordancia).length}/${itens.length}` +
          ` | lote US$ ${custoLote.toFixed(4)} | geração ${(msDe(chamadas, "gerador") / 1000).toFixed(1)} s | total US$ ${gasto.total.toFixed(4)}` +
          (erro ? ` | ERRO ${erro}` : ""),
      );
      salvar();
      if (interrompido) break externo;
    }
  }

  salvar();
  console.table(
    resumir(resultados).map(({ problemas, ...r }) => ({ ...r, problemas: problemas.length })),
  );
  console.log(`Gasto total: US$ ${gasto.total.toFixed(4)}. Resultados em ${path.join(saida, "resultados.json")}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

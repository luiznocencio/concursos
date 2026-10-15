import {
  calcularPrioridades,
  montarEstudarAgora,
  montarSimuladoProva,
  montarTreinoTopico,
  proximoEstadoRevisao,
  topicosQuePrecisamGeracao,
} from "@/core";
import { resultadoCompleto, resultadoDe, resumoTreino } from "./resultado";
import type { ConfigSessao, Marcacao, RepositorioEstudo, ResultadoResposta, ResultadoSessao, Sessao } from "./tipos";

// A prova discursiva ainda não é simulada: o simulado completo usa só as objetivas
// (4h30 menos 1h no CBM-AL, como a opção "só objetivas" da spec).
export const DURACAO_DISCURSIVA_MIN = 60;
// Tolerância para respostas que chegam logo depois do fim do tempo (latência da rede).
export const TOLERANCIA_ENTREGA_MS = 60_000;
export const MAX_ITENS_REVISAO = 30;

export class ErroEstudo extends Error {
  constructor(
    readonly codigo: "sessao_inexistente" | "sessao_encerrada" | "item_fora_da_sessao" | "modo_invalido" | "tempo_esgotado",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroEstudo";
  }
}

export type InicioSessao =
  | { tipo: "criada"; sessaoId: string; pedidosGeracao: number }
  | { tipo: "sem_itens"; pedidosGeracao: number };

async function pedirSemFalhar(repo: RepositorioEstudo, concurso: string, canonicos: string[]): Promise<number> {
  if (canonicos.length === 0) return 0;
  try {
    return await repo.pedirGeracao(concurso, canonicos);
  } catch {
    // A geração é melhor-esforço; o estudo nunca depende dela.
    return 0;
  }
}

export async function iniciarEstudarAgora(repo: RepositorioEstudo, cargoId: string, agora: Date): Promise<InicioSessao> {
  const [estrutura, candidatos, historico, vencidas] = await Promise.all([
    repo.estrutura(cargoId),
    repo.candidatos(cargoId),
    repo.historico(cargoId),
    repo.revisoesVencidas(agora),
  ]);
  const prioridades = calcularPrioridades(estrutura.topicosAlvo, historico, agora);
  const pedidosGeracao = await pedirSemFalhar(
    repo,
    estrutura.concurso.slug,
    topicosQuePrecisamGeracao(prioridades, candidatos),
  );
  const itens = montarEstudarAgora({ prioridades, itens: candidatos, revisaoVencida: vencidas });
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao };
  const sessaoId = await repo.criarSessao(cargoId, "treino", { tipo: "estudar_agora" }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao };
}

export async function iniciarTreinoTopico(
  repo: RepositorioEstudo,
  cargoId: string,
  canonicos: string[],
  total: number,
): Promise<InicioSessao> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const itens = montarTreinoTopico({ canonicos, itens: candidatos, total });
  const faltando = canonicos.filter((c) => candidatos.filter((i) => !i.visto && i.canonicos.includes(c)).length < total);
  const pedidosGeracao = await pedirSemFalhar(repo, estrutura.concurso.slug, faltando);
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao };
  const sessaoId = await repo.criarSessao(cargoId, "treino", { tipo: "topico", canonicos }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao };
}

export async function iniciarRevisao(repo: RepositorioEstudo, cargoId: string, agora: Date): Promise<InicioSessao> {
  const [candidatos, vencidas] = await Promise.all([repo.candidatos(cargoId), repo.revisoesVencidas(agora)]);
  const doCargo = new Set(candidatos.map((c) => c.id));
  const itens = vencidas.filter((id) => doCargo.has(id)).slice(0, MAX_ITENS_REVISAO);
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao: 0 };
  const sessaoId = await repo.criarSessao(cargoId, "revisao", { tipo: "revisao" }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao: 0 };
}

export interface Faltante {
  prova: string;
  disciplina: string;
  nome: string;
  faltam: number;
  canonicos: string[];
}

export type InicioSimulado = { tipo: "criada"; sessaoId: string } | { tipo: "faltam_itens"; faltantes: Faltante[] };

export interface PreviaSimulado {
  config: Extract<ConfigSessao, { tipo: "completo" }>;
  faltantes: Faltante[];
}

// Sem viés adaptativo: segue a distribuição do edital, priorizando itens não vistos.
export async function previaSimulado(repo: RepositorioEstudo, cargoId: string): Promise<PreviaSimulado> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const usados = new Set<string>();
  const provas: { slug: string; itens: string[] }[] = [];
  const disciplinaDoItem: Record<string, string> = {};
  const faltantes: Faltante[] = [];
  for (const prova of estrutura.provas) {
    const m = montarSimuladoProva(prova.demandas, candidatos, usados);
    for (const id of m.itens) usados.add(id);
    Object.assign(disciplinaDoItem, m.disciplinaDoItem);
    provas.push({ slug: prova.slug, itens: m.itens });
    for (const f of m.faltantes) {
      faltantes.push({
        prova: prova.slug,
        disciplina: f.disciplina,
        nome: estrutura.disciplinas[f.disciplina] ?? f.disciplina,
        faltam: f.faltam,
        canonicos: prova.demandas.find((d) => d.disciplina === f.disciplina)?.canonicos ?? [],
      });
    }
  }
  const duracaoMin = estrutura.cargo.duracaoMin - (estrutura.temDiscursiva ? DURACAO_DISCURSIVA_MIN : 0);
  return { config: { tipo: "completo", duracaoMin, provas, disciplinaDoItem }, faltantes };
}

export async function iniciarSimulado(repo: RepositorioEstudo, cargoId: string): Promise<InicioSimulado> {
  const { config, faltantes } = await previaSimulado(repo, cargoId);
  if (faltantes.length > 0) return { tipo: "faltam_itens", faltantes };
  const sessaoId = await repo.criarSessao(cargoId, "completo", config, config.provas.flatMap((p) => p.itens));
  return { tipo: "criada", sessaoId };
}

// Os tópicos da disciplina com menos itens não vistos vão primeiro para a fila de geração.
export async function pedirGeracaoDosFaltantes(
  repo: RepositorioEstudo,
  cargoId: string,
  canonicos: string[],
): Promise<number> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const naoVistos = (c: string) => candidatos.filter((i) => !i.visto && i.canonicos.includes(c)).length;
  const ordem = [...new Set(canonicos)].sort((a, b) => naoVistos(a) - naoVistos(b) || a.localeCompare(b));
  return repo.pedirGeracao(estrutura.concurso.slug, ordem);
}

async function sessaoAberta(repo: RepositorioEstudo, sessaoId: string, itemId?: string): Promise<Sessao> {
  const s = await repo.sessao(sessaoId);
  if (!s) throw new ErroEstudo("sessao_inexistente", "Sessão não encontrada.");
  if (s.finalizadaEm) throw new ErroEstudo("sessao_encerrada", "Esta sessão já foi encerrada.");
  if (itemId && !s.itens.includes(itemId)) throw new ErroEstudo("item_fora_da_sessao", "Item não pertence à sessão.");
  return s;
}

export interface Correcao {
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
  resultado: ResultadoResposta;
  concluida: boolean;
}

async function atualizarRevisao(repo: RepositorioEstudo, itemId: string, resultado: ResultadoResposta, agora: Date) {
  const atual = (await repo.estadosRevisao([itemId])).get(itemId) ?? null;
  await repo.salvarRevisao(itemId, proximoEstadoRevisao(atual, resultado, agora));
}

// Treino e revisão: grava a resposta, devolve a correção e atualiza a repetição espaçada.
// Uma resposta já gravada não muda (o gabarito já foi mostrado).
export async function responderItem(
  repo: RepositorioEstudo,
  p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean; tempoMs: number | null; agora: Date },
): Promise<Correcao> {
  const s = await sessaoAberta(repo, p.sessaoId, p.itemId);
  if (s.modo === "completo") throw new ErroEstudo("modo_invalido", "No simulado completo a correção sai no final.");

  const nova = await repo.gravarResposta(
    p.sessaoId,
    { itemId: p.itemId, resposta: p.resposta, duvida: p.duvida, tempoMs: p.tempoMs },
    false,
  );
  const respostas = await repo.respostas(p.sessaoId);
  const gravada = respostas.find((r) => r.itemId === p.itemId)!;
  const [item] = await repo.itensCorrecao([p.itemId]);
  const resultado = resultadoDe(gravada.resposta, gravada.duvida, item.gabarito);
  if (nova) await atualizarRevisao(repo, p.itemId, resultado, p.agora);

  const concluida = s.itens.every((id) => respostas.some((r) => r.itemId === id));
  if (concluida) {
    const gabaritos = new Map((await repo.itensCorrecao(s.itens)).map((i) => [i.id, i.gabarito]));
    await repo.finalizar(p.sessaoId, resumoTreino(respostas, gabaritos), p.agora);
  }
  return {
    itemId: p.itemId,
    resposta: gravada.resposta,
    duvida: gravada.duvida,
    gabarito: item.gabarito,
    justificativa: item.justificativa,
    citacao: item.citacao,
    fonte: item.fonte,
    resultado,
    concluida,
  };
}

// Encerra um treino antes do fim (itens não respondidos ficam de fora do resumo).
export async function encerrarTreino(repo: RepositorioEstudo, sessaoId: string, agora: Date): Promise<void> {
  const s = await sessaoAberta(repo, sessaoId);
  if (s.modo === "completo") throw new ErroEstudo("modo_invalido", "Use a entrega do simulado.");
  const respostas = await repo.respostas(sessaoId);
  const gabaritos = new Map((await repo.itensCorrecao(respostas.map((r) => r.itemId))).map((i) => [i.id, i.gabarito]));
  await repo.finalizar(sessaoId, resumoTreino(respostas, gabaritos), agora);
}

export function prazoDoSimulado(s: Sessao): Date | null {
  if (s.config.tipo !== "completo") return null;
  return new Date(s.iniciadaEm.getTime() + s.config.duracaoMin * 60_000);
}

// Simulado completo: grava (ou troca) a marcação, sem correção, enquanto houver tempo.
export async function marcarNoSimulado(
  repo: RepositorioEstudo,
  p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean; agora: Date },
): Promise<void> {
  const s = await sessaoAberta(repo, p.sessaoId, p.itemId);
  const prazo = prazoDoSimulado(s);
  if (!prazo) throw new ErroEstudo("modo_invalido", "Esta sessão não é um simulado completo.");
  if (p.agora.getTime() > prazo.getTime() + TOLERANCIA_ENTREGA_MS) {
    throw new ErroEstudo("tempo_esgotado", "O tempo do simulado acabou.");
  }
  await repo.gravarResposta(p.sessaoId, { itemId: p.itemId, resposta: p.resposta, duvida: p.duvida, tempoMs: null }, true);
}

// Corrige, guarda o resultado e põe na repetição espaçada os itens errados ou em branco.
// Entregar de novo um simulado já entregue não faz nada.
export async function entregarSimulado(repo: RepositorioEstudo, sessaoId: string, agora: Date): Promise<ResultadoSessao> {
  const s = await repo.sessao(sessaoId);
  if (!s) throw new ErroEstudo("sessao_inexistente", "Sessão não encontrada.");
  if (s.config.tipo !== "completo") throw new ErroEstudo("modo_invalido", "Esta sessão não é um simulado completo.");
  const [estrutura, itens, respostas] = await Promise.all([
    repo.estrutura(s.cargoId),
    repo.itensCorrecao(s.itens),
    repo.respostas(sessaoId),
  ]);
  const gabaritos = new Map(itens.map((i) => [i.id, i.gabarito]));
  const resultado = resultadoCompleto(estrutura, s.config, gabaritos, respostas);
  if (s.finalizadaEm) return resultado;

  const porItem = new Map(respostas.map((r) => [r.itemId, r]));
  const estados = await repo.estadosRevisao(s.itens);
  for (const id of s.itens) {
    const r = porItem.get(id);
    const res = r ? resultadoDe(r.resposta, r.duvida, gabaritos.get(id) ?? "") : "branco";
    const proximo = proximoEstadoRevisao(estados.get(id) ?? null, res, agora);
    if (proximo || estados.has(id)) await repo.salvarRevisao(id, proximo);
  }
  await repo.finalizar(sessaoId, resultado, agora);
  return resultado;
}

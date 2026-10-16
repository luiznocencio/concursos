import { chamarComReserva } from "../gerar-lote";
import {
  promptAvaliarTema,
  promptTema,
  SISTEMA_ELABORADOR_TEMA,
  SISTEMA_REVISOR_TEMA,
  type TemaParaPrompt,
} from "./prompts";
import { avaliacaoTemaSchema, temaGeradoSchema, type TemaGerado } from "./schemas";
import type { DepsDiscursiva } from "./tipos";

// Problemas que o código detecta sozinho no padrão de resposta (o tema vai para revisão se houver algum).
export function problemasDoPadrao(tema: TemaGerado, pontuacaoMaxima: number): string[] {
  const problemas: string[] = [];
  const aspectos = tema.padrao_resposta.aspectos;
  if (tema.enunciado.trim() === "") problemas.push("enunciado vazio");
  if (aspectos.length < 2) problemas.push("padrão com menos de 2 aspectos");
  if (new Set(aspectos.map((a) => a.codigo.trim())).size !== aspectos.length) problemas.push("códigos de aspecto repetidos");
  if (aspectos.some((a) => !(a.pontos > 0))) problemas.push("aspecto sem pontuação positiva");
  const soma = aspectos.reduce((s, a) => s + a.pontos, 0);
  if (Math.abs(soma - pontuacaoMaxima) > 0.01) problemas.push(`pontuações somam ${soma}, não ${pontuacaoMaxima}`);
  return problemas;
}

function paraPrompt(t: TemaGerado): TemaParaPrompt {
  return { enunciado: t.enunciado, textosApoio: t.textos_apoio, padrao: t.padrao_resposta };
}

export interface ResumoTema {
  status: "aprovado" | "revisao";
  gravado: boolean;
  problemas: string[];
  gerador: string;
  avaliador: string;
}

// Uma IA cria o tema e o padrão de resposta; a outra avalia. Só vai para os alunos se a avaliação e o código aprovarem.
export async function gerarTema(deps: DepsDiscursiva, concurso: string): Promise<ResumoTema> {
  const ctx = await deps.repo.contextoTema(concurso);
  const [a, b] = deps.provedores;
  const custo = { total: 0 };
  const geracao = await chamarComReserva(deps, [a, b], "discursiva_tema", custo, (p) =>
    p.gerarJson({
      finalidade: "discursiva_tema",
      sistema: SISTEMA_ELABORADOR_TEMA,
      prompt: promptTema(ctx),
      schema: temaGeradoSchema,
      nomeSchema: "tema_redacao",
    }),
  );
  const tema: TemaGerado = {
    enunciado: geracao.dados.enunciado.trim(),
    textos_apoio: geracao.dados.textos_apoio,
    padrao_resposta: {
      aspectos: geracao.dados.padrao_resposta.aspectos.map((x) => ({ ...x, codigo: x.codigo.trim() })),
      expectativas: geracao.dados.padrao_resposta.expectativas,
    },
  };
  const outro = geracao.provedor === a ? b : a;
  const avaliacao = await chamarComReserva(deps, [outro, geracao.provedor], "discursiva_tema_avaliacao", custo, (p) =>
    p.gerarJson({
      finalidade: "discursiva_tema_avaliacao",
      sistema: SISTEMA_REVISOR_TEMA,
      prompt: promptAvaliarTema({ tema: paraPrompt(tema), pontuacaoMaxima: ctx.pontuacaoMaxima }),
      schema: avaliacaoTemaSchema,
      nomeSchema: "avaliacao_tema",
    }),
  );

  const doPadrao = problemasDoPadrao(tema, ctx.pontuacaoMaxima);
  const independente = avaliacao.provedor !== geracao.provedor;
  const status = avaliacao.dados.aprovado && independente && doPadrao.length === 0 ? "aprovado" : "revisao";
  const problemas = [...doPadrao, ...avaliacao.dados.problemas];
  const gravado = await deps.repo.gravarTema(concurso, tema, status);
  return { status, gravado, problemas, gerador: geracao.provedor.nome, avaliador: avaliacao.provedor.nome };
}

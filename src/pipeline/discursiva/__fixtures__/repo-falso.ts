import type { UsoIa } from "../../../ai/tipos";
import type { ResultadoCorrecao } from "../consolidar";
import type { TemaGerado } from "../schemas";
import type { ContextoTema, PapelCorrecao, RedacaoParaProcessar, RepositorioDiscursiva, TranscricaoParaGravar } from "../tipos";

export const ASPECTOS = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];

export function redacao(extra: Partial<RedacaoParaProcessar> = {}): RedacaoParaProcessar {
  return {
    id: "r1",
    usuarioId: "u1",
    status: "na_fila",
    linhas: ["O Brasil precisa investir em prevenção.", "Os bombeiros chegou cedo."],
    fotos: [],
    tema: { enunciado: "Prevenção de incêndios", textosApoio: [], padrao: { aspectos: ASPECTOS, expectativas: "x" } },
    config: { pontuacaoMaxima: 30, linhasMax: 30, notaMinima: 15, caracteresPorLinha: 70 },
    ...extra,
  };
}

// Repositório em memória que registra tudo o que o pipeline grava.
export function criarRepoFalso(r: RedacaoParaProcessar | null = redacao(), feitas: Partial<Record<PapelCorrecao, unknown>> = {}) {
  const estado = {
    redacao: r,
    correcoes: { ...feitas } as Partial<Record<PapelCorrecao, unknown>>,
    status: [] as string[],
    resultado: null as ResultadoCorrecao | null,
    transcricao: null as TranscricaoParaGravar | null,
    temas: [] as { tema: TemaGerado; status: string }[],
    usos: [] as { finalidade: string; custo: number }[],
    fotosBaixadas: [] as string[],
  };
  const contexto: ContextoTema = {
    banca: "cebraspe",
    concurso: "CBM-AL 2026",
    disciplina: "Atualidades",
    programa: "Tópicos relevantes e atuais",
    pontuacaoMaxima: 30,
    linhasMax: 30,
    temasRecentes: ["Tema antigo"],
  };
  const repo: RepositorioDiscursiva = {
    async carregarRedacao() {
      return estado.redacao;
    },
    async correcoes() {
      return { ...estado.correcoes };
    },
    async gravarCorrecao(_id, papel, _uso: UsoIa, resposta) {
      estado.correcoes[papel] = resposta;
    },
    async marcarStatus(_id, status, aviso) {
      estado.status.push(aviso ? `${status}: ${aviso}` : status);
    },
    async gravarResultado(_r, resultado) {
      estado.resultado = resultado;
    },
    async baixarFotos(caminhos) {
      estado.fotosBaixadas.push(...caminhos);
      return caminhos.map(() => ({ midia: "image/jpeg" as const, base64: "QUJD" }));
    },
    async gravarTranscricao(_r, t) {
      estado.transcricao = t;
    },
    async contextoTema() {
      return contexto;
    },
    async gravarTema(_c, tema, status) {
      if (estado.temas.some((t) => t.tema.enunciado === tema.enunciado)) return false;
      estado.temas.push({ tema, status });
      return true;
    },
    async registrarUso(uso, finalidade) {
      estado.usos.push({ finalidade, custo: uso.custoUsd });
    },
  };
  return { repo, estado };
}

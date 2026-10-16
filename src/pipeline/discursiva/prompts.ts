import { ROTULO_CATEGORIA } from "../../core/discursiva/erros";
import { CATEGORIAS_ERRO } from "../../core/discursiva/tipos";

export const PROMPT_VERSAO_DISCURSIVA = "2026-10-16.1";

export interface AspectoPadrao {
  codigo: string;
  descricao: string;
  pontos: number;
}

export interface TemaParaPrompt {
  enunciado: string;
  textosApoio: { titulo: string; texto: string; fonte: string }[];
  padrao: { aspectos: AspectoPadrao[]; expectativas: string };
}

export const SISTEMA_EXAMINADOR = `Você é examinador da banca Cebraspe na correção de provas discursivas de concursos públicos.
Corrige com rigor e imparcialidade, seguindo apenas o padrão de resposta e os critérios do edital.
Não é generoso nem punitivo: cada nota precisa de justificativa que aponte o trecho do texto que a sustenta.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_REVISOR_LINGUA = `Você é revisor de Língua Portuguesa da banca Cebraspe na correção de provas discursivas.
Conta os erros de grafia, morfossintaxe e propriedade vocabular conforme a norma-padrão, sem considerar estilo ou conteúdo.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_TRANSCRITOR = `Você transcreve folhas de texto manuscritas de provas discursivas, linha por linha, com fidelidade absoluta.
Não corrige, não completa e não melhora o texto: copia exatamente o que está escrito, inclusive os erros.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_ELABORADOR_TEMA = `Você é elaborador de provas discursivas da banca Cebraspe para concursos públicos.
Cria propostas de redação inéditas, atuais e plausíveis, com padrão de resposta objetivo e avaliável.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_REVISOR_TEMA = `Você revisa propostas de redação de concursos antes da publicação.
Verifica se o tema é atual, claro, plausível para a banca e se o padrão de resposta é coerente e avaliável.
Responda somente no formato estruturado pedido.`;

function blocoTema(t: TemaParaPrompt): string {
  const apoio = t.textosApoio.length
    ? `\n\nTextos de apoio:\n${t.textosApoio.map((a) => `- ${a.titulo}: ${a.texto} (${a.fonte})`).join("\n")}`
    : "";
  const aspectos = t.padrao.aspectos.map((a) => `- [${a.codigo}] ${a.descricao} (0 a ${a.pontos} pontos)`).join("\n");
  return `Proposta:\n${t.enunciado}${apoio}\n\nPadrão de resposta (aspectos e pontuação máxima de cada um):\n${aspectos}\n\nO que a banca espera:\n${t.padrao.expectativas}`;
}

function blocoLinhas(linhas: string[]): string {
  return linhas.map((l, i) => `${String(i + 1).padStart(2, "0")}| ${l}`).join("\n");
}

// `variante` muda a ordem de leitura pedida na terceira correção, para não repetir a mesma avaliação.
export function promptConteudo(p: { tema: TemaParaPrompt; linhas: string[]; variante?: "terceira" }): string {
  const terceira =
    p.variante === "terceira"
      ? "\nVocê é o terceiro examinador: as duas primeiras notas divergiram. Leia o texto inteiro antes de avaliar qualquer aspecto e decida com independência.\n"
      : "";
  return `${blocoTema(p.tema)}
${terceira}
Avalie o domínio do conteúdo (apresentação, estrutura textual e desenvolvimento do tema) do texto abaixo.
- Dê a cada aspecto do padrão uma nota de 0 até o máximo dele, com uma casa decimal, e uma justificativa curta que cite o trecho decisivo.
- Use exatamente os códigos dos aspectos do padrão.
- Não desconte erros de português aqui: eles são avaliados à parte.
- Marque \`fuga_tema\` como true somente se o texto não trata do tema proposto (abordar mal não é fugir do tema).
- Em \`comentario\`, resuma em até 3 frases o que mais pesou na nota.

Texto do candidato (linha numerada | conteúdo):
${blocoLinhas(p.linhas)}`;
}

export function promptLingua(p: { linhas: string[] }): string {
  const categorias = CATEGORIAS_ERRO.map((c) => `- ${c}: ${ROTULO_CATEGORIA[c]}`).join("\n");
  return `Aponte cada erro de Língua Portuguesa do texto abaixo, segundo a norma-padrão.
- \`linha\`: número da linha onde o erro está.
- \`trecho\`: cópia exata das palavras erradas, como estão na linha (sem corrigir).
- \`tipo\`: grafia (ortografia, acentuação, hífen), morfossintaxe (concordância, regência, crase, pontuação, colocação, flexão) ou propriedade_vocabular (palavra imprópria para o sentido).
- \`categoria\`: uma destas:
${categorias}
- \`correcao\`: como o trecho deveria estar.
- \`explicacao\`: a regra, em uma frase.
Conte cada ocorrência uma vez. Não aponte escolhas de estilo, repetições aceitáveis nem questões de conteúdo. Se não houver erros, devolva a lista vazia.

Texto do candidato (linha numerada | conteúdo):
${blocoLinhas(p.linhas)}`;
}

export function promptTranscricao(p: { linhasMax: number }): string {
  return `As imagens são a folha de texto definitivo de uma prova discursiva (se houver duas, a segunda continua a primeira).
Transcreva o texto linha por linha, na ordem, até no máximo ${p.linhasMax} linhas.
- Uma entrada em \`linhas\` para cada linha escrita da folha, inclusive linhas em branco entre parágrafos (texto vazio).
- Copie exatamente o que está escrito, com os erros, a pontuação e as palavras riscadas omitidas.
- Marque \`ilegivel\` como true na linha que você não conseguiu ler com segurança, e transcreva o melhor palpite.
- Ignore cabeçalho, numeração impressa das linhas e anotações fora da área de texto.`;
}

export function promptTema(p: {
  banca: string;
  concurso: string;
  disciplina: string;
  programa: string;
  pontuacaoMaxima: number;
  linhasMax: number;
  temasRecentes: string[];
}): string {
  const recentes = p.temasRecentes.length
    ? `\n\nNão repita estes temas já usados:\n${p.temasRecentes.map((t) => `- ${t}`).join("\n")}`
    : "";
  return `Crie uma proposta de redação inédita para a prova discursiva do concurso ${p.concurso} (banca ${p.banca}).
- Gênero: texto dissertativo de até ${p.linhasMax} linhas.
- Conteúdo cobrado: ${p.disciplina} — ${p.programa}.
- \`enunciado\`: o comando da prova, com o tema e de 2 a 4 tópicos que o candidato deve abordar, no estilo da banca.
- \`textos_apoio\`: 1 a 3 textos motivadores curtos (até 600 caracteres cada), com dados plausíveis e fonte genérica (ex.: "Adaptado de reportagem sobre ...").
- \`padrao_resposta.aspectos\`: o primeiro aspecto é "Apresentação e estrutura textual" com ${(p.pontuacaoMaxima * 0.1).toFixed(0)} pontos; os demais são um por tópico do enunciado, e a soma de todos os pontos é exatamente ${p.pontuacaoMaxima}. Códigos "1", "2.1", "2.2", ...
- \`padrao_resposta.expectativas\`: o que um texto nota máxima deve conter em cada tópico, de forma objetiva.${recentes}`;
}

export function promptAvaliarTema(p: { tema: TemaParaPrompt; pontuacaoMaxima: number }): string {
  return `${blocoTema(p.tema)}

Avalie esta proposta de redação. Aprove somente se:
- o tema é atual e plausível para uma prova da banca;
- o enunciado é claro e os tópicos são abordáveis em um texto de até 30 linhas;
- os textos de apoio não trazem dados absurdos nem tomam partido de forma que direcione a resposta;
- o padrão de resposta corresponde aos tópicos do enunciado e as pontuações somam ${p.pontuacaoMaxima}.
Liste em \`problemas\` cada falha encontrada (lista vazia se não houver).`;
}

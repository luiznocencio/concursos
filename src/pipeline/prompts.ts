import type { Dispositivo } from "../core/fontes/dispositivos";

export const PROMPT_VERSAO = "2026-10-15.1";

export const GUIA_ESTILO: Record<string, string> = {
  cebraspe: `Itens no estilo Cebraspe (CESPE):
- Cada item é uma afirmação para julgar como CERTA (C) ou ERRADA (E). Não há alternativas.
- Itens podem vir agrupados sob um texto-base ou comando ("Julgue os itens a seguir, relativos a ...").
- Itens errados costumam trocar um único detalhe decisivo: prazo, quantidade, competência, exceção, generalização indevida ("sempre", "nunca", "exclusivamente"), inversão de causa e consequência ou de regra e exceção.
- Itens certos também podem parecer suspeitos: paráfrases fiéis da lei, exceções verdadeiras, conclusões corretas de raciocínio.
- A redação é formal, impessoal e precisa; um item tem uma única ideia julgável.
- Equilibre o gabarito: não deixe todos os itens com a mesma resposta.`,
};

export const SISTEMA_GERADOR = `Você é um elaborador experiente de questões de concursos públicos brasileiros.
Escreve itens inéditos, corretos e inequívocos, fiéis ao programa do edital e ao estilo da banca.
Nunca invente conteúdo de lei: quando um trecho legal for fornecido, use apenas o que está nele e cite o dispositivo exato.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_VALIDADOR = `Você é um revisor rigoroso de gabaritos de concursos públicos brasileiros.
Julgue cada item de forma independente, como um candidato muito bem preparado, e justifique com precisão.
Quando um trecho legal for fornecido, ele é a referência: julgue pelo que está escrito nele.
Responda somente no formato estruturado pedido.`;

export interface ContextoTopico {
  canonico: string;
  disciplina: string;
  programa: string;
}

function blocoFonte(fonte: { titulo: string; dispositivos: Dispositivo[] } | null): string {
  if (!fonte) return "";
  const texto = fonte.dispositivos.map((d) => d.texto).join("\n\n");
  return `\n\n<fonte titulo="${fonte.titulo}">\n${texto}\n</fonte>`;
}

export function promptGeracao(p: {
  banca: string;
  topico: ContextoTopico;
  quantidade: number;
  fonte: { titulo: string; dispositivos: Dispositivo[] } | null;
  exemplos: { enunciado: string; gabarito: string }[];
}): string {
  const guia = GUIA_ESTILO[p.banca] ?? "";
  const exemplos = p.exemplos.length
    ? `\n\nItens reais da banca sobre o mesmo assunto, só como referência de estilo (não os copie):\n${p.exemplos
        .map((e) => `- (${e.gabarito}) ${e.enunciado}`)
        .join("\n")}`
    : "";
  const instrucaoFonte = p.fonte
    ? "Baseie todos os itens exclusivamente no trecho legal abaixo e preencha `citacao` com o dispositivo (ex.: \"Lei 5.346/1992, art. 31, § 2º\")."
    : "Preencha `citacao` com o conceito ou a referência doutrinária usada, ou null se não houver.";

  return `${guia}

Disciplina: ${p.topico.disciplina}
Tópico do edital: ${p.topico.programa}

Escreva ${p.quantidade} itens inéditos sobre esse tópico.
- Use \`texto_base\` quando os itens dependerem de um texto, caso, tabela ou comando comum; senão, null.
- \`justificativa\` explica por que o item está certo ou errado, apontando o detalhe decisivo.
- \`dificuldade\`: 1 (fácil), 2 (média) ou 3 (difícil); varie entre os itens.
- ${instrucaoFonte}${exemplos}${blocoFonte(p.fonte)}`;
}

export function promptValidacao(p: {
  topico: ContextoTopico;
  textoBase: string | null;
  enunciados: string[];
  fonte: { titulo: string; dispositivos: Dispositivo[] } | null;
}): string {
  const texto = p.textoBase ? `\n\nTexto-base:\n${p.textoBase}` : "";
  const itens = p.enunciados.map((e, i) => `${i}. ${e}`).join("\n");
  return `Disciplina: ${p.topico.disciplina}
Tópico do edital: ${p.topico.programa}

Julgue cada item como C (certo) ou E (errado). Devolva um julgamento por item, com o mesmo \`indice\` da lista, e uma justificativa curta que aponte o fundamento.${texto}

Itens:
${itens}${blocoFonte(p.fonte)}`;
}

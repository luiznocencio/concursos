import {
  analisarDuvidas,
  calcularResultado,
  resultadoDaResposta,
  situacao,
  type EntradaProva,
  type ResultadoResposta,
} from "@/core";
import type { EstruturaCargo } from "./estrutura";
import type { ConfigSessao, Marcacao, RespostaGravada, ResultadoCompleto, ResumoTreino } from "./tipos";

export function marcacaoParaCore(m: Marcacao): string | null {
  return m === "branco" ? null : m;
}

export function resultadoDe(resposta: Marcacao, duvida: boolean, gabarito: string): ResultadoResposta {
  return resultadoDaResposta(situacao({ marcacao: marcacaoParaCore(resposta), gabarito }), duvida);
}

export function resumoTreino(respostas: RespostaGravada[], gabaritos: Map<string, string>): ResumoTreino {
  const resumo: ResumoTreino = { tipo: "treino", certos: 0, errados: 0, brancos: 0, comDuvida: 0 };
  for (const r of respostas) {
    const res = resultadoDe(r.resposta, r.duvida, gabaritos.get(r.itemId) ?? "");
    if (res === "branco") resumo.brancos++;
    else if (res === "errado") resumo.errados++;
    else resumo.certos++;
    if (r.duvida) resumo.comDuvida++;
  }
  return resumo;
}

type ConfigCompleto = Extract<ConfigSessao, { tipo: "completo" }>;

// Corrige o simulado completo com as regras do edital (np = 0). Item sem resposta conta como branco.
export function resultadoCompleto(
  estrutura: EstruturaCargo,
  config: ConfigCompleto,
  gabaritos: Map<string, string>,
  respostas: RespostaGravada[],
): ResultadoCompleto {
  const porItem = new Map(respostas.map((r) => [r.itemId, r]));
  const marcada = (id: string) => porItem.get(id) ?? { itemId: id, resposta: "branco" as const, duvida: false };

  const entradas: EntradaProva[] = config.provas.map((p) => {
    const prova = estrutura.provas.find((x) => x.slug === p.slug);
    if (!prova) throw new Error(`Prova ${p.slug} não pertence ao cargo`);
    return {
      slug: p.slug,
      regra: prova.regra,
      corte: prova.corte,
      respostas: p.itens.map((id) => ({ marcacao: marcacaoParaCore(marcada(id).resposta), gabarito: gabaritos.get(id) ?? "" })),
    };
  });
  const conjunto =
    estrutura.corteConjunto && estrutura.corteConjunto.provas.every((s) => config.provas.some((p) => p.slug === s))
      ? estrutura.corteConjunto.corte
      : undefined;
  const r = calcularResultado(entradas, conjunto);

  const porDisciplina = new Map<string, { certos: number; errados: number; brancos: number }>();
  const comDuvida = [];
  for (const p of config.provas) {
    for (const id of p.itens) {
      const disciplina = config.disciplinaDoItem[id] ?? "outras";
      const m = marcada(id);
      const gabarito = gabaritos.get(id) ?? "";
      const s = situacao({ marcacao: marcacaoParaCore(m.resposta), gabarito });
      const acc = porDisciplina.get(disciplina) ?? { certos: 0, errados: 0, brancos: 0 };
      acc[s === "certo" ? "certos" : s === "errado" ? "errados" : "brancos"]++;
      porDisciplina.set(disciplina, acc);
      comDuvida.push({ disciplina, duvida: m.duvida, marcacao: marcacaoParaCore(m.resposta), gabarito });
    }
  }
  const nome = (d: string) => estrutura.disciplinas[d] ?? d;

  return {
    tipo: "completo",
    provas: r.provas.map((p) => {
      const prova = estrutura.provas.find((x) => x.slug === p.slug)!;
      return { ...p, nome: prova.nome, nItens: config.provas.find((x) => x.slug === p.slug)!.itens.length };
    }),
    total: r.total,
    corteConjunto: r.corteConjunto,
    aprovado: r.aprovado,
    motivos: r.motivos,
    porDisciplina: [...porDisciplina.entries()].map(([disciplina, c]) => ({ disciplina, nome: nome(disciplina), ...c })),
    duvidas: analisarDuvidas(comDuvida).map((a) => ({ ...a, nome: nome(a.disciplina) })),
  };
}

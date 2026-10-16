import { describe, expect, it } from "vitest";
import type { ItemCandidato } from "@/core";
import { criarRepositorioFalso } from "./__fixtures__/repositorio-falso";
import type { EstruturaCargo } from "./estrutura";
import {
  encerrarTreino,
  entregarSimulado,
  ErroEstudo,
  iniciarEstudarAgora,
  iniciarRevisao,
  iniciarSimulado,
  iniciarTreinoTopico,
  marcarNoSimulado,
  pedirGeracaoDosFaltantes,
  responderItem,
} from "./servico";
import type { ResultadoCompleto } from "./tipos";

const AGORA = new Date("2026-10-15T12:00:00Z");
const DIA = 86_400_000;

const estrutura: EstruturaCargo = {
  cargo: { id: "cargo", slug: "cfo", nome: "CFO", duracaoMin: 270 },
  concurso: { id: "concurso", slug: "c1", nome: "Concurso", dataProva: "2027-01-24" },
  provas: [
    {
      id: "p1",
      slug: "p1",
      nome: "P1",
      nItens: 3,
      regra: { regra: "certo_errado_penalidade" },
      corte: { regra: "minimo_absoluto", valor: 1 },
      demandas: [
        { disciplina: "lp", canonicos: ["lp/a", "lp/b"], quantidade: 2 },
        { disciplina: "mat", canonicos: ["mat/a"], quantidade: 1 },
      ],
    },
  ],
  temDiscursiva: true,
  topicosAlvo: [
    { disciplina: "lp", codigo: "1", titulo: "A", canonico: "lp/a", chave: "lp:1", peso: 1 },
    { disciplina: "lp", codigo: "2", titulo: "B", canonico: "lp/b", chave: "lp:2", peso: 1 },
    { disciplina: "mat", codigo: "1", titulo: "A", canonico: "mat/a", chave: "mat:1", peso: 1 },
  ],
  disciplinas: { lp: "Português", mat: "Matemática" },
};

const itens = (canonico: string, n: number): ItemCandidato[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${canonico}#${i}`, textoBaseId: null, canonicos: [canonico], visto: false }));

describe("iniciarEstudarAgora", () => {
  it("cria uma sessão de treino com os itens do motor de foco e pede geração para tópicos com poucos itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: [...itens("lp/a", 12), ...itens("mat/a", 3)] });
    const r = await iniciarEstudarAgora(repo, "cargo", AGORA);
    expect(r).toMatchObject({ tipo: "criada", pedidosGeracao: 2 });
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s).toMatchObject({ modo: "treino", config: { tipo: "estudar_agora" } });
    expect(s.itens).toHaveLength(15);
    expect(estado.pedidos).toEqual([["lp/b", "mat/a"]]);
  });

  it("não falha quando a fila de geração não está disponível", async () => {
    const { repo } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 2), falharGeracao: true });
    expect(await iniciarEstudarAgora(repo, "cargo", AGORA)).toMatchObject({ tipo: "criada", pedidosGeracao: 0 });
  });

  it("avisa quando ainda não há itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura });
    expect(await iniciarEstudarAgora(repo, "cargo", AGORA)).toEqual({ tipo: "sem_itens", pedidosGeracao: 3 });
    expect(estado.sessoes.size).toBe(0);
  });
});

describe("iniciarTreinoTopico e iniciarRevisao", () => {
  it("treina só os tópicos escolhidos", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: [...itens("lp/a", 5), ...itens("mat/a", 5)] });
    const r = await iniciarTreinoTopico(repo, "cargo", ["mat/a"], 4);
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s.itens).toEqual(["mat/a#0", "mat/a#1", "mat/a#2", "mat/a#3"]);
    expect(s.config).toEqual({ tipo: "topico", canonicos: ["mat/a"] });
  });

  it("revisa os itens vencidos que ainda são do cargo", async () => {
    const { repo, estado } = criarRepositorioFalso({
      estrutura,
      candidatos: itens("lp/a", 3),
      vencidas: ["lp/a#2", "outro-cargo", "lp/a#0"],
    });
    const r = await iniciarRevisao(repo, "cargo", AGORA);
    expect(estado.sessoes.get((r as { sessaoId: string }).sessaoId)!.itens).toEqual(["lp/a#2", "lp/a#0"]);
    const vazio = criarRepositorioFalso({ estrutura });
    expect(await iniciarRevisao(vazio.repo, "cargo", AGORA)).toEqual({ tipo: "sem_itens", pedidosGeracao: 0 });
  });
});

describe("responderItem", () => {
  async function sessaoDeTreino() {
    const f = criarRepositorioFalso({ estrutura, gabaritos: { a: "C", b: "E" } });
    const id = await f.repo.criarSessao("cargo", "treino", { tipo: "estudar_agora" }, ["a", "b"]);
    return { ...f, id };
  }

  it("corrige, agenda a revisão de um erro e não aceita trocar a resposta", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    const c = await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "E", duvida: false, tempoMs: 5000, agora: AGORA });
    expect(c).toMatchObject({ gabarito: "C", resultado: "errado", justificativa: "porque a", provaOrigem: null, concluida: false });
    expect(estado.revisao.get("a")).toEqual({ etapa: 1, proximaEm: new Date(AGORA.getTime() + DIA) });

    const outra = await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: 1, agora: AGORA });
    expect(outra).toMatchObject({ resposta: "E", resultado: "errado" });
    expect(estado.revisao.get("a")!.etapa).toBe(1);
  });

  it("diz de que prova veio uma questão real", async () => {
    const f = criarRepositorioFalso({ estrutura, gabaritos: { a: "C", b: "E" }, provasOrigem: { b: "CEBRASPE 2021 · PC-AL" } });
    const id = await f.repo.criarSessao("cargo", "treino", { tipo: "estudar_agora" }, ["a", "b"]);
    const real = await responderItem(f.repo, { sessaoId: id, itemId: "b", resposta: "E", duvida: false, tempoMs: null, agora: AGORA });
    expect(real.provaOrigem).toBe("CEBRASPE 2021 · PC-AL");
    const ia = await responderItem(f.repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA });
    expect(ia.provaOrigem).toBeNull();
  });

  it("encerra a sessão com o resumo quando o último item é respondido", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: true, tempoMs: null, agora: AGORA });
    const c = await responderItem(repo, { sessaoId: id, itemId: "b", resposta: "branco", duvida: false, tempoMs: null, agora: AGORA });
    expect(c.concluida).toBe(true);
    expect(estado.resultados.get(id)).toEqual({ tipo: "treino", certos: 1, errados: 0, brancos: 1, comDuvida: 1 });
    await expect(
      responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toMatchObject({ codigo: "sessao_encerrada" });
  });

  it("recusa item de fora da sessão e sessão de simulado completo", async () => {
    const { repo, id } = await sessaoDeTreino();
    await expect(
      responderItem(repo, { sessaoId: id, itemId: "z", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toBeInstanceOf(ErroEstudo);
    const completo = await repo.criarSessao("cargo", "completo", { tipo: "completo", duracaoMin: 10, provas: [], disciplinaDoItem: {} }, ["a"]);
    await expect(
      responderItem(repo, { sessaoId: completo, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toMatchObject({ codigo: "modo_invalido" });
  });

  it("encerrarTreino fecha a sessão só com o que foi respondido", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    await responderItem(repo, { sessaoId: id, itemId: "b", resposta: "E", duvida: false, tempoMs: null, agora: AGORA });
    await encerrarTreino(repo, id, AGORA);
    expect(estado.resultados.get(id)).toEqual({ tipo: "treino", certos: 1, errados: 0, brancos: 0, comDuvida: 0 });
  });
});

describe("simulado completo", () => {
  const candidatos = [...itens("lp/a", 2), ...itens("lp/b", 2), ...itens("mat/a", 2)];

  it("segue a distribuição da prova e desconta 1h da discursiva", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos });
    const r = await iniciarSimulado(repo, "cargo");
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s.modo).toBe("completo");
    expect(s.itens).toEqual(["lp/a#0", "lp/b#0", "mat/a#0"]);
    expect(s.config).toEqual({
      tipo: "completo",
      duracaoMin: 210,
      provas: [{ slug: "p1", itens: ["lp/a#0", "lp/b#0", "mat/a#0"] }],
      disciplinaDoItem: { "lp/a#0": "lp", "lp/b#0": "lp", "mat/a#0": "mat" },
    });
  });

  it("informa o que falta por disciplina sem criar a sessão", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 1) });
    expect(await iniciarSimulado(repo, "cargo")).toEqual({
      tipo: "faltam_itens",
      faltantes: [
        { prova: "p1", disciplina: "lp", nome: "Português", faltam: 1, canonicos: ["lp/a", "lp/b"] },
        { prova: "p1", disciplina: "mat", nome: "Matemática", faltam: 1, canonicos: ["mat/a"] },
      ],
    });
    expect(estado.sessoes.size).toBe(0);
  });

  it("pede geração começando pelos tópicos com menos itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 1) });
    await pedirGeracaoDosFaltantes(repo, "cargo", ["lp/a", "lp/b", "mat/a"]);
    expect(estado.pedidos).toEqual([["lp/b", "mat/a", "lp/a"]]);
  });

  it("aceita troca de marcação dentro do prazo e recusa depois", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos });
    const { sessaoId } = (await iniciarSimulado(repo, "cargo")) as { sessaoId: string };
    const inicio = estado.sessoes.get(sessaoId)!.iniciadaEm.getTime();
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "C", duvida: false, agora: new Date(inicio) });
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "E", duvida: true, agora: new Date(inicio + 60_000) });
    expect(estado.respostas.get(sessaoId)).toEqual([{ itemId: "lp/a#0", resposta: "E", duvida: true }]);
    await expect(
      marcarNoSimulado(repo, { sessaoId, itemId: "lp/b#0", resposta: "C", duvida: false, agora: new Date(inicio + 212 * 60_000) }),
    ).rejects.toMatchObject({ codigo: "tempo_esgotado" });
  });

  it("entrega: corrige pelas regras do edital, agenda revisões e é idempotente", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos, gabaritos: { "lp/a#0": "C", "lp/b#0": "E", "mat/a#0": "C" } });
    const { sessaoId } = (await iniciarSimulado(repo, "cargo")) as { sessaoId: string };
    const agora = estado.sessoes.get(sessaoId)!.iniciadaEm;
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "C", duvida: false, agora });
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/b#0", resposta: "C", duvida: true, agora });

    const r = (await entregarSimulado(repo, sessaoId, AGORA)) as ResultadoCompleto;
    expect(r.provas[0]).toMatchObject({ slug: "p1", nome: "P1", nItens: 3, nota: 0, certos: 1, errados: 1, brancos: 1, corte: 1, aprovada: false });
    expect(r.aprovado).toBe(false);
    expect(r.porDisciplina).toEqual([
      { disciplina: "lp", nome: "Português", certos: 1, errados: 1, brancos: 0 },
      { disciplina: "mat", nome: "Matemática", certos: 0, errados: 0, brancos: 1 },
    ]);
    expect(r.duvidas).toEqual([
      { disciplina: "lp", nome: "Português", itens: 1, certos: 0, errados: 1, saldo: -1, recomendacao: "dados_insuficientes" },
    ]);
    expect([...estado.revisao.keys()].sort()).toEqual(["lp/b#0", "mat/a#0"]);
    expect(estado.sessoes.get(sessaoId)!.finalizadaEm).toEqual(AGORA);

    estado.revisao.clear();
    expect(await entregarSimulado(repo, sessaoId, AGORA)).toEqual(r);
    expect(estado.revisao.size).toBe(0);
  });
});

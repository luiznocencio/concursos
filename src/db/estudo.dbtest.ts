import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;
let cargo: string;
const item: Record<string, string> = {};

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query("insert into auth.users (id, email) values ($1, 'ana@x.com'), ($2, 'bruno@x.com')", [ANA, BRUNO]);
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.concursos (slug, nome, banca_id, data_prova)
      values ('c1', 'Concurso 1', (select id from public.bancas), '2027-01-24');
    insert into public.cargos (concurso_id, slug, nome, duracao_min)
      values ((select id from public.concursos), 'cfo', 'CFO', 270);
    insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, regra_pontuacao, distribuicao)
      values ((select id from public.concursos), 'p1', 'P1', 'objetiva', 'certo_errado', 2,
              '{"regra":"certo_errado_penalidade"}', '{"estimada":true,"disciplinas":{"lp":2}}');
    insert into public.cargo_provas (cargo_id, prova_id, ordem)
      values ((select id from public.cargos), (select id from public.provas), 1);
    insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos), 'lp', 'Português');
    insert into public.prova_disciplinas (prova_id, disciplina_id, ordem)
      values ((select id from public.provas), (select id from public.disciplinas), 1);
    insert into public.topicos_canonicos (slug, titulo)
      values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência'), ('fisica/optica', 'Óptica');
    insert into public.topicos (disciplina_id, codigo, titulo, canonico_id, ordem)
      select (select id from public.disciplinas), v.codigo, v.titulo, tc.id, v.ordem
      from (values ('1', 'Crase', 'portugues/crase', 1), ('2', 'Regência', 'portugues/regencia', 2)) as v(codigo, titulo, slug, ordem)
      join public.topicos_canonicos tc on tc.slug = v.slug;
  `);
  const novo = async (nome: string, status: string, canonicos: string[]) => {
    item[nome] = await umValor<string>(
      `insert into public.itens (banca_id, formato, enunciado, gabarito, origem, status, hash_normalizado)
       values ((select id from public.bancas), 'certo_errado', $1, 'C', 'ia', $2, $1) returning id`,
      [nome, status],
    );
    for (const c of canonicos) {
      await client.query(
        "insert into public.item_topicos (item_id, topico_canonico_id) select $1, id from public.topicos_canonicos where slug = $2",
        [item[nome], c],
      );
    }
  };
  await novo("crase", "aprovado", ["portugues/crase"]);
  await novo("regencia", "aprovado", ["portugues/regencia", "portugues/crase"]);
  await novo("revisao", "revisao", ["portugues/crase"]);
  await novo("optica", "aprovado", ["fisica/optica"]);
  cargo = await umValor<string>("select id from public.cargos");
});

afterAll(async () => {
  await destruir();
});

async function criarSessao(usuario: string, modo: string, itens: string[]): Promise<string> {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario]);
  await client.query("set role authenticated");
  try {
    return await umValor<string>("select public.simulado_criar($1, $2, '{}', $3::uuid[])", [cargo, modo, itens]);
  } finally {
    await client.query("reset role");
  }
}

async function responder(usuario: string, simulado: string, itemId: string, resposta: string, duvida = false) {
  await client.query(
    "insert into public.respostas (simulado_id, item_id, user_id, resposta, duvida) values ($1, $2, $3, $4, $5)",
    [simulado, itemId, usuario, resposta, duvida],
  );
}

describe("estudo_candidatos", () => {
  it("lista só itens aprovados de tópicos do cargo, com os canônicos e se a pessoa já viu", async () => {
    const sessao = await criarSessao(ANA, "treino", [item.crase]);
    await responder(ANA, sessao, item.crase, "C");
    const candidatos = await comoUsuario(client, ANA, () => umValor<unknown[]>("select public.estudo_candidatos($1)", [cargo]));
    expect(candidatos).toEqual([
      { id: item.crase, textoBaseId: null, canonicos: ["portugues/crase"], visto: true },
      { id: item.regencia, textoBaseId: null, canonicos: ["portugues/crase", "portugues/regencia"], visto: false },
    ]);
    const paraBruno = await comoUsuario(client, BRUNO, () => umValor<{ visto: boolean }[]>("select public.estudo_candidatos($1)", [cargo]));
    expect(paraBruno.map((c) => c.visto)).toEqual([false, false]);
  });
});

describe("estudo_historico", () => {
  it("devolve uma linha por canônico com o resultado, sem simulado completo em andamento", async () => {
    const treino = await criarSessao(BRUNO, "treino", [item.crase, item.regencia]);
    await responder(BRUNO, treino, item.crase, "E");
    await responder(BRUNO, treino, item.regencia, "C", true);
    const completo = await criarSessao(BRUNO, "completo", [item.crase]);
    await responder(BRUNO, completo, item.crase, "C");

    const historico = await comoUsuario(client, BRUNO, () =>
      umValor<{ canonico: string; resultado: string }[]>("select public.estudo_historico($1)", [cargo]),
    );
    expect(historico.map(({ canonico, resultado }) => `${canonico}:${resultado}`).sort()).toEqual([
      "portugues/crase:certo_duvida", "portugues/crase:errado", "portugues/regencia:certo_duvida",
    ]);

    await client.query("update public.simulados set finalizado_em = now() where id = $1", [completo]);
    const depois = await comoUsuario(client, BRUNO, () => umValor<unknown[]>("select public.estudo_historico($1)", [cargo]));
    expect(depois).toHaveLength(4);
  });
});

describe("simulado_criar", () => {
  it("cria a sessão do usuário com os itens na ordem dada", async () => {
    const id = await criarSessao(ANA, "revisao", [item.regencia, item.crase]);
    const r = await client.query("select item_id, ordem, user_id from public.simulado_itens where simulado_id = $1 order by ordem", [id]);
    expect(r.rows).toEqual([
      { item_id: item.regencia, ordem: 1, user_id: ANA },
      { item_id: item.crase, ordem: 2, user_id: ANA },
    ]);
    expect(await umValor<string>("select user_id from public.simulados where id = $1", [id])).toBe(ANA);
  });

  it("recusa sessão vazia", async () => {
    await expect(criarSessao(ANA, "treino", [])).rejects.toThrow(/sem itens/);
  });
});

describe("itens_marcar_suspeito", () => {
  it("só aceita quem respondeu o item e guarda o motivo", async () => {
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.itens_marcar_suspeito($1, 'x')", [item.optica])),
    ).rejects.toThrow(/só quem respondeu/);

    // comoUsuario desfaz a transação; a marcação de verdade roda fora dela
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [ANA]);
    await client.query("select public.itens_marcar_suspeito($1, 'gabarito errado')", [item.crase]);
    const r = await client.query("select status, validacao->'denuncias'->0->>'motivo' as motivo from public.itens where id = $1", [item.crase]);
    expect(r.rows[0]).toEqual({ status: "suspeito", motivo: "gabarito errado" });
  });
});

describe("estudo_pedir_geracao", () => {
  it("enfileira no máximo 3 pedidos em aberto por usuário e não duplica tópico já na fila", async () => {
    await client.query("delete from public.jobs");
    await client.query(
      "insert into public.jobs (tipo, payload) values ('gerar_itens', '{\"concurso\":\"c1\",\"canonico\":\"a/b\",\"quantidade\":5}')",
    );
    const novos = await comoUsuario(client, ANA, () =>
      umValor<number>("select public.estudo_pedir_geracao('c1', array['a/b', 'a/c', 'a/d', 'a/e', 'a/f'])"),
    );
    expect(novos).toBe(3);
    // comoUsuario desfaz a transação; repete fora dela para conferir o limite acumulado
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [ANA]);
    expect(await umValor<number>("select public.estudo_pedir_geracao('c1', array['a/c', 'a/d'])")).toBe(2);
    expect(await umValor<number>("select public.estudo_pedir_geracao('c1', array['a/e', 'a/f'])")).toBe(1);
    const r = await client.query("select payload->>'canonico' as c, payload->>'pedido_por' as por from public.jobs order by criado_em, payload->>'canonico'");
    expect(r.rows.map((x) => x.c)).toEqual(["a/b", "a/c", "a/d", "a/e"]);
    expect(r.rows.slice(1).every((x) => x.por === ANA)).toBe(true);
  });

  it("não pode ser chamada por anônimo", async () => {
    await client.query("select set_config('request.jwt.claim.sub', '', false)");
    await expect(client.query("select public.estudo_pedir_geracao('c1', array['a/z'])")).rejects.toThrow(/não autenticado/);
  });
});

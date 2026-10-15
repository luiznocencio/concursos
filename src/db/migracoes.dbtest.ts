import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;

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
      values ('c1', 'Concurso 1', (select id from public.bancas where slug = 'cebraspe'), '2027-01-24');
    insert into public.cargos (concurso_id, slug, nome, duracao_min)
      values ((select id from public.concursos where slug = 'c1'), 'cargo', 'Cargo', 270);
    insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas where slug = 'cebraspe'), 'certo_errado', 'Item 1', 'C', 'ia', 'h1');
  `);
});

afterAll(async () => {
  await destruir();
});

describe("schema", () => {
  it("cria todas as tabelas da spec", async () => {
    const r = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(r.rows.map((x) => x.table_name)).toEqual([
      "ai_usage", "bancas", "cargo_provas", "cargos", "concursos", "disciplinas", "fonte_dispositivos",
      "fontes", "item_topicos", "itens", "jobs", "prova_disciplinas", "provas", "respostas",
      "revisao_espacada", "seed_partes", "simulado_itens", "simulados", "textos_base", "topicos", "topicos_canonicos",
    ]);
  });

  it("habilita RLS em todas as tabelas", async () => {
    expect(await umValor<number>(
      "select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity",
    )).toBe(0);
  });

  it("rejeita gabarito incompatível com o formato", async () => {
    await expect(client.query(`
      insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas limit 1), 'certo_errado', 'x', 'A', 'ia', 'h-x')
    `)).rejects.toThrow(/itens_gabarito_formato/);
  });

  it("rejeita item duplicado pelo hash normalizado", async () => {
    await expect(client.query(`
      insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas limit 1), 'certo_errado', 'Item 1 de novo', 'E', 'ia', 'h1')
    `)).rejects.toThrow(/duplicate key/);
  });

  it("rejeita slug canônico mal formatado", async () => {
    await expect(client.query("insert into public.topicos_canonicos (slug, titulo) values ('Sem Barra', 'x')"))
      .rejects.toThrow(/topicos_canonicos_slug_check/);
  });

  it("deriva a área do slug canônico", async () => {
    await client.query("insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase')");
    expect(await umValor<string>("select area from public.topicos_canonicos where slug = 'portugues/crase'")).toBe("portugues");
  });
});

describe("RLS", () => {
  it("usuário autenticado lê conteúdo, mas não escreve", async () => {
    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.itens")).toBe(1);
    });
    await expect(
      comoUsuario(client, ANA, () => client.query("update public.itens set gabarito = 'E'")),
    ).resolves.toMatchObject({ rowCount: 0 });
    await expect(
      comoUsuario(client, ANA, () => client.query("insert into public.bancas (slug, nome) values ('x', 'x')")),
    ).rejects.toThrow(/row-level security/);
  });

  it("anônimo não lê conteúdo", async () => {
    await client.query("begin");
    try {
      await client.query("set local role anon");
      expect(await umValor<number>("select count(*)::int from public.itens")).toBe(0);
    } finally {
      await client.query("rollback");
    }
  });

  it("cada usuário só vê os próprios simulados e respostas", async () => {
    const cargo = await umValor<string>("select id from public.cargos limit 1");
    const item = await umValor<string>("select id from public.itens limit 1");
    await client.query(
      "insert into public.simulados (id, user_id, cargo_id, modo) values ('10000000-0000-0000-0000-000000000001', $1, $2, 'treino')",
      [BRUNO, cargo],
    );
    await client.query(
      "insert into public.respostas (simulado_id, item_id, user_id, resposta) values ('10000000-0000-0000-0000-000000000001', $1, $2, 'C')",
      [item, BRUNO],
    );

    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.simulados")).toBe(0);
      expect(await umValor<number>("select count(*)::int from public.respostas")).toBe(0);
    });
    await comoUsuario(client, BRUNO, async () => {
      expect(await umValor<number>("select count(*)::int from public.simulados")).toBe(1);
      expect(await umValor<number>("select count(*)::int from public.respostas")).toBe(1);
    });
  });

  it("usuário cria simulado próprio com user_id padrão e não consegue criar para outro", async () => {
    const cargo = await umValor<string>("select id from public.cargos limit 1");
    await comoUsuario(client, ANA, async () => {
      const r = await client.query("insert into public.simulados (cargo_id, modo) values ($1, 'treino') returning user_id", [cargo]);
      expect(r.rows[0].user_id).toBe(ANA);
    });
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.simulados (user_id, cargo_id, modo) values ($1, $2, 'treino')", [BRUNO, cargo]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("jobs e ai_usage ficam invisíveis para o usuário", async () => {
    await client.query("insert into public.jobs (tipo, payload) values ('gerar_itens', '{}')");
    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.jobs")).toBe(0);
      expect(await umValor<number>("select count(*)::int from public.ai_usage")).toBe(0);
    });
  });
});

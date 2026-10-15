import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

let client: Client;
let destruir: () => Promise<void>;

async function valor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência');
    insert into public.fontes (slug, tipo, titulo, canonicos) values ('lei-x', 'lei', 'Lei X', array['legislacao/lei-x']);
  `);
});

afterAll(async () => {
  await destruir();
});

beforeEach(async () => {
  await client.query("delete from public.jobs");
});

describe("fila de jobs", () => {
  it("enfileira uma geração e não duplica enquanto ela estiver pendente", async () => {
    const a = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const b = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const c = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/regencia', 5)");
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    expect(await valor<string>("select payload->>'quantidade' from public.jobs where id = $1", [a])).toBe("5");
  });

  it("reserva o job mais antigo, marca como processando e conta a tentativa", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const r = await client.query("select * from public.jobs_reservar()");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id, status: "processando", tentativas: 1 });
    expect((await client.query("select * from public.jobs_reservar()")).rows).toHaveLength(0);
  });

  it("devolve à fila com espera depois de uma falha e marca como falhou no limite", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_falhar($1, 'erro 1', 2)", [id]);
    let job = (await client.query("select status, erro, executar_apos > now() as adiado from public.jobs where id = $1", [id])).rows[0];
    expect(job).toEqual({ status: "pendente", erro: "erro 1", adiado: true });

    await client.query("update public.jobs set executar_apos = now() where id = $1", [id]);
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_falhar($1, 'erro 2', 2)", [id]);
    job = (await client.query("select status, erro from public.jobs where id = $1", [id])).rows[0];
    expect(job).toEqual({ status: "falhou", erro: "erro 2" });
  });

  it("conclui o job", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_concluir($1)", [id]);
    expect(await valor<string>("select status from public.jobs where id = $1", [id])).toBe("concluido");
  });
});

describe("itens_registrar_lote", () => {
  const lote = (hashes: string[]) => ({
    banca: "cebraspe",
    formato: "certo_errado",
    origem: "ia",
    texto_base: "Texto de apoio.",
    fonte: "lei-x",
    itens: hashes.map((h, i) => ({
      enunciado: `Item ${h}`,
      gabarito: i % 2 ? "E" : "C",
      justificativa: "Porque sim.",
      citacao: "art. 1",
      dificuldade: 2,
      hash: h,
      status: "aprovado",
      validacao: { concordancia: true },
      canonicos: ["portugues/crase"],
    })),
  });

  it("grava itens, texto-base, fonte e tópicos, ignorando hashes repetidos", async () => {
    expect(await valor<number>("select public.itens_registrar_lote($1)", [lote(["h1", "h2"])])).toBe(2);
    expect(await valor<number>("select public.itens_registrar_lote($1)", [lote(["h2", "h3"])])).toBe(1);
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(3);
    expect(await valor<number>("select count(*)::int from public.item_topicos")).toBe(3);
    expect(await valor<number>("select count(*)::int from public.itens where texto_base_id is not null and fonte_id is not null")).toBe(3);
  });

  it("recusa banca desconhecida", async () => {
    await expect(client.query("select public.itens_registrar_lote($1)", [{ ...lote(["h9"]), banca: "x" }])).rejects.toThrow(
      /banca desconhecida: x/,
    );
  });
});

describe("uso de IA e permissões", () => {
  it("registra uso com job opcional", async () => {
    await client.query("select public.ia_registrar_uso($1)", [
      { provedor: "anthropic", modelo: "m", finalidade: "gerar", tokens_entrada: 10, tokens_saida: 5, custo_usd: 0.001, job_id: null },
    ]);
    expect(await valor<string>("select custo_usd::text from public.ai_usage")).toBe("0.001000");
  });

  it("usuários da API não executam as funções do pipeline", async () => {
    await expect(
      comoUsuario(client, "00000000-0000-0000-0000-00000000000a", () => client.query("select * from public.jobs_reservar()")),
    ).rejects.toThrow(/permission denied for function jobs_reservar/);
  });
});

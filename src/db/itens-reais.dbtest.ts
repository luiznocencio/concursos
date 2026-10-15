import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

let client: Client;
let destruir: () => Promise<void>;

async function valor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

const item = (numero: number, hash: string, canonicos = ["portugues/crase"], gabarito = "C") => ({
  numero,
  enunciado: `Item ${numero}`,
  gabarito,
  hash,
  canonicos,
});

const prova = (grupos: { texto_base: string | null; itens: ReturnType<typeof item>[] }[]) => ({
  banca: "cebraspe",
  prova_origem: "CBM-AL 2021 Soldado",
  importado_por: "ana@x.com",
  grupos,
});

const importar = (p: unknown) => valor<{ gravados: number; duplicados: number[] }>("select public.itens_importar_reais($1)", [p]);

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência');
  `);
});

afterAll(async () => {
  await destruir();
});

beforeEach(async () => {
  await client.query("delete from public.item_topicos; delete from public.itens; delete from public.textos_base;");
});

describe("itens_importar_reais", () => {
  it("grava texto-base e itens como reais aprovados, com prova de origem, gabarito e tópicos", async () => {
    const r = await importar(
      prova([
        { texto_base: "Texto CB1A1\nJulgue os itens.", itens: [item(1, "h1"), item(2, "h2", ["portugues/crase", "portugues/regencia"], "E")] },
        { texto_base: null, itens: [item(3, "h3", ["portugues/regencia"])] },
      ]),
    );
    expect(r).toEqual({ gravados: 3, duplicados: [] });

    const itens = await client.query(
      `select i.enunciado, i.gabarito, i.origem, i.status, i.prova_origem, i.formato, t.conteudo, t.origem as origem_texto,
              i.validacao->'importacao'->>'numero' as numero, i.validacao->'importacao'->>'por' as por
       from public.itens i left join public.textos_base t on t.id = i.texto_base_id order by i.enunciado`,
    );
    expect(itens.rows).toEqual([
      { enunciado: "Item 1", gabarito: "C", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: "Texto CB1A1\nJulgue os itens.", origem_texto: "real", numero: "1", por: "ana@x.com" },
      { enunciado: "Item 2", gabarito: "E", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: "Texto CB1A1\nJulgue os itens.", origem_texto: "real", numero: "2", por: "ana@x.com" },
      { enunciado: "Item 3", gabarito: "C", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: null, origem_texto: null, numero: "3", por: "ana@x.com" },
    ]);
    expect(await valor<number>("select count(*)::int from public.item_topicos")).toBe(4);
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(1);
  });

  it("conta duplicados pelo hash e não grava texto-base de grupo sem item novo", async () => {
    await importar(prova([{ texto_base: "Texto A", itens: [item(1, "h1"), item(2, "h2")] }]));
    const r = await importar(
      prova([
        { texto_base: "Texto A", itens: [item(1, "h1"), item(2, "h2")] },
        { texto_base: "Texto B", itens: [item(3, "h2"), item(4, "h4")] },
      ]),
    );
    expect(r).toEqual({ gravados: 1, duplicados: [1, 2, 3] });
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(2);
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(3);
  });

  it("não grava nada quando um tópico é desconhecido", async () => {
    await expect(importar(prova([{ texto_base: "Texto", itens: [item(1, "h1"), item(2, "h2", ["portugues/inexistente"])] }]))).rejects.toThrow(
      /tópico canônico desconhecido: portugues\/inexistente/,
    );
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(0);
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(0);
  });

  it("exige banca conhecida, prova de origem e gabarito Certo/Errado", async () => {
    await expect(importar({ ...prova([]), banca: "x" })).rejects.toThrow(/banca desconhecida: x/);
    await expect(importar({ ...prova([]), prova_origem: "  " })).rejects.toThrow(/prova de origem obrigatória/);
    await expect(importar(prova([{ texto_base: null, itens: [item(1, "h1", ["portugues/crase"], "X")] }]))).rejects.toThrow(
      /itens_gabarito_formato/,
    );
  });

  it("usuários da API não executam a importação", async () => {
    await expect(
      comoUsuario(client, "00000000-0000-0000-0000-00000000000a", () => importar(prova([]))),
    ).rejects.toThrow(/permission denied for function itens_importar_reais/);
  });
});

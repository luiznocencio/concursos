import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { parseEdital } from "../../core/edital/parse";
import type { Topico } from "../../core/edital/schema";
import { editalMini } from "../../core/edital/__fixtures__/mini";
import { comoUsuario, criarBancoDeTeste } from "../testing/banco";
import { sqlDoEdital } from "./edital-sql";

const cbmal = parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"));

function contarNos(topicos: Topico[]): number {
  return topicos.reduce((n, t) => n + 1 + (t.subtopicos ? contarNos(t.subtopicos) : 0), 0);
}

let client: Client;
let destruir: () => Promise<void>;

async function contar(tabela: string): Promise<number> {
  const r = await client.query(`select count(*)::int as n from public.${tabela}`);
  return r.rows[0].n;
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
});

afterAll(async () => {
  await destruir();
});

describe("seed do CBM-AL", () => {
  it("carrega o edital completo", async () => {
    await client.query(sqlDoEdital(cbmal));
    expect(await contar("concursos")).toBe(1);
    expect(await contar("cargos")).toBe(2);
    expect(await contar("provas")).toBe(4);
    expect(await contar("disciplinas")).toBe(17);
    expect(await contar("topicos")).toBe(cbmal.disciplinas.reduce((n, d) => n + contarNos(d.topicos), 0));
    expect(await contar("cargo_provas")).toBe(6);
  });

  it("é idempotente", async () => {
    const antes = await contar("topicos");
    await client.query(sqlDoEdital(cbmal));
    expect(await contar("topicos")).toBe(antes);
    expect(await contar("cargo_provas")).toBe(6);
  });

  it("liga a P1 aos dois cargos e as folhas aos canônicos", async () => {
    const r = await client.query(`
      select count(*)::int as n from public.cargo_provas cp
      join public.provas p on p.id = cp.prova_id where p.slug = 'p1-gerais'`);
    expect(r.rows[0].n).toBe(2);
    const semCanonico = await client.query(`
      select count(*)::int as n from public.topicos t
      where t.canonico_id is null and not exists (select 1 from public.topicos f where f.parent_id = t.id)`);
    expect(semCanonico.rows[0].n).toBe(0);
  });
});

describe("permissões", () => {
  it("usuários da API não executam carregar_edital", async () => {
    await expect(
      comoUsuario(client, "00000000-0000-0000-0000-00000000000a", () => client.query(sqlDoEdital(editalMini()))),
    ).rejects.toThrow(/permission denied for function carregar_edital/);
  });
});

describe("retificação", () => {
  it("remove tópicos que saíram do YAML e atualiza títulos", async () => {
    await client.query(sqlDoEdital(editalMini()));
    const e = editalMini();
    e.disciplinas[1].topicos = [{ codigo: "1", titulo: "Porcentagem e razão", canonico: "matematica/porcentagem" }];
    e.provas[0] = { ...e.provas[0] };
    await client.query(sqlDoEdital(e));
    const r = await client.query(`
      select t.codigo, t.titulo from public.topicos t
      join public.disciplinas d on d.id = t.disciplina_id
      join public.concursos c on c.id = d.concurso_id
      where c.slug = 'mini-2026' and d.slug = 'mat' order by t.ordem`);
    expect(r.rows).toEqual([{ codigo: "1", titulo: "Porcentagem e razão" }]);
  });
});

import { describe, expect, it } from "vitest";
import { editalMini } from "../../core/edital/__fixtures__/mini";
import { sqlDoEdital } from "./edital-sql";

function jsonDoSql(sql: string): unknown {
  const m = sql.match(/^select public\.carregar_edital\('([\s\S]*)'::jsonb\);\n$/);
  if (!m) throw new Error("formato inesperado");
  return JSON.parse(m[1].replaceAll("''", "'"));
}

describe("sqlDoEdital", () => {
  it("chama carregar_edital com o edital inteiro em JSON", () => {
    expect(jsonDoSql(sqlDoEdital(editalMini()))).toEqual(editalMini());
  });

  it("escapa aspas simples", () => {
    const e = editalMini();
    e.disciplinas[0].topicos[0].titulo = "Interpretação d'água";
    const sql = sqlDoEdital(e);
    expect(sql).toContain("Interpretação d''água");
    expect(jsonDoSql(sql)).toEqual(e);
  });
});

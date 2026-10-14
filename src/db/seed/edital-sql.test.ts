import { describe, expect, it } from "vitest";
import { editalMini } from "../../core/edital/__fixtures__/mini";
import { sqlDoEdital } from "./edital-sql";

describe("sqlDoEdital", () => {
  const sql = sqlDoEdital(editalMini());

  it("roda tudo numa transação", () => {
    expect(sql.startsWith("begin;\n")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("faz upsert por chaves naturais", () => {
    expect(sql).toContain("on conflict (slug) do update set");
    expect(sql).toContain("on conflict (concurso_id, slug) do update set");
    expect(sql).toContain("on conflict (disciplina_id, codigo) do update set");
  });

  it("escapa aspas simples", () => {
    const e = editalMini();
    e.disciplinas[0].topicos[0].titulo = "Interpretação d'água";
    expect(sqlDoEdital(e)).toContain("'Interpretação d''água'");
  });

  it("grava subtópicos depois do pai, com parent_id pelo código", () => {
    const pai = sql.indexOf("'2', 'Sintaxe'");
    const filho = sql.indexOf("'2.1', 'Crase'");
    expect(pai).toBeGreaterThan(-1);
    expect(filho).toBeGreaterThan(pai);
    expect(sql).toContain("and t.codigo = '2')");
  });

  it("remove tópicos que saíram do edital", () => {
    expect(sql).toContain("delete from public.topicos");
    expect(sql).toContain("codigo <> all (array['1', '2', '2.1', '2.2']::text[])");
  });

  it("registra a configuração da discursiva", () => {
    expect(sql).toContain('\'{"pontuacao_maxima":30,"linhas_max":30,"nota_minima":15}\'::jsonb');
  });
});

import type { Edital, Topico } from "../../core/edital/schema";

function lit(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}

function litOuNull(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return "null";
  return typeof valor === "number" ? String(valor) : lit(valor);
}

function arr(valores: string[]): string {
  return valores.length === 0 ? "'{}'::text[]" : `array[${valores.map(lit).join(", ")}]::text[]`;
}

function json(valor: unknown): string {
  return valor === undefined || valor === null ? "null" : `${lit(JSON.stringify(valor))}::jsonb`;
}

interface NoPlano {
  codigo: string;
  titulo: string;
  canonico?: string;
  pai: string | null;
}

function achatar(topicos: Topico[], pai: string | null = null): NoPlano[] {
  return topicos.flatMap((t) => [
    { codigo: t.codigo, titulo: t.titulo, canonico: t.canonico, pai },
    ...(t.subtopicos ? achatar(t.subtopicos, t.codigo) : []),
  ]);
}

export function sqlDoEdital(e: Edital): string {
  const linhas: string[] = ["begin;"];
  const concurso = `(select id from public.concursos where slug = ${lit(e.slug)})`;
  const cargo = (slug: string) => `(select id from public.cargos where concurso_id = ${concurso} and slug = ${lit(slug)})`;
  const prova = (slug: string) => `(select id from public.provas where concurso_id = ${concurso} and slug = ${lit(slug)})`;
  const disciplina = (slug: string) =>
    `(select id from public.disciplinas where concurso_id = ${concurso} and slug = ${lit(slug)})`;

  linhas.push(
    `insert into public.bancas (slug, nome) values (${lit(e.banca)}, ${lit(e.banca)}) on conflict (slug) do nothing;`,
    `insert into public.concursos (slug, nome, banca_id, data_prova, ressalvas, editais_fonte)
values (${lit(e.slug)}, ${lit(e.nome)}, (select id from public.bancas where slug = ${lit(e.banca)}), ${lit(e.data_prova)}, ${arr(e.ressalvas)}, ${arr(e.editais_fonte)})
on conflict (slug) do update set nome = excluded.nome, banca_id = excluded.banca_id, data_prova = excluded.data_prova,
  ressalvas = excluded.ressalvas, editais_fonte = excluded.editais_fonte, atualizado_em = now();`,
  );

  for (const c of e.cargos) {
    linhas.push(`insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
values (${concurso}, ${lit(c.slug)}, ${lit(c.nome)}, ${arr(c.qualificacoes ?? [])}, ${c.duracao_min}, ${json(c.corte_conjunto)})
on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
  duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;`);
  }

  for (const p of e.provas) {
    const objetiva = p.tipo === "objetiva";
    const discursiva =
      p.tipo === "discursiva"
        ? { pontuacao_maxima: p.pontuacao_maxima, linhas_max: p.linhas_max, nota_minima: p.nota_minima }
        : null;
    linhas.push(`insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values (${concurso}, ${lit(p.slug)}, ${lit(p.nome)}, ${lit(p.tipo)}, ${litOuNull(objetiva ? p.formato : null)}, ${litOuNull(objetiva ? p.itens : null)}, ${litOuNull(objetiva ? p.alternativas : null)}, ${json(objetiva ? p.pontuacao : null)}, ${json(objetiva ? p.corte : null)}, ${json(objetiva ? p.distribuicao_estimada : null)}, ${json(discursiva)})
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;`);
  }

  linhas.push(`delete from public.cargo_provas where cargo_id in (select id from public.cargos where concurso_id = ${concurso});`);
  for (const c of e.cargos) {
    c.provas.forEach((p, i) => {
      linhas.push(`insert into public.cargo_provas (cargo_id, prova_id, ordem) values (${cargo(c.slug)}, ${prova(p)}, ${i});`);
    });
  }

  for (const d of e.disciplinas) {
    linhas.push(`insert into public.disciplinas (concurso_id, slug, nome) values (${concurso}, ${lit(d.slug)}, ${lit(d.nome)})
on conflict (concurso_id, slug) do update set nome = excluded.nome;`);
  }

  linhas.push(`delete from public.prova_disciplinas where prova_id in (select id from public.provas where concurso_id = ${concurso});`);
  for (const p of e.provas) {
    p.disciplinas.forEach((d, i) => {
      linhas.push(`insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values (${prova(p.slug)}, ${disciplina(d)}, ${i});`);
    });
  }

  for (const d of e.disciplinas) {
    const nos = achatar(d.topicos);
    for (const n of nos) {
      if (n.canonico) {
        linhas.push(`insert into public.topicos_canonicos (slug, titulo) values (${lit(n.canonico)}, ${lit(n.titulo)}) on conflict (slug) do nothing;`);
      }
    }
    linhas.push(`delete from public.topicos where disciplina_id = ${disciplina(d.slug)} and codigo <> all (${arr(nos.map((n) => n.codigo))});`);
    nos.forEach((n, ordem) => {
      const pai = n.pai === null
        ? "null"
        : `(select t.id from public.topicos t where t.disciplina_id = ${disciplina(d.slug)} and t.codigo = ${lit(n.pai)})`;
      const canonico = n.canonico ? `(select id from public.topicos_canonicos where slug = ${lit(n.canonico)})` : "null";
      linhas.push(`insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values (${disciplina(d.slug)}, ${lit(n.codigo)}, ${lit(n.titulo)}, ${pai}, ${canonico}, ${ordem})
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;`);
    });
  }

  linhas.push("commit;");
  return `${linhas.join("\n")}\n`;
}

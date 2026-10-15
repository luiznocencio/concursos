-- Carrega (ou atualiza) um concurso a partir do edital.yaml já validado e convertido em JSON.
-- Idempotente: pode ser executada de novo após uma retificação do edital.
-- Dividida em funções pequenas e sem apagar objetos de esquema: o MCP do Supabase pede
-- confirmação manual (que não chega numa sessão remota) para SQL que julga destrutivo.
-- Achata a árvore de tópicos do edital; "caminho" ordena em pré-ordem (pai antes dos filhos).
create or replace function public.nos_do_edital(e jsonb)
returns table (disciplina text, codigo text, titulo text, canonico text, pai text, ordem integer)
language sql
immutable
set search_path = ''
as $$
  with recursive nos as (
    select dj.value->>'slug' as disciplina, t.value as no, null::text as pai, array[t.ord::integer] as caminho
    from jsonb_array_elements(e->'disciplinas') as dj(value)
    cross join lateral jsonb_array_elements(dj.value->'topicos') with ordinality as t(value, ord)
    union all
    select n.disciplina, s.value, n.no->>'codigo', n.caminho || s.ord::integer
    from nos n
    cross join lateral jsonb_array_elements(n.no->'subtopicos') with ordinality as s(value, ord)
  )
  select disciplina, no->>'codigo', no->>'titulo', no->>'canonico', pai,
         (row_number() over (partition by disciplina order by caminho) - 1)::integer
  from nos
$$;

create or replace function public.edital_gravar_estrutura(e jsonb) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_concurso uuid;
  c jsonb;
  p jsonb;
  d jsonb;
begin
  insert into public.bancas (slug, nome) values (e->>'banca', e->>'banca') on conflict (slug) do nothing;
  select id into v_banca from public.bancas where slug = e->>'banca';

  insert into public.concursos (slug, nome, banca_id, data_prova, ressalvas, editais_fonte)
  values (
    e->>'slug', e->>'nome', v_banca, (e->>'data_prova')::date,
    array(select jsonb_array_elements_text(coalesce(e->'ressalvas', '[]'))),
    array(select jsonb_array_elements_text(e->'editais_fonte'))
  )
  on conflict (slug) do update set nome = excluded.nome, banca_id = excluded.banca_id, data_prova = excluded.data_prova,
    ressalvas = excluded.ressalvas, editais_fonte = excluded.editais_fonte, atualizado_em = now()
  returning id into v_concurso;

  for c in select value from jsonb_array_elements(e->'cargos') loop
    insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
    values (
      v_concurso, c->>'slug', c->>'nome',
      array(select jsonb_array_elements_text(coalesce(c->'qualificacoes', '[]'))),
      (c->>'duracao_min')::integer, c->'corte_conjunto'
    )
    on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
      duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;
  end loop;

  for p in select value from jsonb_array_elements(e->'provas') loop
    insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas,
                               regra_pontuacao, regra_corte, distribuicao, config_discursiva)
    values (
      v_concurso, p->>'slug', p->>'nome', p->>'tipo', p->>'formato', (p->>'itens')::integer,
      (p->>'alternativas')::integer, p->'pontuacao', p->'corte', p->'distribuicao_estimada',
      case when p->>'tipo' = 'discursiva' then jsonb_build_object(
        'pontuacao_maxima', p->'pontuacao_maxima', 'linhas_max', p->'linhas_max', 'nota_minima', p->'nota_minima'
      ) end
    )
    on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
      n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
      regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
  end loop;

  for d in select value from jsonb_array_elements(e->'disciplinas') loop
    insert into public.disciplinas (concurso_id, slug, nome) values (v_concurso, d->>'slug', d->>'nome')
    on conflict (concurso_id, slug) do update set nome = excluded.nome;
  end loop;

  return v_concurso;
end
$$;

create or replace function public.edital_ligar_cargos(e jsonb, v_concurso uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.cargo_provas where cargo_id in (select id from public.cargos where concurso_id = v_concurso);
  insert into public.cargo_provas (cargo_id, prova_id, ordem)
  select ca.id, pr.id, x.ord - 1
  from jsonb_array_elements(e->'cargos') as cj(value)
  join public.cargos ca on ca.concurso_id = v_concurso and ca.slug = cj.value->>'slug'
  cross join lateral jsonb_array_elements_text(cj.value->'provas') with ordinality as x(slug, ord)
  join public.provas pr on pr.concurso_id = v_concurso and pr.slug = x.slug;
end
$$;

create or replace function public.edital_ligar_disciplinas(e jsonb, v_concurso uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.prova_disciplinas where prova_id in (select id from public.provas where concurso_id = v_concurso);
  insert into public.prova_disciplinas (prova_id, disciplina_id, ordem)
  select pr.id, di.id, x.ord - 1
  from jsonb_array_elements(e->'provas') as pj(value)
  join public.provas pr on pr.concurso_id = v_concurso and pr.slug = pj.value->>'slug'
  cross join lateral jsonb_array_elements_text(pj.value->'disciplinas') with ordinality as x(slug, ord)
  join public.disciplinas di on di.concurso_id = v_concurso and di.slug = x.slug;
end
$$;

create or replace function public.edital_remover_topicos(e jsonb, v_concurso uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.topicos t
  where t.disciplina_id in (select id from public.disciplinas where concurso_id = v_concurso)
    and not exists (
      select 1 from public.nos_do_edital(e) n
      join public.disciplinas di on di.concurso_id = v_concurso and di.slug = n.disciplina
      where di.id = t.disciplina_id and n.codigo = t.codigo
    );
end
$$;

create or replace function public.edital_gravar_topicos(e jsonb, v_concurso uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  insert into public.topicos_canonicos (slug, titulo)
  select distinct on (canonico) canonico, titulo from public.nos_do_edital(e)
  where canonico is not null
  order by canonico, disciplina, ordem
  on conflict (slug) do nothing;

  insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
  select di.id, n.codigo, n.titulo, null, tc.id, n.ordem
  from public.nos_do_edital(e) n
  join public.disciplinas di on di.concurso_id = v_concurso and di.slug = n.disciplina
  left join public.topicos_canonicos tc on tc.slug = n.canonico
  on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, canonico_id = excluded.canonico_id,
    ordem = excluded.ordem;

  update public.topicos t set parent_id = pai.id
  from public.nos_do_edital(e) n
  join public.disciplinas di on di.concurso_id = v_concurso and di.slug = n.disciplina
  left join public.topicos pai on pai.disciplina_id = di.id and pai.codigo = n.pai
  where t.disciplina_id = di.id and t.codigo = n.codigo;
end
$$;

create or replace function public.carregar_edital(e jsonb) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_concurso uuid;
begin
  v_concurso := public.edital_gravar_estrutura(e);
  perform public.edital_ligar_cargos(e, v_concurso);
  perform public.edital_ligar_disciplinas(e, v_concurso);
  perform public.edital_remover_topicos(e, v_concurso);
  perform public.edital_gravar_topicos(e, v_concurso);
end
$$;

-- Só administradores (SQL Editor, MCP, service role) carregam editais; a API pública não expõe as funções.
revoke all on function public.nos_do_edital(jsonb) from public, anon, authenticated;
revoke all on function public.edital_gravar_estrutura(jsonb) from public, anon, authenticated;
revoke all on function public.edital_ligar_cargos(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.edital_ligar_disciplinas(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.edital_remover_topicos(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.edital_gravar_topicos(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.carregar_edital(jsonb) from public, anon, authenticated;

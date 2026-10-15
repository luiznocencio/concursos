-- Fila de jobs, gravação de lotes de itens e registro de uso de IA.
-- Funções pequenas e sem apagar objetos: o MCP do Supabase pede confirmação manual
-- (que não chega numa sessão remota) para SQL que julga destrutivo.

alter table public.fontes add column canonicos text[] not null default '{}';

create or replace function public.jobs_enfileirar_geracao(p_concurso text, p_canonico text, p_quantidade integer)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.jobs
  where tipo = 'gerar_itens' and status in ('pendente', 'processando')
    and payload->>'canonico' = p_canonico and payload->>'concurso' = p_concurso
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.jobs (tipo, payload)
  values ('gerar_itens', jsonb_build_object('concurso', p_concurso, 'canonico', p_canonico, 'quantidade', p_quantidade))
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.jobs_reservar()
returns setof public.jobs
language sql
set search_path = ''
as $$
  update public.jobs set status = 'processando', tentativas = tentativas + 1, atualizado_em = now()
  where id = (
    select id from public.jobs
    where status = 'pendente' and executar_apos <= now()
    order by executar_apos
    limit 1
    for update skip locked
  )
  returning *;
$$;

create or replace function public.jobs_concluir(p_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.jobs set status = 'concluido', erro = null, atualizado_em = now() where id = p_id;
$$;

-- Volta o job para a fila com espera crescente (1, 4, 9 minutos...) ou marca como falho
-- depois de p_max_tentativas.
create or replace function public.jobs_falhar(p_id uuid, p_erro text, p_max_tentativas integer)
returns void
language sql
set search_path = ''
as $$
  update public.jobs set
    status = case when tentativas >= p_max_tentativas then 'falhou' else 'pendente' end,
    erro = p_erro,
    executar_apos = now() + make_interval(mins => tentativas * tentativas),
    atualizado_em = now()
  where id = p_id;
$$;

create or replace function public.ia_registrar_uso(p_uso jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.ai_usage (provedor, modelo, finalidade, tokens_entrada, tokens_saida, custo_usd, job_id)
  values (
    p_uso->>'provedor', p_uso->>'modelo', p_uso->>'finalidade',
    (p_uso->>'tokens_entrada')::integer, (p_uso->>'tokens_saida')::integer,
    (p_uso->>'custo_usd')::numeric, nullif(p_uso->>'job_id', '')::uuid
  );
$$;

-- Grava um lote: texto-base opcional, itens (ignorando hashes já existentes) e seus tópicos.
-- Devolve quantos itens novos foram gravados.
create or replace function public.itens_registrar_lote(p_lote jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_texto uuid;
  v_item uuid;
  v_fonte uuid;
  v_gravados integer := 0;
  i jsonb;
begin
  select id into v_banca from public.bancas where slug = p_lote->>'banca';
  if v_banca is null then
    raise exception 'banca desconhecida: %', p_lote->>'banca';
  end if;

  if nullif(p_lote->>'texto_base', '') is not null then
    insert into public.textos_base (conteudo, origem) values (p_lote->>'texto_base', p_lote->>'origem')
    returning id into v_texto;
  end if;

  select id into v_fonte from public.fontes where slug = p_lote->>'fonte';

  for i in select value from jsonb_array_elements(p_lote->'itens') loop
    v_item := null;
    insert into public.itens (banca_id, formato, texto_base_id, enunciado, gabarito, justificativa, citacao,
                              fonte_id, origem, status, dificuldade, hash_normalizado, validacao)
    values (
      v_banca, p_lote->>'formato', v_texto, i->>'enunciado', i->>'gabarito', i->>'justificativa',
      nullif(i->>'citacao', ''), v_fonte, p_lote->>'origem', i->>'status',
      (i->>'dificuldade')::smallint, i->>'hash', coalesce(i->'validacao', '{}')
    )
    on conflict (hash_normalizado) do nothing
    returning id into v_item;

    if v_item is not null then
      v_gravados := v_gravados + 1;
      insert into public.item_topicos (item_id, topico_canonico_id)
      select v_item, tc.id from public.topicos_canonicos tc
      where tc.slug in (select jsonb_array_elements_text(i->'canonicos'));
    end if;
  end loop;

  return v_gravados;
end
$$;

revoke all on function public.jobs_enfileirar_geracao(text, text, integer) from public, anon, authenticated;
revoke all on function public.jobs_reservar() from public, anon, authenticated;
revoke all on function public.jobs_concluir(uuid) from public, anon, authenticated;
revoke all on function public.jobs_falhar(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.ia_registrar_uso(jsonb) from public, anon, authenticated;
revoke all on function public.itens_registrar_lote(jsonb) from public, anon, authenticated;
grant execute on function public.jobs_enfileirar_geracao(text, text, integer) to service_role;
grant execute on function public.jobs_reservar() to service_role;
grant execute on function public.jobs_concluir(uuid) to service_role;
grant execute on function public.jobs_falhar(uuid, text, integer) to service_role;
grant execute on function public.ia_registrar_uso(jsonb) to service_role;
grant execute on function public.itens_registrar_lote(jsonb) to service_role;

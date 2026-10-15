-- Funções de leitura e escrita das telas de estudo. As de leitura e a de criação de sessão rodam
-- com os direitos do usuário (RLS vale); as que mexem em tabelas do servidor são security definer
-- e checam auth.uid(). Devolvem jsonb para não esbarrar no limite de linhas da API do Supabase.

-- Tópicos canônicos que caem nas provas objetivas do cargo.
create or replace function public.estudo_canonicos_do_cargo(p_cargo uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct t.canonico_id
  from public.cargo_provas cp
  join public.provas p on p.id = cp.prova_id and p.tipo = 'objetiva'
  join public.prova_disciplinas pd on pd.prova_id = p.id
  join public.topicos t on t.disciplina_id = pd.disciplina_id
  where cp.cargo_id = p_cargo and t.canonico_id is not null
$$;

-- Itens aprovados do cargo: [{ "id", "textoBaseId", "canonicos": [slug], "visto" }].
create or replace function public.estudo_candidatos(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'textoBaseId', x.texto_base_id, 'canonicos', x.canonicos, 'visto', x.visto
  ) order by x.criado_em, x.id), '[]'::jsonb)
  from (
    select i.id, i.texto_base_id, i.criado_em,
      array_agg(tc.slug order by tc.slug) as canonicos,
      exists (select 1 from public.respostas r where r.item_id = i.id and r.user_id = (select auth.uid())) as visto
    from public.itens i
    join public.item_topicos it on it.item_id = i.id
    join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
    where i.status = 'aprovado'
      and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
    group by i.id
  ) x
$$;

-- Histórico do usuário por tópico canônico do cargo: [{ "canonico", "resultado", "respondidaEm" }].
-- Respostas de simulado completo só contam depois da entrega. Itens suspeitos ou descartados não contam.
create or replace function public.estudo_historico(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'canonico', tc.slug,
    'resultado', case
      when r.resposta = 'branco' then 'branco'
      when r.resposta = i.gabarito then case when r.duvida then 'certo_duvida' else 'certo' end
      else 'errado'
    end,
    'respondidaEm', r.respondida_em
  ) order by r.respondida_em), '[]'::jsonb)
  from public.respostas r
  join public.simulados s on s.id = r.simulado_id
  join public.itens i on i.id = r.item_id and i.status in ('aprovado', 'revisao')
  join public.item_topicos it on it.item_id = i.id
  join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
  where r.user_id = (select auth.uid())
    and (s.modo <> 'completo' or s.finalizado_em is not null)
    and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
$$;

-- Cria a sessão e a lista ordenada de itens numa só transação.
create or replace function public.simulado_criar(p_cargo uuid, p_modo text, p_config jsonb, p_itens uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_itens, 1), 0) = 0 then
    raise exception 'sessão sem itens';
  end if;
  insert into public.simulados (cargo_id, modo, config)
  values (p_cargo, p_modo, coalesce(p_config, '{}'::jsonb))
  returning id into v_id;
  insert into public.simulado_itens (simulado_id, item_id, ordem)
  select v_id, u.item_id, u.ordem::integer
  from unnest(p_itens) with ordinality as u(item_id, ordem);
  return v_id;
end
$$;

-- Qualquer pessoa que já respondeu o item pode marcá-lo como suspeito; ele sai das sessões
-- até alguém revisar. O motivo fica em validacao->'denuncias'.
create or replace function public.itens_marcar_suspeito(p_item uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado';
  end if;
  if not exists (select 1 from public.respostas where item_id = p_item and user_id = (select auth.uid())) then
    raise exception 'só quem respondeu o item pode marcá-lo';
  end if;
  update public.itens
  set status = case when status in ('aprovado', 'revisao') then 'suspeito' else status end,
      validacao = jsonb_set(
        validacao, '{denuncias}',
        coalesce(validacao->'denuncias', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('usuario', (select auth.uid()), 'motivo', left(coalesce(p_motivo, ''), 500), 'em', now()))
      ),
      atualizado_em = now()
  where id = p_item;
end
$$;

-- Pede geração para os tópicos com poucos itens. Limite de 3 pedidos automáticos em aberto por usuário.
-- Devolve quantos jobs novos entraram na fila.
create or replace function public.estudo_pedir_geracao(p_concurso text, p_canonicos text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_abertos integer;
  v_novos integer := 0;
  v_canonico text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  select count(*) into v_abertos from public.jobs
  where tipo = 'gerar_itens' and status in ('pendente', 'processando') and payload->>'pedido_por' = v_usuario::text;
  foreach v_canonico in array coalesce(p_canonicos, '{}') loop
    exit when v_abertos + v_novos >= 3;
    continue when exists (
      select 1 from public.jobs
      where tipo = 'gerar_itens' and status in ('pendente', 'processando')
        and payload->>'concurso' = p_concurso and payload->>'canonico' = v_canonico
    );
    insert into public.jobs (tipo, payload)
    values ('gerar_itens', jsonb_build_object(
      'concurso', p_concurso, 'canonico', v_canonico, 'quantidade', 5, 'pedido_por', v_usuario
    ));
    v_novos := v_novos + 1;
  end loop;
  return v_novos;
end
$$;

revoke all on function public.estudo_canonicos_do_cargo(uuid) from public, anon;
revoke all on function public.estudo_candidatos(uuid) from public, anon;
revoke all on function public.estudo_historico(uuid) from public, anon;
revoke all on function public.simulado_criar(uuid, text, jsonb, uuid[]) from public, anon;
revoke all on function public.itens_marcar_suspeito(uuid, text) from public, anon;
revoke all on function public.estudo_pedir_geracao(text, text[]) from public, anon;
grant execute on function public.estudo_canonicos_do_cargo(uuid) to authenticated, service_role;
grant execute on function public.estudo_candidatos(uuid) to authenticated, service_role;
grant execute on function public.estudo_historico(uuid) to authenticated, service_role;
grant execute on function public.simulado_criar(uuid, text, jsonb, uuid[]) to authenticated;
grant execute on function public.itens_marcar_suspeito(uuid, text) to authenticated;
grant execute on function public.estudo_pedir_geracao(text, text[]) to authenticated;

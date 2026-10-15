-- Importação de itens reais (provas anteriores da banca) e origem dos candidatos das sessões.
-- Sem DROP e sem DELETE: o MCP do Supabase pede confirmação manual para SQL que julga destrutivo.

-- Grava uma prova importada: { banca, prova_origem, importado_por,
--   grupos: [{ texto_base, itens: [{ numero, enunciado, gabarito, hash, canonicos[] }] }] }.
-- Itens entram como origem 'real' e status 'aprovado'. Hash já existente conta como duplicado; o
-- texto-base só é gravado quando algum item do grupo é novo. Tópico desconhecido aborta tudo.
-- Devolve { "gravados": n, "duplicados": [numeros] }.
create or replace function public.itens_importar_reais(p_prova jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_origem text := nullif(trim(p_prova->>'prova_origem'), '');
  v_texto uuid;
  v_item uuid;
  v_gravados integer := 0;
  v_duplicados integer[] := '{}';
  v_desconhecido text;
  g jsonb;
  i jsonb;
begin
  select id into v_banca from public.bancas where slug = p_prova->>'banca';
  if v_banca is null then
    raise exception 'banca desconhecida: %', p_prova->>'banca';
  end if;
  if v_origem is null then
    raise exception 'prova de origem obrigatória';
  end if;

  select c into v_desconhecido
  from jsonb_array_elements(p_prova->'grupos') grupo,
       jsonb_array_elements(grupo->'itens') item,
       jsonb_array_elements_text(item->'canonicos') c
  where not exists (select 1 from public.topicos_canonicos tc where tc.slug = c)
  limit 1;
  if v_desconhecido is not null then
    raise exception 'tópico canônico desconhecido: %', v_desconhecido;
  end if;

  for g in select value from jsonb_array_elements(p_prova->'grupos') loop
    v_texto := null;
    if nullif(g->>'texto_base', '') is not null and exists (
      select 1 from jsonb_array_elements(g->'itens') x
      where not exists (select 1 from public.itens where hash_normalizado = x->>'hash')
    ) then
      insert into public.textos_base (conteudo, origem) values (g->>'texto_base', 'real')
      returning id into v_texto;
    end if;

    for i in select value from jsonb_array_elements(g->'itens') loop
      v_item := null;
      insert into public.itens (banca_id, formato, texto_base_id, enunciado, gabarito, origem, prova_origem,
                                status, hash_normalizado, validacao)
      values (
        v_banca, 'certo_errado', v_texto, i->>'enunciado', i->>'gabarito', 'real', v_origem, 'aprovado', i->>'hash',
        jsonb_build_object('importacao', jsonb_build_object(
          'numero', (i->>'numero')::integer, 'por', p_prova->>'importado_por', 'em', now()
        ))
      )
      on conflict (hash_normalizado) do nothing
      returning id into v_item;

      if v_item is null then
        v_duplicados := v_duplicados || (i->>'numero')::integer;
      else
        v_gravados := v_gravados + 1;
        insert into public.item_topicos (item_id, topico_canonico_id)
        select v_item, tc.id from public.topicos_canonicos tc
        where tc.slug in (select jsonb_array_elements_text(i->'canonicos'));
      end if;
    end loop;
  end loop;

  return jsonb_build_object('gravados', v_gravados, 'duplicados', to_jsonb(v_duplicados));
end
$$;

revoke all on function public.itens_importar_reais(jsonb) from public, anon, authenticated;
grant execute on function public.itens_importar_reais(jsonb) to service_role;

-- Igual à da 0007, agora com a origem de cada item: o app esconde os reais em modo produto
-- (ITENS_REAIS_VISIVEIS=false) sem deixar de usá-los como referência de estilo na geração.
create or replace function public.estudo_candidatos(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'textoBaseId', x.texto_base_id, 'canonicos', x.canonicos, 'visto', x.visto, 'origem', x.origem
  ) order by x.criado_em, x.id), '[]'::jsonb)
  from (
    select i.id, i.texto_base_id, i.criado_em, i.origem,
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

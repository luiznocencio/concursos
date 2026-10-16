-- Histórico do motor de foco com os erros de redação: cada erro de língua vira um "errado" no tópico
-- de Português ligado à categoria. O app dá a esses registros peso menor (CONFIG_FOCO.pesoErroRedacao)
-- e os deixa fora das estatísticas de itens do painel. Igual à 0007, mais o campo "origem".
create or replace function public.estudo_historico(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(h.registro order by h.quando), '[]'::jsonb)
  from (
    select r.respondida_em as quando, jsonb_build_object(
      'canonico', tc.slug,
      'resultado', case
        when r.resposta = 'branco' then 'branco'
        when r.resposta = i.gabarito then case when r.duvida then 'certo_duvida' else 'certo' end
        else 'errado'
      end,
      'respondidaEm', r.respondida_em,
      'origem', 'item'
    ) as registro
    from public.respostas r
    join public.simulados s on s.id = r.simulado_id
    join public.itens i on i.id = r.item_id and i.status in ('aprovado', 'revisao')
    join public.item_topicos it on it.item_id = i.id
    join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
    where r.user_id = (select auth.uid())
      and (s.modo <> 'completo' or s.finalizado_em is not null)
      and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
    union all
    select e.criado_em, jsonb_build_object(
      'canonico', e.canonico, 'resultado', 'errado', 'respondidaEm', e.criado_em, 'origem', 'redacao'
    )
    from public.erros_redacao e
    join public.topicos_canonicos tc on tc.slug = e.canonico
    where e.usuario_id = (select auth.uid())
      and tc.id in (select public.estudo_canonicos_do_cargo(p_cargo))
  ) h
$$;

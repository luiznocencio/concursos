-- Preparação do banco local para o E2E. Roda depois das migrações e do seed do edital
-- (supabase start / supabase db reset) e pode rodar de novo sem duplicar nada.

-- 1. Nenhum agendamento chama o worker de produção a partir do banco local.
-- As migrações não agendam nada, mas o guia de deploy agenda 'worker-jobs' com pg_cron + pg_net
-- apontando para a URL de produção; se alguém repetir isso no banco local, desfazemos aqui.
do $$
begin
  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'worker-jobs' or command ilike '%http%';
  end if;
end
$$;

-- 2. Itens aprovados para treinar e montar o simulado sem IA: 3 por tópico canônico
-- (o 2º de cada tópico com gabarito Errado, os outros Certo). Hash prefixado com "e2e:".
with banca as (
  select id from public.bancas where slug = 'cebraspe'
),
novos as (
  insert into public.itens (banca_id, formato, enunciado, gabarito, justificativa, origem, status, hash_normalizado)
  select
    banca.id,
    'certo_errado',
    format('Item de teste %s sobre %s.', n, tc.titulo),
    case when n = 2 then 'E' else 'C' end,
    format('Justificativa de teste do item %s sobre %s.', n, tc.titulo),
    'ia',
    'aprovado',
    format('e2e:%s:%s', tc.slug, n)
  from public.topicos_canonicos tc
  cross join generate_series(1, 3) as n
  cross join banca
  on conflict (hash_normalizado) do nothing
  returning id, hash_normalizado
)
insert into public.item_topicos (item_id, topico_canonico_id)
select novos.id, tc.id
from novos
join public.topicos_canonicos tc on tc.slug = split_part(novos.hash_normalizado, ':', 2);

-- Pedidos de geração por IA do próprio usuário (itens e temas), para as telas mostrarem o andamento.
-- A tabela jobs não tem política de leitura para usuários: esta função devolve só os pedidos de auth.uid(),
-- em aberto ou atualizados nos últimos 30 minutos, com os campos que as telas usam.
create or replace function public.meus_pedidos_ia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'tipo', j.tipo,
    'status', j.status,
    'canonico', j.payload->>'canonico',
    'criadoEm', j.criado_em,
    'atualizadoEm', j.atualizado_em
  ) order by j.criado_em desc), '[]'::jsonb)
  from public.jobs j
  where j.payload->>'pedido_por' = (select auth.uid())::text
    and j.tipo in ('gerar_itens', 'gerar_tema')
    and (j.status in ('pendente', 'processando') or j.atualizado_em > now() - interval '30 minutes')
$$;

revoke all on function public.meus_pedidos_ia() from public, anon;
grant execute on function public.meus_pedidos_ia() to authenticated;

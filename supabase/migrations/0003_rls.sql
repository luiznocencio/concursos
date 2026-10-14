do $$
declare
  t text;
begin
  foreach t in array array[
    'bancas', 'concursos', 'cargos', 'provas', 'cargo_provas', 'disciplinas', 'prova_disciplinas',
    'topicos_canonicos', 'topicos', 'fontes', 'fonte_dispositivos', 'textos_base', 'itens', 'item_topicos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "leitura para autenticados" on public.%I for select to authenticated using (true)', t);
  end loop;

  foreach t in array array['simulados', 'simulado_itens', 'respostas', 'revisao_espacada'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono le e escreve" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;

  -- Apenas o servidor (service role, que ignora RLS) acessa estas tabelas.
  alter table public.jobs enable row level security;
  alter table public.ai_usage enable row level security;
end
$$;

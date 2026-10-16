-- Corretor de discursiva (sub-projeto 2): temas, redações, correções por IA e erros de língua.
-- Ver docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md.

-- O edital passa a guardar caracteres_por_linha da prova discursiva (calibra a folha digitada).
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
        'pontuacao_maxima', p->'pontuacao_maxima', 'linhas_max', p->'linhas_max', 'nota_minima', p->'nota_minima',
        'caracteres_por_linha', coalesce(p->'caracteres_por_linha', '70'::jsonb)
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
revoke all on function public.edital_gravar_estrutura(jsonb) from public, anon, authenticated;

create table public.temas_discursiva (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  prova_id uuid not null references public.provas (id) on delete cascade,
  tipo text not null default 'dissertativo' check (tipo in ('dissertativo')),
  origem text not null check (origem in ('gerado', 'real')),
  prova_origem text,
  status text not null check (status in ('aprovado', 'revisao', 'rejeitado')),
  enunciado text not null check (length(trim(enunciado)) > 0),
  textos_apoio jsonb not null default '[]',
  padrao_resposta jsonb not null,
  hash text not null,
  criado_em timestamptz not null default now(),
  unique (concurso_id, hash),
  constraint temas_real_tem_origem check (origem <> 'real' or prova_origem is not null)
);

create table public.redacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid not null references public.temas_discursiva (id),
  simulado_id uuid references public.simulados (id) on delete set null,
  entrada text not null default 'digitada' check (entrada in ('digitada', 'foto')),
  linhas text[] not null default '{}' check (coalesce(array_length(linhas, 1), 0) <= 30),
  excedente text[] not null default '{}',
  status text not null default 'rascunho' check (status in (
    'rascunho', 'transcrevendo', 'aguardando_confirmacao', 'na_fila', 'corrigindo', 'corrigida', 'falhou'
  )),
  aviso text,
  nc numeric(5, 2),
  ne integer,
  tl integer,
  npd numeric(5, 2),
  zerada_motivo text check (zerada_motivo in ('fuga_tema', 'sem_texto', 'npd_negativo')),
  terceira_correcao boolean not null default false,
  prioridades jsonb,
  fotos text[] not null default '{}',
  fotos_apagar_em timestamptz,
  entregue_em timestamptz,
  corrigida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index redacoes_usuario_idx on public.redacoes (usuario_id, criado_em desc);

create table public.correcoes_discursiva (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes (id) on delete cascade,
  papel text not null check (papel in ('conteudo_1', 'conteudo_2', 'conteudo_3', 'lingua', 'transcricao')),
  provedor text not null check (provedor in ('anthropic', 'openai')),
  modelo text not null,
  resposta jsonb not null,
  custo_usd numeric(10, 6) not null default 0,
  criado_em timestamptz not null default now(),
  -- Uma correção por papel: é o que torna a retomada idempotente.
  unique (redacao_id, papel)
);

create table public.erros_redacao (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  linha integer not null check (linha between 1 and 30),
  trecho text not null,
  tipo text not null check (tipo in ('grafia', 'morfossintaxe', 'propriedade_vocabular')),
  categoria text not null,
  correcao text not null,
  explicacao text not null,
  canonico text not null,
  criado_em timestamptz not null default now()
);
create index erros_redacao_usuario_idx on public.erros_redacao (usuario_id, criado_em desc);

alter table public.temas_discursiva enable row level security;
alter table public.redacoes enable row level security;
alter table public.correcoes_discursiva enable row level security;
alter table public.erros_redacao enable row level security;

create policy "le temas aprovados" on public.temas_discursiva for select to authenticated using (status = 'aprovado');

create policy "dono le" on public.redacoes for select to authenticated using (usuario_id = (select auth.uid()));
create policy "dono cria rascunho" on public.redacoes for insert to authenticated with check (
  usuario_id = (select auth.uid())
  and status = 'rascunho'
  and exists (select 1 from public.temas_discursiva t where t.id = tema_id)
  and (simulado_id is null or exists (
    select 1 from public.simulados s where s.id = simulado_id and s.user_id = (select auth.uid())
  ))
);
create policy "dono edita enquanto escreve" on public.redacoes for update to authenticated
  using (usuario_id = (select auth.uid()) and status in ('rascunho', 'aguardando_confirmacao'))
  with check (usuario_id = (select auth.uid()) and status in ('rascunho', 'aguardando_confirmacao'));
create policy "dono apaga rascunho" on public.redacoes for delete to authenticated
  using (usuario_id = (select auth.uid()) and status = 'rascunho');
-- O usuário só escreve o texto; estado e notas mudam pelas funções abaixo ou pelo worker (service role).
revoke insert, update on public.redacoes from authenticated, anon;
grant insert (usuario_id, tema_id, simulado_id, linhas, excedente) on public.redacoes to authenticated;
grant update (linhas, excedente) on public.redacoes to authenticated;

create policy "dono le" on public.correcoes_discursiva for select to authenticated using (
  exists (select 1 from public.redacoes r where r.id = redacao_id and r.usuario_id = (select auth.uid()))
);
create policy "dono le" on public.erros_redacao for select to authenticated using (usuario_id = (select auth.uid()));

-- Fotos da folha: bucket privado, cada usuário só na própria pasta (<usuario_id>/...).
insert into storage.buckets (id, name, public) values ('redacoes-fotos', 'redacoes-fotos', false)
on conflict (id) do nothing;
create policy "redacoes-fotos: dono envia" on storage.objects for insert to authenticated with check (
  bucket_id = 'redacoes-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "redacoes-fotos: dono le" on storage.objects for select to authenticated using (
  bucket_id = 'redacoes-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Limites por usuário: redações em correção ao mesmo tempo e entregas por dia (horário de Maceió).
create or replace function public.discursiva_checar_limites(p_usuario uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c_simultaneas constant integer := 2;
  c_por_dia constant integer := 10;
begin
  if (select count(*) from public.redacoes
      where usuario_id = p_usuario and status in ('transcrevendo', 'na_fila', 'corrigindo')) >= c_simultaneas then
    raise exception 'limite_simultaneas' using hint = 'Espere uma correção terminar.';
  end if;
  if (select count(*) from public.redacoes
      where usuario_id = p_usuario
        and entregue_em >= (date_trunc('day', now() at time zone 'America/Maceio') at time zone 'America/Maceio')) >= c_por_dia then
    raise exception 'limite_diario' using hint = 'O limite diário de correções foi atingido.';
  end if;
end
$$;

-- Entrega para correção: valida dono e estado, aplica limites e enfileira o job.
create or replace function public.discursiva_entregar(p_redacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_status text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  select status into v_status from public.redacoes where id = p_redacao and usuario_id = v_usuario for update;
  if v_status is null then
    raise exception 'redação não encontrada';
  end if;
  if v_status not in ('rascunho', 'aguardando_confirmacao', 'falhou') then
    raise exception 'redação não pode ser entregue no estado %', v_status;
  end if;
  perform public.discursiva_checar_limites(v_usuario);
  update public.redacoes
  set status = 'na_fila', aviso = null, entregue_em = now(), atualizado_em = now()
  where id = p_redacao;
  insert into public.jobs (tipo, payload)
  values ('corrigir_redacao', jsonb_build_object('redacao_id', p_redacao, 'pedido_por', v_usuario));
end
$$;

-- Fotos já enviadas ao Storage: registra os caminhos e enfileira a transcrição.
create or replace function public.discursiva_enviar_fotos(p_redacao uuid, p_fotos text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_status text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  if coalesce(array_length(p_fotos, 1), 0) not between 1 and 2 then
    raise exception 'envie 1 ou 2 fotos';
  end if;
  if exists (select 1 from unnest(p_fotos) f where f not like v_usuario::text || '/%') then
    raise exception 'foto fora da pasta do usuário';
  end if;
  select status into v_status from public.redacoes where id = p_redacao and usuario_id = v_usuario for update;
  if v_status is null then
    raise exception 'redação não encontrada';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'redação não pode receber fotos no estado %', v_status;
  end if;
  perform public.discursiva_checar_limites(v_usuario);
  update public.redacoes
  set entrada = 'foto', fotos = p_fotos, status = 'transcrevendo', aviso = null, atualizado_em = now()
  where id = p_redacao;
  insert into public.jobs (tipo, payload)
  values ('transcrever_redacao', jsonb_build_object('redacao_id', p_redacao, 'pedido_por', v_usuario));
end
$$;

-- Pede um tema novo gerado por IA; no máximo um pedido aberto por usuário. Devolve se enfileirou.
create or replace function public.discursiva_pedir_tema(p_concurso text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  if not exists (select 1 from public.concursos where slug = p_concurso) then
    raise exception 'concurso desconhecido: %', p_concurso;
  end if;
  if exists (
    select 1 from public.jobs
    where tipo = 'gerar_tema' and status in ('pendente', 'processando') and payload->>'pedido_por' = v_usuario::text
  ) then
    return false;
  end if;
  insert into public.jobs (tipo, payload)
  values ('gerar_tema', jsonb_build_object('concurso', p_concurso, 'pedido_por', v_usuario));
  return true;
end
$$;

-- Importa temas reais já validados pelo app: {concurso, prova_origem, temas: [{enunciado, textos_apoio, padrao_resposta}]}.
-- Devolve {gravados, duplicados} (índices, base 0, dos temas que já existiam).
create or replace function public.discursiva_importar_temas(p_lote jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_concurso uuid;
  v_prova uuid;
  v_origem text := nullif(trim(p_lote->>'prova_origem'), '');
  v_gravados integer := 0;
  v_duplicados integer[] := '{}';
  v_id uuid;
  t jsonb;
  n integer;
begin
  select c.id, p.id into v_concurso, v_prova
  from public.concursos c join public.provas p on p.concurso_id = c.id and p.tipo = 'discursiva'
  where c.slug = p_lote->>'concurso'
  limit 1;
  if v_prova is null then
    raise exception 'concurso sem prova discursiva: %', p_lote->>'concurso';
  end if;
  if v_origem is null then
    raise exception 'prova de origem obrigatória';
  end if;
  for t, n in select value, (ordinality - 1)::integer from jsonb_array_elements(p_lote->'temas') with ordinality loop
    insert into public.temas_discursiva
      (concurso_id, prova_id, origem, prova_origem, status, enunciado, textos_apoio, padrao_resposta, hash)
    values (
      v_concurso, v_prova, 'real', v_origem, 'aprovado', t->>'enunciado', coalesce(t->'textos_apoio', '[]'),
      t->'padrao_resposta', md5(lower(regexp_replace(trim(t->>'enunciado'), '\s+', ' ', 'g')))
    )
    on conflict (concurso_id, hash) do nothing
    returning id into v_id;
    if v_id is null then
      v_duplicados := v_duplicados || n;
    else
      v_gravados := v_gravados + 1;
    end if;
    v_id := null;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'duplicados', to_jsonb(v_duplicados));
end
$$;

revoke all on function public.discursiva_checar_limites(uuid) from public, anon, authenticated;
revoke all on function public.discursiva_entregar(uuid) from public, anon;
revoke all on function public.discursiva_enviar_fotos(uuid, text[]) from public, anon;
revoke all on function public.discursiva_pedir_tema(text) from public, anon;
revoke all on function public.discursiva_importar_temas(jsonb) from public, anon, authenticated;
grant execute on function public.discursiva_entregar(uuid) to authenticated;
grant execute on function public.discursiva_enviar_fotos(uuid, text[]) to authenticated;
grant execute on function public.discursiva_pedir_tema(text) to authenticated;
grant execute on function public.discursiva_importar_temas(jsonb) to service_role;

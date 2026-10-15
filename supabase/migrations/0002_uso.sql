create table public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cargo_id uuid not null references public.cargos (id),
  modo text not null check (modo in ('completo', 'treino', 'revisao')),
  config jsonb not null default '{}',
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  resultado jsonb
);
create index simulados_user_idx on public.simulados (user_id, iniciado_em desc);

create table public.simulado_itens (
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  item_id uuid not null references public.itens (id),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ordem integer not null,
  primary key (simulado_id, item_id)
);

create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  item_id uuid not null references public.itens (id),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resposta text not null check (resposta in ('A', 'B', 'C', 'D', 'E', 'branco')),
  duvida boolean not null default false,
  tempo_ms integer check (tempo_ms >= 0),
  respondida_em timestamptz not null default now(),
  unique (simulado_id, item_id)
);
create index respostas_user_idx on public.respostas (user_id, respondida_em desc);

create table public.revisao_espacada (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.itens (id) on delete cascade,
  etapa smallint not null check (etapa between 1 and 4),
  proxima_em timestamptz not null,
  primary key (user_id, item_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  payload jsonb not null default '{}',
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'concluido', 'falhou')),
  tentativas integer not null default 0,
  erro text,
  executar_apos timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index jobs_fila_idx on public.jobs (status, executar_apos);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  provedor text not null check (provedor in ('anthropic', 'openai')),
  modelo text not null,
  finalidade text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(10, 6) not null default 0,
  job_id uuid references public.jobs (id) on delete set null,
  criado_em timestamptz not null default now()
);

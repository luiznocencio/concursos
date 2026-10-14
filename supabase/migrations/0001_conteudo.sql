create table public.bancas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  formatos text[] not null default '{}',
  guia_estilo text not null default '',
  criado_em timestamptz not null default now()
);

create table public.concursos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  banca_id uuid not null references public.bancas (id),
  data_prova date not null,
  ressalvas text[] not null default '{}',
  editais_fonte text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  qualificacoes text[] not null default '{}',
  duracao_min integer not null check (duracao_min > 0),
  corte_conjunto jsonb,
  unique (concurso_id, slug)
);

create table public.provas (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  tipo text not null check (tipo in ('objetiva', 'discursiva')),
  formato text check (formato in ('certo_errado', 'multipla_escolha')),
  n_itens integer check (n_itens > 0),
  alternativas integer check (alternativas between 2 and 5),
  regra_pontuacao jsonb,
  regra_corte jsonb,
  distribuicao jsonb,
  config_discursiva jsonb,
  unique (concurso_id, slug),
  constraint provas_campos_por_tipo check (
    (tipo = 'objetiva' and formato is not null and n_itens is not null and regra_pontuacao is not null and distribuicao is not null)
    or (tipo = 'discursiva' and config_discursiva is not null)
  )
);

create table public.cargo_provas (
  cargo_id uuid not null references public.cargos (id) on delete cascade,
  prova_id uuid not null references public.provas (id) on delete cascade,
  ordem integer not null,
  primary key (cargo_id, prova_id)
);

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  unique (concurso_id, slug)
);

create table public.prova_disciplinas (
  prova_id uuid not null references public.provas (id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas (id) on delete cascade,
  ordem integer not null,
  primary key (prova_id, disciplina_id)
);

create table public.topicos_canonicos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)+$'),
  titulo text not null,
  area text generated always as (split_part(slug, '/', 1)) stored
);

create table public.topicos (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  parent_id uuid references public.topicos (id) on delete cascade,
  canonico_id uuid references public.topicos_canonicos (id),
  ordem integer not null,
  unique (disciplina_id, codigo)
);
create index topicos_canonico_idx on public.topicos (canonico_id);

create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tipo text not null check (tipo in ('lei', 'decreto', 'constituicao', 'conceito')),
  titulo text not null,
  url_oficial text,
  criado_em timestamptz not null default now()
);

create table public.fonte_dispositivos (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.fontes (id) on delete cascade,
  referencia text not null,
  texto text not null,
  ordem integer not null,
  unique (fonte_id, referencia)
);

create table public.textos_base (
  id uuid primary key default gen_random_uuid(),
  conteudo text not null,
  origem text not null check (origem in ('real', 'ia')),
  criado_em timestamptz not null default now()
);

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  banca_id uuid not null references public.bancas (id),
  formato text not null check (formato in ('certo_errado', 'multipla_escolha')),
  texto_base_id uuid references public.textos_base (id) on delete set null,
  enunciado text not null,
  alternativas jsonb,
  gabarito text not null,
  justificativa text not null default '',
  citacao text,
  fonte_id uuid references public.fontes (id),
  origem text not null check (origem in ('real', 'ia')),
  prova_origem text,
  status text not null default 'pendente'
    check (status in ('pendente', 'revisao', 'aprovado', 'suspeito', 'descartado')),
  dificuldade smallint check (dificuldade between 1 and 3),
  hash_normalizado text not null unique,
  validacao jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_gabarito_formato check (
    (formato = 'certo_errado' and gabarito in ('C', 'E') and alternativas is null)
    or (formato = 'multipla_escolha' and gabarito in ('A', 'B', 'C', 'D', 'E') and alternativas is not null)
  )
);
create index itens_status_idx on public.itens (status);

create table public.item_topicos (
  item_id uuid not null references public.itens (id) on delete cascade,
  topico_canonico_id uuid not null references public.topicos_canonicos (id),
  primary key (item_id, topico_canonico_id)
);
create index item_topicos_canonico_idx on public.item_topicos (topico_canonico_id);

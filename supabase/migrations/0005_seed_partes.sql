-- Área de apoio para carregar editais grandes em partes pelo MCP do Supabase,
-- conferindo o md5 de cada parte antes de chamar carregar_edital.
create table public.seed_partes (
  lote text not null,
  parte integer not null,
  conteudo text not null,
  criado_em timestamptz not null default now(),
  primary key (lote, parte)
);
alter table public.seed_partes enable row level security;


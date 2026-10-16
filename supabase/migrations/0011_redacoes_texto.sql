-- Texto digitado da redação, como o usuário escreveu (com os parágrafos). As linhas da folha
-- (linhas/excedente) são derivadas dele no servidor; na entrada por foto, o texto fica vazio.
alter table public.redacoes add column texto text not null default '';
grant update (texto) on public.redacoes to authenticated;

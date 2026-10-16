-- Detalhes da nota consolidada da redação, para a tela de resultado:
-- {aspectos: [{codigo, descricao, pontos, nota}], usadas: [papel, papel], erros_descartados}.
alter table public.redacoes add column detalhes jsonb;

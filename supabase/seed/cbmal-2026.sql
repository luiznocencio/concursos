begin;
insert into public.bancas (slug, nome) values ('cebraspe', 'cebraspe') on conflict (slug) do nothing;
insert into public.concursos (slug, nome, banca_id, data_prova, ressalvas, editais_fonte)
values ('cbmal-2026', 'Concurso CBM-AL 2026 — CFO e CFP', (select id from public.bancas where slug = 'cebraspe'), '2027-01-24', array['Item 19 retificado no Edital nº 2 sem texto publicado; conteúdo baseado no Edital nº 1.', 'Data da prova 24/01/2027 segundo noticiário; sem ato oficial no repositório.', 'Distribuição de itens por disciplina estimada; o edital não a informa.']::text[], array['edital-01-abertura.pdf', 'edital-02-retificacao.pdf', 'portaria-cbmal-185-2026-taf.pdf']::text[])
on conflict (slug) do update set nome = excluded.nome, banca_id = excluded.banca_id, data_prova = excluded.data_prova,
  ressalvas = excluded.ressalvas, editais_fonte = excluded.editais_fonte, atualizado_em = now();
insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'cfo', 'Oficial de Estado-Maior', '{}'::text[], 270, '{"provas":["p1-gerais","p2-cfo"],"corte":{"regra":"piso_fator","fator":0.3}}'::jsonb)
on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
  duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;
insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'soldado', 'Soldado', array['QPBM/1', 'QPBM/2']::text[], 270, '{"provas":["p1-gerais","p2-soldado"],"corte":{"regra":"piso_fator","fator":0.3}}'::jsonb)
on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
  duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;
insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'p1-gerais', 'P1 – Conhecimentos gerais', 'objetiva', 'certo_errado', 50, null, '{"regra":"certo_errado_penalidade"}'::jsonb, '{"regra":"piso_fator","fator":0.2}'::jsonb, '{"estimada":true,"disciplinas":{"lp":12,"ingles":5,"informatica":6,"matematica":6,"rlm":7,"legislacao-cbmal":8,"cidadania-dh":6}}'::jsonb, null)
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'p2-cfo', 'P2 – Conhecimentos específicos (CFO)', 'objetiva', 'certo_errado', 70, null, '{"regra":"certo_errado_penalidade"}'::jsonb, '{"regra":"piso_fator","fator":0.3}'::jsonb, '{"estimada":true,"disciplinas":{"fisica-cfo":16,"quimica-cfo":16,"biologia-cfo":14,"direito-administrativo":12,"direito-constitucional":12}}'::jsonb, null)
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'p2-soldado', 'P2 – Conhecimentos específicos (Soldado)', 'objetiva', 'certo_errado', 70, null, '{"regra":"certo_errado_penalidade"}'::jsonb, '{"regra":"piso_fator","fator":0.3}'::jsonb, '{"estimada":true,"disciplinas":{"fisica-soldado":18,"quimica-soldado":18,"biologia-soldado":18,"mecanica-geral":16}}'::jsonb, null)
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values ((select id from public.concursos where slug = 'cbmal-2026'), 'discursiva', 'P3 – Prova discursiva', 'discursiva', null, null, null, null, null, null, '{"pontuacao_maxima":30,"linhas_max":30,"nota_minima":15}'::jsonb)
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
delete from public.cargo_provas where cargo_id in (select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026'));
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cfo'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), 0);
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cfo'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), 1);
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cfo'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'discursiva'), 2);
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'soldado'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), 0);
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'soldado'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-soldado'), 1);
insert into public.cargo_provas (cargo_id, prova_id, ordem) values ((select id from public.cargos where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'soldado'), (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'discursiva'), 2);
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'lp', 'Língua Portuguesa')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'ingles', 'Língua Inglesa')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'informatica', 'Noções de Informática')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'matematica', 'Matemática')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'rlm', 'Raciocínio Lógico e Analítico')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'legislacao-cbmal', 'Legislação pertinente ao CBMAL')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'cidadania-dh', 'Cidadania e Direitos Humanos')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'atualidades', 'Atualidades')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'fisica-cfo', 'Física (CFO)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'quimica-cfo', 'Química (CFO)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'biologia-cfo', 'Biologia (CFO)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'direito-administrativo', 'Noções de Direito Administrativo')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'direito-constitucional', 'Noções de Direito Constitucional')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'fisica-soldado', 'Física (Soldado)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'quimica-soldado', 'Química (Soldado)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'biologia-soldado', 'Biologia (Soldado)')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos where slug = 'cbmal-2026'), 'mecanica-geral', 'Mecânica Geral')
on conflict (concurso_id, slug) do update set nome = excluded.nome;
delete from public.prova_disciplinas where prova_id in (select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026'));
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), 0);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'ingles'), 1);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), 2);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), 3);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), 4);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), 5);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p1-gerais'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), 6);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), 0);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), 1);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), 2);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), 3);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-cfo'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), 4);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-soldado'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), 0);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-soldado'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 1);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-soldado'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), 2);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'p2-soldado'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), 3);
insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values ((select id from public.provas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'discursiva'), (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'atualidades'), 0);
insert into public.topicos_canonicos (slug, titulo) values ('portugues/interpretacao-de-textos', 'Compreensão e interpretação de textos de gêneros variados') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/tipos-e-generos-textuais', 'Reconhecimento de tipos e gêneros textuais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/ortografia', 'Domínio da ortografia oficial') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/coesao-referenciacao-conectores', 'Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/tempos-e-modos-verbais', 'Emprego de tempos e modos verbais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/classes-de-palavras', 'Emprego das classes de palavras') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/coordenacao', 'Relações de coordenação entre orações e entre termos da oração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/subordinacao', 'Relações de subordinação entre orações e entre termos da oração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/pontuacao', 'Emprego dos sinais de pontuação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/concordancia-verbal-e-nominal', 'Concordância verbal e nominal') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/regencia-verbal-e-nominal', 'Regência verbal e nominal') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Emprego do sinal indicativo de crase') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/colocacao-pronominal', 'Colocação dos pronomes átonos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/significacao-das-palavras', 'Significação das palavras') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/substituicao-de-palavras-e-trechos', 'Substituição de palavras ou de trechos de texto') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/reorganizacao-de-oracoes-e-periodos', 'Reorganização da estrutura de orações e de períodos do texto') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('portugues/reescrita-e-niveis-de-formalidade', 'Reescrita de textos de diferentes gêneros e níveis de formalidade') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and codigo <> all (array['1', '2', '3', '4', '4.1', '4.2', '5', '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '6', '6.1', '6.2', '6.3', '6.4']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '1', 'Compreensão e interpretação de textos de gêneros variados', null, (select id from public.topicos_canonicos where slug = 'portugues/interpretacao-de-textos'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '2', 'Reconhecimento de tipos e gêneros textuais', null, (select id from public.topicos_canonicos where slug = 'portugues/tipos-e-generos-textuais'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '3', 'Domínio da ortografia oficial', null, (select id from public.topicos_canonicos where slug = 'portugues/ortografia'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '4', 'Domínio dos mecanismos de coesão textual', null, null, 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '4.1', 'Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'portugues/coesao-referenciacao-conectores'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '4.2', 'Emprego de tempos e modos verbais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'portugues/tempos-e-modos-verbais'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5', 'Domínio da estrutura morfossintática do período', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.1', 'Emprego das classes de palavras', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/classes-de-palavras'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.2', 'Relações de coordenação entre orações e entre termos da oração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/coordenacao'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.3', 'Relações de subordinação entre orações e entre termos da oração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/subordinacao'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.4', 'Emprego dos sinais de pontuação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/pontuacao'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.5', 'Concordância verbal e nominal', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/concordancia-verbal-e-nominal'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.6', 'Regência verbal e nominal', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/regencia-verbal-e-nominal'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.7', 'Emprego do sinal indicativo de crase', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/crase'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '5.8', 'Colocação dos pronomes átonos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'portugues/colocacao-pronominal'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '6', 'Reescrita de frases e parágrafos do texto', null, null, 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '6.1', 'Significação das palavras', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'portugues/significacao-das-palavras'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '6.2', 'Substituição de palavras ou de trechos de texto', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'portugues/substituicao-de-palavras-e-trechos'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '6.3', 'Reorganização da estrutura de orações e de períodos do texto', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'portugues/reorganizacao-de-oracoes-e-periodos'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp'), '6.4', 'Reescrita de textos de diferentes gêneros e níveis de formalidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'lp') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'portugues/reescrita-e-niveis-de-formalidade'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('ingles/compreensao-de-textos', 'Compreensão de textos em língua inglesa') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('ingles/gramatica-para-compreensao', 'Itens gramaticais relevantes para a compreensão dos conteúdos semânticos') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'ingles') and codigo <> all (array['1', '2']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'ingles'), '1', 'Compreensão de textos em língua inglesa', null, (select id from public.topicos_canonicos where slug = 'ingles/compreensao-de-textos'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'ingles'), '2', 'Itens gramaticais relevantes para a compreensão dos conteúdos semânticos', null, (select id from public.topicos_canonicos where slug = 'ingles/gramatica-para-compreensao'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/sistemas-operacionais-linux-windows', 'Noções de sistema operacional (ambientes Linux e Windows)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/editores-planilhas-apresentacoes', 'Edição de textos, planilhas e apresentações (ambientes Microsoft Office e BrOffice)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/internet-e-intranet', 'Conceitos básicos, ferramentas, aplicativos e procedimentos de Internet e intranet') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/navegadores', 'Programas de navegação (Microsoft Edge, Mozilla Firefox e Google Chrome)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/correio-eletronico', 'Programas de correio eletrônico (Outlook Express e Mozilla Thunderbird)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/busca-e-pesquisa-na-internet', 'Sítios de busca e pesquisa na Internet') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/grupos-de-discussao', 'Grupos de discussão') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/redes-sociais', 'Redes sociais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/computacao-em-nuvem', 'Computação na nuvem (cloud computing)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/arquivos-pastas-e-programas', 'Conceitos de organização e de gerenciamento de informações, arquivos, pastas e programas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/procedimentos-de-seguranca', 'Procedimentos de segurança') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/virus-worms-e-pragas-virtuais', 'Noções de vírus, worms e pragas virtuais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/aplicativos-de-seguranca', 'Aplicativos para segurança (antivírus, firewall, anti-spyware etc.)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/backup', 'Procedimentos de backup') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('informatica/armazenamento-em-nuvem', 'Armazenamento de dados na nuvem (cloud storage)') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and codigo <> all (array['1', '2', '3', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '4', '5', '5.1', '5.2', '5.3', '5.4', '5.5']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '1', 'Noções de sistema operacional (ambientes Linux e Windows)', null, (select id from public.topicos_canonicos where slug = 'informatica/sistemas-operacionais-linux-windows'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '2', 'Edição de textos, planilhas e apresentações (ambientes Microsoft Office e BrOffice)', null, (select id from public.topicos_canonicos where slug = 'informatica/editores-planilhas-apresentacoes'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3', 'Redes de computadores', null, null, 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.1', 'Conceitos básicos, ferramentas, aplicativos e procedimentos de Internet e intranet', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/internet-e-intranet'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.2', 'Programas de navegação (Microsoft Edge, Mozilla Firefox e Google Chrome)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/navegadores'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.3', 'Programas de correio eletrônico (Outlook Express e Mozilla Thunderbird)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/correio-eletronico'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.4', 'Sítios de busca e pesquisa na Internet', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/busca-e-pesquisa-na-internet'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.5', 'Grupos de discussão', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/grupos-de-discussao'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.6', 'Redes sociais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/redes-sociais'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '3.7', 'Computação na nuvem (cloud computing)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'informatica/computacao-em-nuvem'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '4', 'Conceitos de organização e de gerenciamento de informações, arquivos, pastas e programas', null, (select id from public.topicos_canonicos where slug = 'informatica/arquivos-pastas-e-programas'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5', 'Segurança da informação', null, null, 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5.1', 'Procedimentos de segurança', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'informatica/procedimentos-de-seguranca'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5.2', 'Noções de vírus, worms e pragas virtuais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'informatica/virus-worms-e-pragas-virtuais'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5.3', 'Aplicativos para segurança (antivírus, firewall, anti-spyware etc.)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'informatica/aplicativos-de-seguranca'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5.4', 'Procedimentos de backup', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'informatica/backup'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica'), '5.5', 'Armazenamento de dados na nuvem (cloud storage)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'informatica') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'informatica/armazenamento-em-nuvem'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/operacoes-com-numeros', 'Conjunto numérico: operações com números inteiros, fracionários e decimais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/proporcoes-e-divisao-proporcional', 'Proporções e divisão proporcional') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/regra-de-tres', 'Regras de três simples e composta') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/porcentagem', 'Porcentagem') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/juros-capitalizacao-e-descontos', 'Juros simples e compostos; capitalização e descontos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('matematica/taxas-de-juros', 'Taxas de juros: nominal, efetiva, equivalente, proporcional, real e aparente') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica') and codigo <> all (array['1', '1.1', '2', '3', '4', '5', '6']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '1', 'Álgebra linear', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '1.1', 'Conjunto numérico: operações com números inteiros, fracionários e decimais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'matematica/operacoes-com-numeros'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '2', 'Proporções e divisão proporcional', null, (select id from public.topicos_canonicos where slug = 'matematica/proporcoes-e-divisao-proporcional'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '3', 'Regras de três simples e composta', null, (select id from public.topicos_canonicos where slug = 'matematica/regra-de-tres'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '4', 'Porcentagem', null, (select id from public.topicos_canonicos where slug = 'matematica/porcentagem'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '5', 'Juros simples e compostos; capitalização e descontos', null, (select id from public.topicos_canonicos where slug = 'matematica/juros-capitalizacao-e-descontos'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'matematica'), '6', 'Taxas de juros: nominal, efetiva, equivalente, proporcional, real e aparente', null, (select id from public.topicos_canonicos where slug = 'matematica/taxas-de-juros'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/proposicoes-simples-e-compostas', 'Proposições simples e compostas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/tabelas-verdade', 'Tabelas verdade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/equivalencias-logicas', 'Equivalências') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/estrutura-logica-de-relacoes', 'Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios; dedução de novas informações das relações fornecidas e avaliação das condições usadas para estabelecer a estrutura daquelas relações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/logica-de-situacoes', 'Compreensão e análise da lógica de uma situação, utilizando as funções intelectuais: raciocínio verbal, raciocínio matemático, raciocínio sequencial, reconhecimento de padrões, orientação espacial e temporal, formação de conceitos, discriminação de elementos; compreensão de dados apresentados em gráficos e tabelas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/contagem-e-probabilidade', 'Problemas de contagem e noções de probabilidade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/falacias', 'Falácias') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('raciocinio-logico/nocoes-de-estatistica', 'Noções de estatística: média, moda, mediana e desvio-padrão') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm') and codigo <> all (array['1', '1.1', '1.2', '1.3', '2', '3', '4', '4.1', '5', '6']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '1', 'Lógica sentencial (ou proposicional)', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '1.1', 'Proposições simples e compostas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'raciocinio-logico/proposicoes-simples-e-compostas'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '1.2', 'Tabelas verdade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'raciocinio-logico/tabelas-verdade'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '1.3', 'Equivalências', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'raciocinio-logico/equivalencias-logicas'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '2', 'Estrutura lógica de relações arbitrárias entre pessoas, lugares, objetos ou eventos fictícios; dedução de novas informações das relações fornecidas e avaliação das condições usadas para estabelecer a estrutura daquelas relações', null, (select id from public.topicos_canonicos where slug = 'raciocinio-logico/estrutura-logica-de-relacoes'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '3', 'Compreensão e análise da lógica de uma situação, utilizando as funções intelectuais: raciocínio verbal, raciocínio matemático, raciocínio sequencial, reconhecimento de padrões, orientação espacial e temporal, formação de conceitos, discriminação de elementos; compreensão de dados apresentados em gráficos e tabelas', null, (select id from public.topicos_canonicos where slug = 'raciocinio-logico/logica-de-situacoes'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '4', 'Problemas de lógica e raciocínio', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '4.1', 'Problemas de contagem e noções de probabilidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'raciocinio-logico/contagem-e-probabilidade'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '5', 'Falácias', null, (select id from public.topicos_canonicos where slug = 'raciocinio-logico/falacias'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'rlm'), '6', 'Noções de estatística: média, moda, mediana e desvio-padrão', null, (select id from public.topicos_canonicos where slug = 'raciocinio-logico/nocoes-de-estatistica'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('legislacao-cbmal/lei-5346-1992-estatuto', 'Lei Estadual nº 5.346/1992 (dispõe sobre o Estatuto dos Policiais Militares do Estado de Alagoas e dá outras providências) e suas alterações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('legislacao-cbmal/decreto-37042-1996-regulamento-disciplinar', 'Decreto estadual nº 37.042/1996 (Regulamento Disciplinar da Polícia Militar de Alagoas)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('legislacao-cbmal/lei-6514-2004-promocao-oficiais', 'Lei Estadual nº 6.514/2004 (dispõe sobre os critérios e as condições que asseguram aos Oficiais e Praças da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('legislacao-cbmal/lei-6544-2004-promocao-pracas', 'Lei Estadual nº 6.544/2004 (dispõe sobre os critérios e as condições que asseguram aos Soldados, Cabos e Subtenentes da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('legislacao-cbmal/lei-14751-2023-lei-organica-militares', 'Lei Federal nº 14.751/2023') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal') and codigo <> all (array['1', '2', '3', '4', '5']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), '1', 'Lei Estadual nº 5.346/1992 (dispõe sobre o Estatuto dos Policiais Militares do Estado de Alagoas e dá outras providências) e suas alterações', null, (select id from public.topicos_canonicos where slug = 'legislacao-cbmal/lei-5346-1992-estatuto'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), '2', 'Decreto estadual nº 37.042/1996 (Regulamento Disciplinar da Polícia Militar de Alagoas)', null, (select id from public.topicos_canonicos where slug = 'legislacao-cbmal/decreto-37042-1996-regulamento-disciplinar'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), '3', 'Lei Estadual nº 6.514/2004 (dispõe sobre os critérios e as condições que asseguram aos Oficiais e Praças da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações', null, (select id from public.topicos_canonicos where slug = 'legislacao-cbmal/lei-6514-2004-promocao-oficiais'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), '4', 'Lei Estadual nº 6.544/2004 (dispõe sobre os critérios e as condições que asseguram aos Soldados, Cabos e Subtenentes da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações', null, (select id from public.topicos_canonicos where slug = 'legislacao-cbmal/lei-6544-2004-promocao-pracas'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'legislacao-cbmal'), '5', 'Lei Federal nº 14.751/2023', null, (select id from public.topicos_canonicos where slug = 'legislacao-cbmal/lei-14751-2023-lei-organica-militares'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/etica-e-moral', 'Ética e moral') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/etica-principios-e-valores', 'Ética, princípios e valores') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/etica-democracia-e-cidadania', 'Ética e democracia: exercício da cidadania') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/etica-e-funcao-publica', 'Ética e função pública') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/etica-no-setor-publico', 'Ética no setor público') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/teoria-geral-direitos-humanos', 'Conceito, terminologia, estrutura normativa, fundamentação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/afirmacao-historica-direitos-humanos', 'Afirmação histórica dos direitos humanos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('cidadania-dh/direitos-humanos-responsabilidade-estado', 'Direitos humanos e responsabilidade do Estado') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh') and codigo <> all (array['1', '2', '3', '4', '5', '6', '6.1', '7', '8']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '1', 'Ética e moral', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/etica-e-moral'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '2', 'Ética, princípios e valores', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/etica-principios-e-valores'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '3', 'Ética e democracia: exercício da cidadania', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/etica-democracia-e-cidadania'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '4', 'Ética e função pública', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/etica-e-funcao-publica'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '5', 'Ética no setor público', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/etica-no-setor-publico'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '6', 'Teoria geral dos direitos humanos', null, null, 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '6.1', 'Conceito, terminologia, estrutura normativa, fundamentação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'cidadania-dh/teoria-geral-direitos-humanos'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '7', 'Afirmação histórica dos direitos humanos', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/afirmacao-historica-direitos-humanos'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'cidadania-dh'), '8', 'Direitos humanos e responsabilidade do Estado', null, (select id from public.topicos_canonicos where slug = 'cidadania-dh/direitos-humanos-responsabilidade-estado'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('atualidades/temas-atuais', 'Tópicos relevantes e atuais de diversas áreas, tais como segurança, transportes, política, economia, sociedade, educação, saúde, cultura, tecnologia, energia, relações internacionais, desenvolvimento sustentável e ecologia') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'atualidades') and codigo <> all (array['1']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'atualidades'), '1', 'Tópicos relevantes e atuais de diversas áreas, tais como segurança, transportes, política, economia, sociedade, educação, saúde, cultura, tecnologia, energia, relações internacionais, desenvolvimento sustentável e ecologia', null, (select id from public.topicos_canonicos where slug = 'atualidades/temas-atuais'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/cosmologia-antiga', 'Cosmologia antiga') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/fisica-de-aristoteles', 'A física de Aristóteles') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/origens-da-mecanica', 'Origens da mecânica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/surgimento-relatividade-e-quantica', 'Surgimento da teoria da relatividade e da teoria quântica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/cinematica-escalar-e-vetorial', 'Cinemática escalar, cinemática vetorial') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/movimento-circular', 'Movimento circular') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/leis-de-newton', 'Leis de Newton e suas aplicações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/trabalho', 'Trabalho') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/potencia', 'Potência') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/energia-conservacao-e-impulso', 'Energia: conservação e suas transformações, impulso') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/quantidade-de-movimento', 'Quantidade de movimento e conservação da quantidade de movimento') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/gravitacao-universal', 'Gravitação universal') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/estatica-dos-corpos-rigidos', 'Estática dos corpos rígidos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/estatica-dos-fluidos', 'Estática dos fluidos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/principios-pascal-arquimedes-stevin', 'Princípios de Pascal, Arquimedes e Stevin') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/calor-e-temperatura', 'Calor e temperatura') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/temperatura-e-dilatacao-termica', 'Temperatura e dilatação térmica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/calor-especifico', 'Calor específico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/trocas-de-calor', 'Trocas de calor') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/mudancas-de-fase', 'Mudanças de fase e diagramas de fases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/propagacao-do-calor', 'Propagação do calor') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/teoria-cinetica-dos-gases', 'Teoria cinética dos gases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/energia-interna', 'Energia interna') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/lei-de-joule', 'Lei de Joule') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/transformacoes-gasosas', 'Transformações gasosas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/leis-da-termodinamica', 'Leis da termodinâmica; entropia e entalpia') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/maquinas-termicas', 'Máquinas térmicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/ciclo-de-carnot', 'Ciclo de Carnot') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/nocoes-de-eletricidade', 'Noções de eletricidade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/campo-eletrico', 'Campo elétrico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/lei-de-gauss', 'Lei de Gauss') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/potencial-eletrico', 'Potencial elétrico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/corrente-eletrica', 'Corrente elétrica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/potencia-eletrica-e-resistores', 'Potência elétrica e resistores') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/circuitos-eletricos', 'Circuitos elétricos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/campo-magnetico', 'Campo magnético') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/lei-de-ampere', 'Lei de Ampère') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/lei-de-faraday', 'Lei de Faraday') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/propriedades-eletricas-magneticas-materiais', 'Propriedades elétricas e magnéticas dos materiais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/equacoes-de-maxwell', 'Equações de Maxwell') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/radiacao-eletromagnetica', 'Radiação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/movimento-harmonico-simples', 'Movimento harmônico simples') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/oscilacoes-livres-amortecidas-forcadas', 'Oscilações livres, amortecidas e forçadas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/ondas', 'Ondas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/ondas-sonoras-e-eletromagneticas', 'Ondas sonoras e eletromagnéticas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/frequencias-naturais-e-ressonancia', 'Frequências naturais e ressonância') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/optica-geometrica-reflexao-refracao', 'Óptica geométrica; reflexão e refração da luz') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/instrumentos-opticos', 'Instrumentos ópticos: características e aplicações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/interferencia', 'Interferência') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/difracao', 'Difração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/polarizacao', 'Polarização') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/relatividade-especial', 'Noções de relatividade especial') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/transformacao-de-lorentz', 'Transformação de Lorentz') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/equivalencia-massa-energia', 'Equivalência massa-energia') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/dualidade-onda-particula', 'Natureza ondulatória-corpuscular da matéria') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/teoria-quantica-materia-radiacao', 'Teoria quântica da matéria e da radiação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/modelo-atomo-de-hidrogenio', 'Modelo do átomo de hidrogênio') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/nucleo-atomico', 'Núcleo atômico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/energia-nuclear', 'Energia nuclear') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and codigo <> all (array['1', '1.1', '1.2', '1.3', '1.4', '2', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '2.10', '2.11', '3', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12', '3.13', '4', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', '4.13', '5', '5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7', '5.8', '5.8.1', '5.8.2', '5.8.3', '6', '6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '1', 'História e evolução das ideias da física', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '1.1', 'Cosmologia antiga', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/cosmologia-antiga'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '1.2', 'A física de Aristóteles', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/fisica-de-aristoteles'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '1.3', 'Origens da mecânica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/origens-da-mecanica'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '1.4', 'Surgimento da teoria da relatividade e da teoria quântica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/surgimento-relatividade-e-quantica'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2', 'Mecânica', null, null, 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.1', 'Cinemática escalar, cinemática vetorial', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/cinematica-escalar-e-vetorial'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.2', 'Movimento circular', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/movimento-circular'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.3', 'Leis de Newton e suas aplicações', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/leis-de-newton'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.4', 'Trabalho', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/trabalho'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.5', 'Potência', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/potencia'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.6', 'Energia: conservação e suas transformações, impulso', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/energia-conservacao-e-impulso'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.7', 'Quantidade de movimento e conservação da quantidade de movimento', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/quantidade-de-movimento'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.8', 'Gravitação universal', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/gravitacao-universal'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.9', 'Estática dos corpos rígidos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/estatica-dos-corpos-rigidos'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.10', 'Estática dos fluidos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/estatica-dos-fluidos'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '2.11', 'Princípios de Pascal, Arquimedes e Stevin', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/principios-pascal-arquimedes-stevin'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3', 'Termodinâmica', null, null, 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.1', 'Calor e temperatura', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/calor-e-temperatura'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.2', 'Temperatura e dilatação térmica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/temperatura-e-dilatacao-termica'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.3', 'Calor específico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/calor-especifico'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.4', 'Trocas de calor', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/trocas-de-calor'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.5', 'Mudanças de fase e diagramas de fases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/mudancas-de-fase'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.6', 'Propagação do calor', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/propagacao-do-calor'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.7', 'Teoria cinética dos gases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/teoria-cinetica-dos-gases'), 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.8', 'Energia interna', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/energia-interna'), 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.9', 'Lei de Joule', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/lei-de-joule'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.10', 'Transformações gasosas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/transformacoes-gasosas'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.11', 'Leis da termodinâmica; entropia e entalpia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/leis-da-termodinamica'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.12', 'Máquinas térmicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/maquinas-termicas'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '3.13', 'Ciclo de Carnot', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/ciclo-de-carnot'), 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4', 'Eletromagnetismo', null, null, 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.1', 'Noções de eletricidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/nocoes-de-eletricidade'), 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.2', 'Campo elétrico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/campo-eletrico'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.3', 'Lei de Gauss', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/lei-de-gauss'), 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.4', 'Potencial elétrico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/potencial-eletrico'), 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.5', 'Corrente elétrica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/corrente-eletrica'), 36)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.6', 'Potência elétrica e resistores', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/potencia-eletrica-e-resistores'), 37)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.7', 'Circuitos elétricos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/circuitos-eletricos'), 38)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.8', 'Campo magnético', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/campo-magnetico'), 39)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.9', 'Lei de Ampère', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/lei-de-ampere'), 40)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.10', 'Lei de Faraday', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/lei-de-faraday'), 41)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.11', 'Propriedades elétricas e magnéticas dos materiais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/propriedades-eletricas-magneticas-materiais'), 42)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.12', 'Equações de Maxwell', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/equacoes-de-maxwell'), 43)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '4.13', 'Radiação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/radiacao-eletromagnetica'), 44)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5', 'Ondulatória', null, null, 45)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.1', 'Movimento harmônico simples', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/movimento-harmonico-simples'), 46)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.2', 'Oscilações livres, amortecidas e forçadas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/oscilacoes-livres-amortecidas-forcadas'), 47)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.3', 'Ondas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/ondas'), 48)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.4', 'Ondas sonoras e eletromagnéticas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/ondas-sonoras-e-eletromagneticas'), 49)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.5', 'Frequências naturais e ressonância', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/frequencias-naturais-e-ressonancia'), 50)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.6', 'Óptica geométrica; reflexão e refração da luz', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/optica-geometrica-reflexao-refracao'), 51)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.7', 'Instrumentos ópticos: características e aplicações', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/instrumentos-opticos'), 52)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.8', 'Óptica física', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5'), null, 53)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.8.1', 'Interferência', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5.8'), (select id from public.topicos_canonicos where slug = 'fisica/interferencia'), 54)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.8.2', 'Difração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5.8'), (select id from public.topicos_canonicos where slug = 'fisica/difracao'), 55)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '5.8.3', 'Polarização', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '5.8'), (select id from public.topicos_canonicos where slug = 'fisica/polarizacao'), 56)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6', 'Física moderna', null, null, 57)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.1', 'Noções de relatividade especial', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/relatividade-especial'), 58)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.2', 'Transformação de Lorentz', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/transformacao-de-lorentz'), 59)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.3', 'Equivalência massa-energia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/equivalencia-massa-energia'), 60)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.4', 'Natureza ondulatória-corpuscular da matéria', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/dualidade-onda-particula'), 61)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.5', 'Teoria quântica da matéria e da radiação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/teoria-quantica-materia-radiacao'), 62)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.6', 'Modelo do átomo de hidrogênio', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/modelo-atomo-de-hidrogenio'), 63)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.7', 'Núcleo atômico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/nucleo-atomico'), 64)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo'), '6.8', 'Energia nuclear', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/energia-nuclear'), 65)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/historia-e-importancia-da-quimica', 'O mundo e suas transformações: história e importância da química') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/modelos-atomicos', 'Modelos atômicos (Dalton, Thomson, Rutherford e Bohr) e evolução dos conceitos de átomo') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/trabalhos-de-faraday', 'Os trabalhos de Faraday') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/leis-ponderais', 'Leis ponderais (Lavoisier, Proust, Dalton e Richter-Wenzel-Berzelius)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/leis-volumetricas-de-gay-lussac', 'Leis volumétricas de Gay-Lussac') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/lei-de-avogadro', 'Lei de Avogadro') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/mol-massa-molar-volume-molar', 'Conceitos decorrentes da teoria atômico-molecular: unidade de massa atômica (u), quantidade de matéria, massa molar, volume molar') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/formulas-quimicas', 'Fórmulas químicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/estequiometria', 'Cálculos estequiométricos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/tabela-periodica-historico', 'Tabela periódica: histórico e evolução') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/classificacao-dos-elementos', 'Classificação dos elementos em metais, não metais, semimetais e gases nobres') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/configuracao-eletronica', 'Configuração eletrônica dos elementos ao longo da tabela periódica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/propriedades-periodicas', 'Propriedades periódicas e aperiódicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/emissoes-radioativas', 'Natureza das emissões radioativas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/leis-da-radioatividade', 'Leis da radioatividade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/cinetica-da-desintegracao-radioativa', 'Cinética da desintegração radioativa') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/fissao-e-fusao-nuclear', 'Fenômenos de fissão nuclear e fusão nuclear') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/riscos-e-aplicacoes-reacoes-nucleares', 'Riscos e aplicações das reações nucleares') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/ligacoes-ionica-covalente-metalica', 'Ligações iônica, covalente e metálica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/forcas-intermoleculares', 'Forças intermoleculares') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/geometria-molecular-e-polaridade', 'Geometria molecular: eletronegatividade e polaridade das ligações e das moléculas, teoria da repulsão dos pares eletrônicos, teoria da ligação de valência e sobreposição de orbitais, orbitais híbridos e moleculares') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/estrutura-e-propriedades-das-substancias', 'Relação entre estrutura e propriedade das substâncias químicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/estados-da-materia', 'Sólidos, líquidos, gases e outros estados da matéria (ideais e reais)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/propriedades-de-gases-liquidos-solidos', 'Características e propriedades de gases, líquidos e sólidos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/ligacoes-nos-estados-fisicos', 'Ligações químicas nos sólidos, líquidos e gases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/separacao-de-misturas', 'Métodos de separação de misturas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/acidos-bases-sais-oxidos', 'Ácidos, bases, sais e óxidos: conceito, propriedades e nomenclatura') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/hidretos-carbetos-nitretos', 'Hidretos, carbetos e nitretos: conceito, propriedades e nomenclatura') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacoes-inorganicas', 'Principais reações envolvendo compostos inorgânicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/balanceamento-de-equacoes', 'Balanceamento de equações químicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/concentracao-de-solucoes', 'Relações de proporcionalidade entre solutos e solvente: concentração em quantidade de matéria, concentração em massa, fração em quantidade de matéria, fração em massa, fração em volume, densidade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/grandezas-e-unidades-si', 'Grandezas-padrão e unidades-padrão (SI) e sua relação com outras grandezas e unidades') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/solubilidade', 'Solubilidade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/propriedades-coligativas', 'Propriedades coligativas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/teoria-cinetica-dos-gases', 'Teoria cinética') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/leis-dos-gases', 'Leis dos gases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/densidade-dos-gases', 'Densidade dos gases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/difusao-e-efusao', 'Difusão e efusão dos gases') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/misturas-gasosas', 'Misturas gasosas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/energia-e-calor', 'Energia e calor') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacoes-exotermicas-endotermicas', 'Reações exotérmicas e endotérmicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/entalpia-entropia-energia-livre', 'Entalpia, entropia e energia livre') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/espontaneidade-de-reacoes', 'Espontaneidade de uma reação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/entalpias-de-formacao-e-combustao', 'Entalpias de formação e de combustão das substâncias') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/calor-de-reacao', 'Calor de reação em pressão constante e em volume constante') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/lei-de-hess', 'Lei de Hess') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/velocidade-e-mecanismos-de-reacao', 'Velocidades e mecanismos de reação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/equacao-de-velocidade-e-colisoes', 'Equação de velocidade, teoria das colisões e complexo ativado') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/fatores-da-velocidade-de-reacao', 'Influência da energia, da concentração, da pressão e dos catalisadores na velocidade das reações químicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/equilibrio-ionico-e-constante', 'Equilíbrio iônico em soluções aquosas, constante de equilíbrio') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/equilibrio-acido-base-e-ph', 'Equilíbrio ácido-base, hidrólise de sais, solução tampão, conceitos de Ka, Kb, Kh, pH, pOH e graus de dissociação e de hidrólise') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/equilibrio-de-precipitacao-kps', 'Equilíbrio de precipitação, conceito de Kps') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/deslocamento-do-equilibrio', 'Deslocamento do equilíbrio') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/lei-da-diluicao-de-ostwald', 'Lei da diluição de Ostwald') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/efeito-do-ion-comum', 'Efeito do íon comum') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/lei-da-acao-das-massas', 'Lei da ação das massas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/potenciais-de-reducao', 'Potenciais de redução e potenciais-padrão de redução') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/espontaneidade-de-oxirreducao', 'Espontaneidade de uma reação de oxirredução') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/pilhas-e-acumuladores', 'Pilhas e acumuladores') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/eletrolise', 'Eletrólise') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/atomo-de-carbono-e-radicais-organicos', 'Propriedades fundamentais do átomo de carbono, hibridação, estados de oxidação do carbono, ligações σ e π, geometria molecular, classificação do átomo de carbono na cadeia carbônica, notação e nomenclatura dos principais radicais orgânicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/funcoes-organicas-nomenclatura-e-propriedades', 'Notação, nomenclatura e propriedades físicas e químicas de hidrocarbonetos, haletos orgânicos, álcoois, fenóis, éteres, cetonas, aldeídos, ácidos carboxílicos, ésteres, anidridos, haletos de ácido, aminas, amidas, nitrilas, isonitrilas e nitrocompostos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacoes-organicas', 'Reatividade dos compostos orgânicos, reações de redução, oxidação, combustão, adição e substituição') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/biomoleculas', 'Glicídeos, lipídeos, aminoácidos, proteínas, ácidos nucleicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/tecnologias-da-quimica-organica', 'Tecnologias associadas à química orgânica: petroquímica, polímeros sintéticos, aditivos em alimentos, agroquímica, drogas, medicamentos e biotecnologia') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and codigo <> all (array['1', '2', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '3', '3.1', '3.2', '3.3', '3.4', '4', '4.1', '4.2', '4.3', '4.4', '4.5', '5', '5.1', '5.2', '5.3', '5.4', '6', '6.1', '6.2', '6.3', '6.4', '7', '7.1', '7.2', '7.3', '7.4', '8', '8.1', '8.2', '8.3', '8.4', '9', '9.1', '9.2', '9.3', '9.4', '9.5', '10', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7', '11', '11.1', '11.2', '11.3', '12', '12.1', '12.2', '12.3', '12.4', '12.5', '12.6', '12.7', '13', '13.1', '13.2', '13.3', '13.4', '14', '14.1', '14.2', '14.3', '14.4', '14.5']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '1', 'O mundo e suas transformações: história e importância da química', null, (select id from public.topicos_canonicos where slug = 'quimica/historia-e-importancia-da-quimica'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2', 'Teoria atômico-molecular', null, null, 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.1', 'Modelos atômicos (Dalton, Thomson, Rutherford e Bohr) e evolução dos conceitos de átomo', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/modelos-atomicos'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.2', 'Os trabalhos de Faraday', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/trabalhos-de-faraday'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.3', 'Leis ponderais (Lavoisier, Proust, Dalton e Richter-Wenzel-Berzelius)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/leis-ponderais'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.4', 'Leis volumétricas de Gay-Lussac', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/leis-volumetricas-de-gay-lussac'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.5', 'Lei de Avogadro', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/lei-de-avogadro'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.6', 'Conceitos decorrentes da teoria atômico-molecular: unidade de massa atômica (u), quantidade de matéria, massa molar, volume molar', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/mol-massa-molar-volume-molar'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.7', 'Fórmulas químicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/formulas-quimicas'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '2.8', 'Cálculos estequiométricos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'quimica/estequiometria'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '3', 'Classificação periódica dos elementos químicos', null, null, 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '3.1', 'Tabela periódica: histórico e evolução', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'quimica/tabela-periodica-historico'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '3.2', 'Classificação dos elementos em metais, não metais, semimetais e gases nobres', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'quimica/classificacao-dos-elementos'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '3.3', 'Configuração eletrônica dos elementos ao longo da tabela periódica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'quimica/configuracao-eletronica'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '3.4', 'Propriedades periódicas e aperiódicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'quimica/propriedades-periodicas'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4', 'Radioatividade', null, null, 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4.1', 'Natureza das emissões radioativas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'quimica/emissoes-radioativas'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4.2', 'Leis da radioatividade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'quimica/leis-da-radioatividade'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4.3', 'Cinética da desintegração radioativa', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'quimica/cinetica-da-desintegracao-radioativa'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4.4', 'Fenômenos de fissão nuclear e fusão nuclear', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'quimica/fissao-e-fusao-nuclear'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '4.5', 'Riscos e aplicações das reações nucleares', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'quimica/riscos-e-aplicacoes-reacoes-nucleares'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '5', 'Interações químicas', null, null, 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '5.1', 'Ligações iônica, covalente e metálica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'quimica/ligacoes-ionica-covalente-metalica'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '5.2', 'Forças intermoleculares', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'quimica/forcas-intermoleculares'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '5.3', 'Geometria molecular: eletronegatividade e polaridade das ligações e das moléculas, teoria da repulsão dos pares eletrônicos, teoria da ligação de valência e sobreposição de orbitais, orbitais híbridos e moleculares', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'quimica/geometria-molecular-e-polaridade'), 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '5.4', 'Relação entre estrutura e propriedade das substâncias químicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'quimica/estrutura-e-propriedades-das-substancias'), 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '6', 'Matéria e mudança de estado', null, null, 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '6.1', 'Sólidos, líquidos, gases e outros estados da matéria (ideais e reais)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'quimica/estados-da-materia'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '6.2', 'Características e propriedades de gases, líquidos e sólidos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'quimica/propriedades-de-gases-liquidos-solidos'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '6.3', 'Ligações químicas nos sólidos, líquidos e gases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'quimica/ligacoes-nos-estados-fisicos'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '6.4', 'Métodos de separação de misturas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'quimica/separacao-de-misturas'), 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '7', 'Funções químicas inorgânicas', null, null, 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '7.1', 'Ácidos, bases, sais e óxidos: conceito, propriedades e nomenclatura', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'quimica/acidos-bases-sais-oxidos'), 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '7.2', 'Hidretos, carbetos e nitretos: conceito, propriedades e nomenclatura', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'quimica/hidretos-carbetos-nitretos'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '7.3', 'Principais reações envolvendo compostos inorgânicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'quimica/reacoes-inorganicas'), 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '7.4', 'Balanceamento de equações químicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'quimica/balanceamento-de-equacoes'), 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '8', 'Misturas e soluções', null, null, 36)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '8.1', 'Relações de proporcionalidade entre solutos e solvente: concentração em quantidade de matéria, concentração em massa, fração em quantidade de matéria, fração em massa, fração em volume, densidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'quimica/concentracao-de-solucoes'), 37)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '8.2', 'Grandezas-padrão e unidades-padrão (SI) e sua relação com outras grandezas e unidades', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'quimica/grandezas-e-unidades-si'), 38)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '8.3', 'Solubilidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'quimica/solubilidade'), 39)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '8.4', 'Propriedades coligativas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'quimica/propriedades-coligativas'), 40)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9', 'Gases', null, null, 41)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9.1', 'Teoria cinética', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'quimica/teoria-cinetica-dos-gases'), 42)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9.2', 'Leis dos gases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'quimica/leis-dos-gases'), 43)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9.3', 'Densidade dos gases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'quimica/densidade-dos-gases'), 44)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9.4', 'Difusão e efusão dos gases', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'quimica/difusao-e-efusao'), 45)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '9.5', 'Misturas gasosas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'quimica/misturas-gasosas'), 46)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10', 'Termoquímica', null, null, 47)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.1', 'Energia e calor', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/energia-e-calor'), 48)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.2', 'Reações exotérmicas e endotérmicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/reacoes-exotermicas-endotermicas'), 49)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.3', 'Entalpia, entropia e energia livre', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/entalpia-entropia-energia-livre'), 50)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.4', 'Espontaneidade de uma reação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/espontaneidade-de-reacoes'), 51)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.5', 'Entalpias de formação e de combustão das substâncias', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/entalpias-de-formacao-e-combustao'), 52)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.6', 'Calor de reação em pressão constante e em volume constante', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/calor-de-reacao'), 53)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '10.7', 'Lei de Hess', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '10'), (select id from public.topicos_canonicos where slug = 'quimica/lei-de-hess'), 54)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '11', 'Cinética química', null, null, 55)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '11.1', 'Velocidades e mecanismos de reação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '11'), (select id from public.topicos_canonicos where slug = 'quimica/velocidade-e-mecanismos-de-reacao'), 56)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '11.2', 'Equação de velocidade, teoria das colisões e complexo ativado', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '11'), (select id from public.topicos_canonicos where slug = 'quimica/equacao-de-velocidade-e-colisoes'), 57)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '11.3', 'Influência da energia, da concentração, da pressão e dos catalisadores na velocidade das reações químicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '11'), (select id from public.topicos_canonicos where slug = 'quimica/fatores-da-velocidade-de-reacao'), 58)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12', 'Equilíbrio químico', null, null, 59)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.1', 'Equilíbrio iônico em soluções aquosas, constante de equilíbrio', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/equilibrio-ionico-e-constante'), 60)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.2', 'Equilíbrio ácido-base, hidrólise de sais, solução tampão, conceitos de Ka, Kb, Kh, pH, pOH e graus de dissociação e de hidrólise', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/equilibrio-acido-base-e-ph'), 61)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.3', 'Equilíbrio de precipitação, conceito de Kps', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/equilibrio-de-precipitacao-kps'), 62)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.4', 'Deslocamento do equilíbrio', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/deslocamento-do-equilibrio'), 63)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.5', 'Lei da diluição de Ostwald', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/lei-da-diluicao-de-ostwald'), 64)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.6', 'Efeito do íon comum', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/efeito-do-ion-comum'), 65)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '12.7', 'Lei da ação das massas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '12'), (select id from public.topicos_canonicos where slug = 'quimica/lei-da-acao-das-massas'), 66)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '13', 'Eletroquímica', null, null, 67)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '13.1', 'Potenciais de redução e potenciais-padrão de redução', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '13'), (select id from public.topicos_canonicos where slug = 'quimica/potenciais-de-reducao'), 68)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '13.2', 'Espontaneidade de uma reação de oxirredução', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '13'), (select id from public.topicos_canonicos where slug = 'quimica/espontaneidade-de-oxirreducao'), 69)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '13.3', 'Pilhas e acumuladores', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '13'), (select id from public.topicos_canonicos where slug = 'quimica/pilhas-e-acumuladores'), 70)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '13.4', 'Eletrólise', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '13'), (select id from public.topicos_canonicos where slug = 'quimica/eletrolise'), 71)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14', 'Química orgânica', null, null, 72)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14.1', 'Propriedades fundamentais do átomo de carbono, hibridação, estados de oxidação do carbono, ligações σ e π, geometria molecular, classificação do átomo de carbono na cadeia carbônica, notação e nomenclatura dos principais radicais orgânicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '14'), (select id from public.topicos_canonicos where slug = 'quimica/atomo-de-carbono-e-radicais-organicos'), 73)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14.2', 'Notação, nomenclatura e propriedades físicas e químicas de hidrocarbonetos, haletos orgânicos, álcoois, fenóis, éteres, cetonas, aldeídos, ácidos carboxílicos, ésteres, anidridos, haletos de ácido, aminas, amidas, nitrilas, isonitrilas e nitrocompostos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '14'), (select id from public.topicos_canonicos where slug = 'quimica/funcoes-organicas-nomenclatura-e-propriedades'), 74)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14.3', 'Reatividade dos compostos orgânicos, reações de redução, oxidação, combustão, adição e substituição', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '14'), (select id from public.topicos_canonicos where slug = 'quimica/reacoes-organicas'), 75)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14.4', 'Glicídeos, lipídeos, aminoácidos, proteínas, ácidos nucleicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '14'), (select id from public.topicos_canonicos where slug = 'quimica/biomoleculas'), 76)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo'), '14.5', 'Tecnologias associadas à química orgânica: petroquímica, polímeros sintéticos, aditivos em alimentos, agroquímica, drogas, medicamentos e biotecnologia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-cfo') and t.codigo = '14'), (select id from public.topicos_canonicos where slug = 'quimica/tecnologias-da-quimica-organica'), 77)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/classificacao-dos-seres-vivos', 'Classificação dos seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/celula-procariota-eucariota', 'Célula procariota e eucariota') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/componentes-morfologicos-das-celulas', 'Componentes morfológicos das células') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/funcoes-das-estruturas-celulares', 'Funções das estruturas celulares') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/fisiologia-humana', 'Fisiologia') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/posicao-anatomica', 'Posição anatômica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/divisoes-do-corpo-humano', 'Divisões do corpo humano') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/quadrantes-abdominais', 'Quadrantes abdominais (órgãos)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-tegumentar', 'Sistema tegumentar: pele, pelos, unhas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-muscular', 'Sistema muscular') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-esqueletico', 'Sistema esquelético: funções, divisão anatômica do esqueleto, ossos, crânio, coluna vertebral, articulações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-respiratorio', 'Sistema respiratório: função, respiração, órgãos componentes, mecanismo da respiração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-cardiovascular', 'Sistema cardiovascular: principais funções, sangue, coração, movimentos cardíacos, pulso, vasos sanguíneos, circulação sanguínea') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-geniturinario', 'Sistema geniturinário: sistema urinário, sistema genital masculino, sistema genital feminino') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-digestorio', 'Sistema digestório') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-nervoso', 'Sistema nervoso: função, divisão, meninges, sistema nervoso central, sistema nervoso periférico, sistema nervoso visceral, sistema nervoso somático') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/tecidos-animais', 'Tecidos animais: características estruturais e funcionais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/evolucao', 'Evolução dos seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/funcoes-vitais-das-plantas', 'Funções vitais das plantas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/grupos-vegetais', 'Briófitas, pteridófitas, gimnospermas e angiospermas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/reino-animal-caracteristicas-gerais', 'Características gerais, reprodução, nutrição, locomoção e coordenação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/poriferos', 'Poríferos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/cnidarios', 'Cnidários') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/artropodes', 'Artrópodes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/moluscos', 'Moluscos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/equinodermos', 'Equinodermos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/nematelmintos', 'Nematelmintos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/platelmintos', 'Platelmintos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/anelideos', 'Anelídeos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/cordados', 'Cordados') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/principios-basicos-de-saude', 'Princípios básicos de saúde') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/viroses', 'Viroses (transmissão e profilaxia): AIDS, dengue, poliomielite, raiva e sarampo') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/infeccoes-bacterianas', 'Infecções bacterianas (transmissão e profilaxia): tuberculose, sífilis, meningite meningocócica, cólera, tétano e leptospirose') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/protozoonoses', 'Protozoonoses (transmissão e profilaxia): amebíase, malária e doença de Chagas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/verminoses', 'Verminoses (ciclo de vida e profilaxia): ascaridíase, teníase, cisticercose, esquistossomose e ancilostomose') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/imunidade-passiva-e-ativa', 'Defesas do organismo: imunidades passiva e ativa') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/relacoes-troficas', 'Relações tróficas entre os seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/biomas', 'Biomas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/ciclos-biogeoquimicos', 'Ciclos biogeoquímicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/conservacao-e-acao-antropica', 'Conservação e preservação da natureza, ação antrópica, poluição e biocidas, ecossistemas e espécies ameaçadas de extinção (principalmente no Brasil)') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and codigo <> all (array['1', '1.1', '2', '2.1', '2.2', '2.3', '3', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12', '4', '5', '6', '6.1', '6.2', '7', '7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8', '7.9', '7.10', '8', '8.1', '8.2', '8.2.1', '8.2.2', '8.2.3', '8.2.4', '8.3', '9', '9.1', '9.2', '9.3', '9.4']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '1', 'Seres vivos', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '1.1', 'Classificação dos seres vivos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'biologia/classificacao-dos-seres-vivos'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '2', 'Célula', null, null, 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '2.1', 'Célula procariota e eucariota', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/celula-procariota-eucariota'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '2.2', 'Componentes morfológicos das células', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/componentes-morfologicos-das-celulas'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '2.3', 'Funções das estruturas celulares', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/funcoes-das-estruturas-celulares'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3', 'Anatomia e fisiologia humanas', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.1', 'Fisiologia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/fisiologia-humana'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.2', 'Posição anatômica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/posicao-anatomica'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.3', 'Divisões do corpo humano', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/divisoes-do-corpo-humano'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.4', 'Quadrantes abdominais (órgãos)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/quadrantes-abdominais'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.5', 'Sistema tegumentar: pele, pelos, unhas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-tegumentar'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.6', 'Sistema muscular', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-muscular'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.7', 'Sistema esquelético: funções, divisão anatômica do esqueleto, ossos, crânio, coluna vertebral, articulações', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-esqueletico'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.8', 'Sistema respiratório: função, respiração, órgãos componentes, mecanismo da respiração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-respiratorio'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.9', 'Sistema cardiovascular: principais funções, sangue, coração, movimentos cardíacos, pulso, vasos sanguíneos, circulação sanguínea', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-cardiovascular'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.10', 'Sistema geniturinário: sistema urinário, sistema genital masculino, sistema genital feminino', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-geniturinario'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.11', 'Sistema digestório', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-digestorio'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '3.12', 'Sistema nervoso: função, divisão, meninges, sistema nervoso central, sistema nervoso periférico, sistema nervoso visceral, sistema nervoso somático', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-nervoso'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '4', 'Tecidos animais: características estruturais e funcionais', null, (select id from public.topicos_canonicos where slug = 'biologia/tecidos-animais'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '5', 'Evolução dos seres vivos', null, (select id from public.topicos_canonicos where slug = 'biologia/evolucao'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '6', 'Reino vegetal', null, null, 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '6.1', 'Funções vitais das plantas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'biologia/funcoes-vitais-das-plantas'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '6.2', 'Briófitas, pteridófitas, gimnospermas e angiospermas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'biologia/grupos-vegetais'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7', 'Reino Animal', null, null, 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.1', 'Características gerais, reprodução, nutrição, locomoção e coordenação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/reino-animal-caracteristicas-gerais'), 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.2', 'Poríferos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/poriferos'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.3', 'Cnidários', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/cnidarios'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.4', 'Artrópodes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/artropodes'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.5', 'Moluscos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/moluscos'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.6', 'Equinodermos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/equinodermos'), 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.7', 'Nematelmintos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/nematelmintos'), 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.8', 'Platelmintos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/platelmintos'), 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.9', 'Anelídeos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/anelideos'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '7.10', 'Cordados', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/cordados'), 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8', 'Saúde, higiene e saneamento básico', null, null, 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.1', 'Princípios básicos de saúde', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'biologia/principios-basicos-de-saude'), 36)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.2', 'Doenças adquiridas transmissíveis', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8'), null, 37)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.2.1', 'Viroses (transmissão e profilaxia): AIDS, dengue, poliomielite, raiva e sarampo', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8.2'), (select id from public.topicos_canonicos where slug = 'biologia/viroses'), 38)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.2.2', 'Infecções bacterianas (transmissão e profilaxia): tuberculose, sífilis, meningite meningocócica, cólera, tétano e leptospirose', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8.2'), (select id from public.topicos_canonicos where slug = 'biologia/infeccoes-bacterianas'), 39)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.2.3', 'Protozoonoses (transmissão e profilaxia): amebíase, malária e doença de Chagas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8.2'), (select id from public.topicos_canonicos where slug = 'biologia/protozoonoses'), 40)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.2.4', 'Verminoses (ciclo de vida e profilaxia): ascaridíase, teníase, cisticercose, esquistossomose e ancilostomose', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8.2'), (select id from public.topicos_canonicos where slug = 'biologia/verminoses'), 41)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '8.3', 'Defesas do organismo: imunidades passiva e ativa', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'biologia/imunidade-passiva-e-ativa'), 42)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '9', 'Ecologia', null, null, 43)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '9.1', 'Relações tróficas entre os seres vivos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/relacoes-troficas'), 44)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '9.2', 'Biomas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/biomas'), 45)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '9.3', 'Ciclos biogeoquímicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/ciclos-biogeoquimicos'), 46)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo'), '9.4', 'Conservação e preservação da natureza, ação antrópica, poluição e biocidas, ecossistemas e espécies ameaçadas de extinção (principalmente no Brasil)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-cfo') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/conservacao-e-acao-antropica'), 47)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/administracao-indireta', 'Autarquias, fundações, empresas públicas e sociedades de economia mista') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/ato-administrativo', 'Conceito, requisitos, atributos, classificação e espécies') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/agentes-publicos-disposicoes-constitucionais', 'Disposições constitucionais aplicáveis') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/agentes-publicos-conceito', 'Conceito') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/agentes-publicos-especies', 'Espécies') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/cargo-emprego-e-funcao-publica', 'Cargo, emprego e função pública') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/poderes-administrativos', 'Hierárquico, disciplinar, regulamentar e de polícia') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/uso-e-abuso-do-poder', 'Uso e abuso do poder') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/licitacao-principios', 'Princípios') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/contratacao-direta', 'Contratação direta: dispensa e inexigibilidade') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/licitacao-modalidades', 'Modalidades') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/licitacao-tipos', 'Tipos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/licitacao-procedimento', 'Procedimento') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/controle-administrativo', 'Controle exercido pela administração pública') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/controle-judicial', 'Controle judicial') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/controle-legislativo', 'Controle legislativo') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/responsabilidade-por-ato-comissivo', 'Responsabilidade por ato comissivo do Estado') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/responsabilidade-por-omissao', 'Responsabilidade por omissão do Estado') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/responsabilidade-civil-requisitos', 'Requisitos para a demonstração da responsabilidade do Estado') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/responsabilidade-civil-excludentes-atenuantes', 'Causas excludentes e atenuantes da responsabilidade do Estado') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/regime-juridico-administrativo', 'Conceito') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-administrativo/principios-da-administracao-publica', 'Princípios expressos e implícitos da administração pública') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and codigo <> all (array['1', '1.1', '2', '2.1', '3', '3.1', '3.2', '3.2.1', '3.2.2', '3.2.3', '4', '4.1', '4.2', '5', '5.1', '5.2', '5.3', '5.4', '5.5', '6', '6.1', '6.2', '6.3', '7', '7.1', '7.1.1', '7.1.2', '7.2', '7.3', '8', '8.1', '8.2']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '1', 'Noções de organização administrativa', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '1.1', 'Autarquias, fundações, empresas públicas e sociedades de economia mista', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/administracao-indireta'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '2', 'Ato administrativo', null, null, 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '2.1', 'Conceito, requisitos, atributos, classificação e espécies', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/ato-administrativo'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3', 'Agentes públicos', null, null, 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3.1', 'Disposições constitucionais aplicáveis', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/agentes-publicos-disposicoes-constitucionais'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3.2', 'Disposições doutrinárias', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '3'), null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3.2.1', 'Conceito', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '3.2'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/agentes-publicos-conceito'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3.2.2', 'Espécies', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '3.2'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/agentes-publicos-especies'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '3.2.3', 'Cargo, emprego e função pública', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '3.2'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/cargo-emprego-e-funcao-publica'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '4', 'Poderes administrativos', null, null, 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '4.1', 'Hierárquico, disciplinar, regulamentar e de polícia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/poderes-administrativos'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '4.2', 'Uso e abuso do poder', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/uso-e-abuso-do-poder'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5', 'Licitação', null, null, 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5.1', 'Princípios', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/licitacao-principios'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5.2', 'Contratação direta: dispensa e inexigibilidade', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/contratacao-direta'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5.3', 'Modalidades', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/licitacao-modalidades'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5.4', 'Tipos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/licitacao-tipos'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '5.5', 'Procedimento', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/licitacao-procedimento'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '6', 'Controle da administração pública', null, null, 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '6.1', 'Controle exercido pela administração pública', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/controle-administrativo'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '6.2', 'Controle judicial', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/controle-judicial'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '6.3', 'Controle legislativo', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/controle-legislativo'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7', 'Responsabilidade civil do Estado', null, null, 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7.1', 'Responsabilidade civil do Estado no direito brasileiro', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '7'), null, 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7.1.1', 'Responsabilidade por ato comissivo do Estado', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '7.1'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/responsabilidade-por-ato-comissivo'), 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7.1.2', 'Responsabilidade por omissão do Estado', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '7.1'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/responsabilidade-por-omissao'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7.2', 'Requisitos para a demonstração da responsabilidade do Estado', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/responsabilidade-civil-requisitos'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '7.3', 'Causas excludentes e atenuantes da responsabilidade do Estado', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/responsabilidade-civil-excludentes-atenuantes'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '8', 'Regime jurídico-administrativo', null, null, 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '8.1', 'Conceito', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/regime-juridico-administrativo'), 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo'), '8.2', 'Princípios expressos e implícitos da administração pública', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-administrativo') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'direito-administrativo/principios-da-administracao-publica'), 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/constituicao-e-principios-fundamentais', 'Conceito, classificações, princípios fundamentais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/direitos-e-garantias-fundamentais', 'Direitos e deveres individuais e coletivos, direitos sociais, nacionalidade, cidadania, direitos políticos, partidos políticos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/organizacao-politico-administrativa', 'União, estados, Distrito Federal, municípios e territórios') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/administracao-publica-servidores-militares', 'Disposições gerais, servidores públicos e militares dos estados, do Distrito Federal e dos territórios') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/seguranca-publica', 'Segurança pública') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/organizacao-da-seguranca-publica', 'Organização da segurança pública') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/forcas-armadas', 'Papel e competências das forças armadas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('direito-constitucional/sistema-de-seguranca-publica-militares', 'Sistema de segurança pública: militares dos estados, do Distrito Federal e dos territórios') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and codigo <> all (array['1', '1.1', '2', '2.1', '3', '3.1', '4', '4.1', '5', '5.1', '5.2', '6', '6.1', '7']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '1', 'Constituição', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '1.1', 'Conceito, classificações, princípios fundamentais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/constituicao-e-principios-fundamentais'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '2', 'Direitos e garantias fundamentais', null, null, 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '2.1', 'Direitos e deveres individuais e coletivos, direitos sociais, nacionalidade, cidadania, direitos políticos, partidos políticos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/direitos-e-garantias-fundamentais'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '3', 'Organização político-administrativa', null, null, 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '3.1', 'União, estados, Distrito Federal, municípios e territórios', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/organizacao-politico-administrativa'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '4', 'Administração pública', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '4.1', 'Disposições gerais, servidores públicos e militares dos estados, do Distrito Federal e dos territórios', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/administracao-publica-servidores-militares'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '5', 'Defesa do Estado e das instituições democráticas', null, null, 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '5.1', 'Segurança pública', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/seguranca-publica'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '5.2', 'Organização da segurança pública', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/organizacao-da-seguranca-publica'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '6', 'Estado de defesa e estado de sítio', null, null, 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '6.1', 'Papel e competências das forças armadas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'direito-constitucional/forcas-armadas'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'direito-constitucional'), '7', 'Sistema de segurança pública: militares dos estados, do Distrito Federal e dos territórios', null, (select id from public.topicos_canonicos where slug = 'direito-constitucional/sistema-de-seguranca-publica-militares'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/sistema-de-forcas', 'Sistema de forças') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/composicao-de-forcas', 'Composição de forças: forças de mesma direção e sentido, forças de mesma direção e sentidos diferentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/forcas-concorrentes', 'Duas forças concorrentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/representacao-grafica-de-vetores', 'Representação gráfica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/binario', 'Binário') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/nocoes-de-movimento', 'Noções de Movimento') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/movimento-retilineo', 'Movimento retilíneo: velocidade, movimento uniformemente variado, aceleração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/projeteis-e-movimento-circular-uniforme', 'Movimento em duas dimensões: movimento de projéteis e movimento circular uniforme') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/leis-de-newton', 'Leis de Newton') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/gravitacao-universal', 'Leis da Gravitação Universal') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/leis-de-kepler', 'Leis de Kepler') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/rotacao-da-terra', 'Rotação da terra') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/trabalho-potencia-rendimento-energia', 'Trabalho, potência, rendimento, energia: mecânica, cinética, energia potencial e energia mecânica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/conservacao-da-energia-mecanica', 'Conservação de energia mecânica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/principios-pascal-arquimedes-stevin', 'Principio de Pascal, Lei de Stevin, Princípio de Arquimedes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/temperatura-e-equilibrio-termico', 'Temperatura e equilíbrio térmico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/calor-sensivel-e-latente', 'Energia térmica e calor; calor sensível e calor latente') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/trocas-de-calor', 'Trocas de calor') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/dilatacao-termica-dos-solidos', 'Dilatação térmica dos sólidos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/dilatacao-anomala-da-agua', 'Dilatação anômala da água') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/propagacao-do-calor', 'Processos de propagação do calor') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/visao-e-defeitos-visuais', 'Mecanismos físicos da visão e defeitos visuais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/qualidades-fisiologicas-do-som', 'Qualidades fisiológicas do som') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/natureza-e-propagacao-do-som', 'Natureza e propagação do som') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/lei-de-coulomb', 'Lei de Coulomb') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/corrente-eletrica', 'Corrente elétrica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/circuitos-eletricos', 'Circuitos elétricos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/efeito-joule', 'Efeito Joule') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/efeitos-fisiologicos-da-corrente', 'Efeitos fisiológicos das correntes elétricas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/campo-magnetico', 'Campo magnético') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/imas', 'Imãs') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/efeito-fotoeletrico', 'Efeito fotoelétrico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/efeito-estufa', 'Efeito estufa') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/brisas-litoraneas', 'Brisas litorâneas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/relampagos-e-trovoes', 'Relâmpagos e trovões') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('fisica/radioatividade-e-radiacoes-ionizantes', 'Princípios básicos da emissão de radioatividade, radiações ionizantes e decaimento radioativo') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and codigo <> all (array['1', '1.1', '1.2', '1.3', '1.4', '1.5', '2', '2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7', '2.8', '2.9', '3', '3.1', '4', '4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '5', '5.1', '6', '6.1', '6.2', '7', '7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '8', '8.1', '8.2', '8.3', '8.4', '9']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1', 'Vetores', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1.1', 'Sistema de forças', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/sistema-de-forcas'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1.2', 'Composição de forças: forças de mesma direção e sentido, forças de mesma direção e sentidos diferentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/composicao-de-forcas'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1.3', 'Duas forças concorrentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/forcas-concorrentes'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1.4', 'Representação gráfica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/representacao-grafica-de-vetores'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '1.5', 'Binário', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'fisica/binario'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2', 'Mecânica', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.1', 'Noções de Movimento', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/nocoes-de-movimento'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.2', 'Movimento retilíneo: velocidade, movimento uniformemente variado, aceleração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/movimento-retilineo'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.3', 'Movimento em duas dimensões: movimento de projéteis e movimento circular uniforme', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/projeteis-e-movimento-circular-uniforme'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.4', 'Leis de Newton', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/leis-de-newton'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.5', 'Leis da Gravitação Universal', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/gravitacao-universal'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.6', 'Leis de Kepler', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/leis-de-kepler'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.7', 'Rotação da terra', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/rotacao-da-terra'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.8', 'Trabalho, potência, rendimento, energia: mecânica, cinética, energia potencial e energia mecânica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/trabalho-potencia-rendimento-energia'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '2.9', 'Conservação de energia mecânica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'fisica/conservacao-da-energia-mecanica'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '3', 'Densidade e pressão', null, null, 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '3.1', 'Principio de Pascal, Lei de Stevin, Princípio de Arquimedes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'fisica/principios-pascal-arquimedes-stevin'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4', 'Termodinâmica', null, null, 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.1', 'Temperatura e equilíbrio térmico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/temperatura-e-equilibrio-termico'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.2', 'Energia térmica e calor; calor sensível e calor latente', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/calor-sensivel-e-latente'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.3', 'Trocas de calor', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/trocas-de-calor'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.4', 'Dilatação térmica dos sólidos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/dilatacao-termica-dos-solidos'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.5', 'Dilatação anômala da água', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/dilatacao-anomala-da-agua'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '4.6', 'Processos de propagação do calor', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'fisica/propagacao-do-calor'), 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '5', 'Óptica geométrica', null, null, 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '5.1', 'Mecanismos físicos da visão e defeitos visuais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'fisica/visao-e-defeitos-visuais'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '6', 'Som', null, null, 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '6.1', 'Qualidades fisiológicas do som', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/qualidades-fisiologicas-do-som'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '6.2', 'Natureza e propagação do som', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'fisica/natureza-e-propagacao-do-som'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7', 'Eletricidade e Magnetismo', null, null, 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.1', 'Lei de Coulomb', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/lei-de-coulomb'), 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.2', 'Corrente elétrica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/corrente-eletrica'), 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.3', 'Circuitos elétricos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/circuitos-eletricos'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.4', 'Efeito Joule', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/efeito-joule'), 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.5', 'Efeitos fisiológicos das correntes elétricas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/efeitos-fisiologicos-da-corrente'), 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.6', 'Campo magnético', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/campo-magnetico'), 36)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '7.7', 'Imãs', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'fisica/imas'), 37)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '8', 'Aplicações', null, null, 38)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '8.1', 'Efeito fotoelétrico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'fisica/efeito-fotoeletrico'), 39)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '8.2', 'Efeito estufa', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'fisica/efeito-estufa'), 40)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '8.3', 'Brisas litorâneas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'fisica/brisas-litoraneas'), 41)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '8.4', 'Relâmpagos e trovões', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'fisica/relampagos-e-trovoes'), 42)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'fisica-soldado'), '9', 'Princípios básicos da emissão de radioatividade, radiações ionizantes e decaimento radioativo', null, (select id from public.topicos_canonicos where slug = 'fisica/radioatividade-e-radiacoes-ionizantes'), 43)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/particulas-fundamentais-do-atomo', 'Partícula fundamentais do átomo') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/numero-atomico-e-massa-atomica', 'Número atômico e massa atômica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/massa-molecular', 'Massa molecular') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/mol-massa-molar-volume-molar', 'Número de avogado, mol, massa molecular, volume molecular') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/configuracao-eletronica', 'Configuração eletrônica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/tabela-periodica-estrutura', 'Tabela periódica atual e sua estrutura') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/lei-periodica', 'Lei periódica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/familias-da-tabela-periodica', 'Principais subgrupos de elementos físicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/ligacao-ionica', 'Ligação iônica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/ligacao-covalente', 'Ligação covalente') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/formulas-quimicas', 'Fórmula eletrônica (estrutural de Lewis), iônica, molecular e estrutural das substâncias') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/numero-de-oxidacao', 'Número de oxidação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacoes-inorganicas', 'Reações de neutralização, dupla troca, simples troca, redução, oxidação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/acidos-bases-sais-oxidos', 'Ácidos, bases, sais, óxidos, conceitos, classificação, nomenclatura e propriedades gerais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacao-e-equacao-quimica', 'Conceito de reação, equação química, reagente e produto') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/balanceamento-de-equacoes', 'Balanceamento de equação química') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/concentracao-de-solucoes', 'Soluções, concentração das soluções (grama/litro e mol/litro)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/propriedades-do-atomo-de-carbono', 'Propriedades do átomo do carbono') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/estrutura-de-compostos-organicos', 'Estrutura de compostos orgânicos, cadeias carbônicas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/classificacao-do-carbono-na-cadeia', 'Classificação do átomo de carbono na cadeia carbônica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/classificacao-de-cadeias-carbonicas', 'Classificação de cadeia carbônica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/funcoes-organicas-nomenclatura-e-propriedades', 'Notação, nomenclatura e propriedades físicas e químicas de hidrocarboneto, álcool, éter, cenol, cetonas, aldeídos, ácido carboxílicos, amina e amida (contendo de 1 a 8 carbonos)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reatividade-dos-compostos-organicos', 'Reatividade dos compostos orgânicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/reacoes-organicas', 'Reações de redução, oxidação e combustão') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('quimica/nomenclatura-iupac', 'Identificação e nomenclatura IUPAC das funções orgânicas') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and codigo <> all (array['I', 'I.1', 'I.1.1', 'I.1.2', 'I.1.3', 'I.1.4', 'II', 'II.1', 'II.1.1', 'II.1.2', 'II.1.3', 'II.1.4', 'III', 'III.1', 'III.2', 'III.3', 'III.4', 'IV', 'IV.1', 'IV.2', 'V', 'V.1', 'V.2', 'V.3', 'VI', 'VI.1', 'VI.1.1', 'VI.1.2', 'VI.1.3', 'VI.1.4', 'VI.2', 'VI.2.1', 'VI.3', 'VI.3.1', 'VI.3.2', 'VI.4']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I', 'ESTRUTURA DO ÁTOMO', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I.1', 'Estrutura atômica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'I'), null, 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I.1.1', 'Partícula fundamentais do átomo', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'I.1'), (select id from public.topicos_canonicos where slug = 'quimica/particulas-fundamentais-do-atomo'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I.1.2', 'Número atômico e massa atômica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'I.1'), (select id from public.topicos_canonicos where slug = 'quimica/numero-atomico-e-massa-atomica'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I.1.3', 'Massa molecular', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'I.1'), (select id from public.topicos_canonicos where slug = 'quimica/massa-molecular'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'I.1.4', 'Número de avogado, mol, massa molecular, volume molecular', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'I.1'), (select id from public.topicos_canonicos where slug = 'quimica/mol-massa-molar-volume-molar'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II', 'CLASSIFICAÇÃO PERIÓDICA DOS ELEMENTOS QUÍMICOS', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II.1', 'Elemento químico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'II'), null, 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II.1.1', 'Configuração eletrônica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'II.1'), (select id from public.topicos_canonicos where slug = 'quimica/configuracao-eletronica'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II.1.2', 'Tabela periódica atual e sua estrutura', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'II.1'), (select id from public.topicos_canonicos where slug = 'quimica/tabela-periodica-estrutura'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II.1.3', 'Lei periódica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'II.1'), (select id from public.topicos_canonicos where slug = 'quimica/lei-periodica'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'II.1.4', 'Principais subgrupos de elementos físicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'II.1'), (select id from public.topicos_canonicos where slug = 'quimica/familias-da-tabela-periodica'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'III', 'LIGAÇÃO QUÍMICA', null, null, 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'III.1', 'Ligação iônica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'III'), (select id from public.topicos_canonicos where slug = 'quimica/ligacao-ionica'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'III.2', 'Ligação covalente', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'III'), (select id from public.topicos_canonicos where slug = 'quimica/ligacao-covalente'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'III.3', 'Fórmula eletrônica (estrutural de Lewis), iônica, molecular e estrutural das substâncias', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'III'), (select id from public.topicos_canonicos where slug = 'quimica/formulas-quimicas'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'III.4', 'Número de oxidação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'III'), (select id from public.topicos_canonicos where slug = 'quimica/numero-de-oxidacao'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'IV', 'FUNÇÕES DE QUÍMICA INORGÂNICA', null, null, 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'IV.1', 'Reações de neutralização, dupla troca, simples troca, redução, oxidação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'IV'), (select id from public.topicos_canonicos where slug = 'quimica/reacoes-inorganicas'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'IV.2', 'Ácidos, bases, sais, óxidos, conceitos, classificação, nomenclatura e propriedades gerais', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'IV'), (select id from public.topicos_canonicos where slug = 'quimica/acidos-bases-sais-oxidos'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'V', 'REAÇÃO QUÍMICA', null, null, 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'V.1', 'Conceito de reação, equação química, reagente e produto', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'V'), (select id from public.topicos_canonicos where slug = 'quimica/reacao-e-equacao-quimica'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'V.2', 'Balanceamento de equação química', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'V'), (select id from public.topicos_canonicos where slug = 'quimica/balanceamento-de-equacoes'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'V.3', 'Soluções, concentração das soluções (grama/litro e mol/litro)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'V'), (select id from public.topicos_canonicos where slug = 'quimica/concentracao-de-solucoes'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI', 'QUÍMICA DO CARBONO', null, null, 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.1', 'Introdução a química orgânica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI'), null, 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.1.1', 'Propriedades do átomo do carbono', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.1'), (select id from public.topicos_canonicos where slug = 'quimica/propriedades-do-atomo-de-carbono'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.1.2', 'Estrutura de compostos orgânicos, cadeias carbônicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.1'), (select id from public.topicos_canonicos where slug = 'quimica/estrutura-de-compostos-organicos'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.1.3', 'Classificação do átomo de carbono na cadeia carbônica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.1'), (select id from public.topicos_canonicos where slug = 'quimica/classificacao-do-carbono-na-cadeia'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.1.4', 'Classificação de cadeia carbônica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.1'), (select id from public.topicos_canonicos where slug = 'quimica/classificacao-de-cadeias-carbonicas'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.2', 'Funções orgânicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI'), null, 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.2.1', 'Notação, nomenclatura e propriedades físicas e químicas de hidrocarboneto, álcool, éter, cenol, cetonas, aldeídos, ácido carboxílicos, amina e amida (contendo de 1 a 8 carbonos)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.2'), (select id from public.topicos_canonicos where slug = 'quimica/funcoes-organicas-nomenclatura-e-propriedades'), 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.3', 'Reações orgânicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI'), null, 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.3.1', 'Reatividade dos compostos orgânicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.3'), (select id from public.topicos_canonicos where slug = 'quimica/reatividade-dos-compostos-organicos'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.3.2', 'Reações de redução, oxidação e combustão', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI.3'), (select id from public.topicos_canonicos where slug = 'quimica/reacoes-organicas'), 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado'), 'VI.4', 'Identificação e nomenclatura IUPAC das funções orgânicas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'quimica-soldado') and t.codigo = 'VI'), (select id from public.topicos_canonicos where slug = 'quimica/nomenclatura-iupac'), 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/classificacao-dos-seres-vivos', 'Seres vivos: classificação dos seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/celula-procariota-eucariota', 'Célula procariota e eucariota') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/componentes-morfologicos-das-celulas', 'Componentes morfológicos das células') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/funcoes-das-estruturas-celulares', 'Funções das estruturas celulares') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/fisiologia-humana', 'Fisiologia') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/posicao-anatomica', 'Posição anatômica') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/divisoes-do-corpo-humano', 'Divisões do corpo humano') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/quadrantes-abdominais', 'Quadrantes abdominais (órgãos)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-tegumentar', 'Sistema tegumentar: pele, pêlos, unhas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-muscular', 'Sistema muscular') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-esqueletico', 'Sistema esquelético: funções, divisão anatômica do esqueleto, ossos, crânio, coluna vertebral, articulações') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-respiratorio', 'Sistema respiratório: função, respiração, órgãos componentes, mecanismo da respiração') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-cardiovascular', 'Sistema cardiovascular: principais funções, sangue, coração, movimentos cardíacos, pulso, vasos sanguíneos, circulação sanguínea') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-geniturinario', 'Sistema geniturinário: sistema urinário, sistema genital masculino, sistema genital feminino') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-digestorio', 'Sistema digestório') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/sistema-nervoso', 'Sistema nervoso: função, divisão, meninges, sistema nervoso central, sistema nervoso periférico, sistema nervoso visceral, sistema nervoso somático') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/tecidos-animais', 'Tecidos animais: características estruturais e funcionais') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/evolucao', 'Evolução dos seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/funcoes-vitais-das-plantas', 'Funções vitais das plantas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/grupos-vegetais', 'Briófitas, pteridófitas, gimnospermas e angiospermas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/reino-animal-caracteristicas-gerais', 'Características gerais, reprodução, nutrição, locomoção e coordenação') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/poriferos', 'Poríferos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/cnidarios', 'Cnidários') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/artropodes', 'Artrópodes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/moluscos', 'Moluscos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/equinodermos', 'Equinodermos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/nematelmintos', 'Nematelmintos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/platelmintos', 'Platelmintos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/anelideos', 'Anelídeos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/cordados', 'Cordados') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/principios-basicos-de-saude', 'Princípios básicos de saúde') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/doencas-transmissiveis', 'Doenças adquiridas transmissíveis: viroses (transmissão e profilaxia) — AIDS, dengue, poliomielite, raiva e sarampo; infecções bacterianas (transmissão e profilaxia) — tuberculose, sífilis, meningite meningocócica, cólera, tétano e leptospirose; protozoonoses (transmissão e profilaxia) — amebíase, malária e doença de Chagas; verminoses (ciclo de vida e profilaxia) — ascaridíase, teníase, cisticercose, esquistossomose e ancilostomose') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/imunidade-passiva-e-ativa', 'Defesas do organismo: imunidade passiva e imunidade ativa') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/relacoes-troficas', 'Relações tróficas entre os seres vivos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/biomas', 'Biomas') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/ciclos-biogeoquimicos', 'Ciclos biogeoquímicos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('biologia/conservacao-e-acao-antropica', 'Conservação e preservação da natureza, ação antrópica, poluição e biocidas, ecossistemas e espécies ameaçadas de extinção (principalmente no Brasil)') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and codigo <> all (array['1', '2', '2.1', '2.2', '2.3', '3', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9', '3.10', '3.11', '3.12', '4', '5', '6', '6.1', '6.2', '7', '7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7', '7.8', '7.9', '7.10', '8', '8.1', '8.2', '8.3', '9', '9.1', '9.2', '9.3', '9.4']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '1', 'Seres vivos: classificação dos seres vivos', null, (select id from public.topicos_canonicos where slug = 'biologia/classificacao-dos-seres-vivos'), 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '2', 'Célula', null, null, 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '2.1', 'Célula procariota e eucariota', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/celula-procariota-eucariota'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '2.2', 'Componentes morfológicos das células', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/componentes-morfologicos-das-celulas'), 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '2.3', 'Funções das estruturas celulares', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'biologia/funcoes-das-estruturas-celulares'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3', 'Anatomia e fisiologia humanas', null, null, 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.1', 'Fisiologia', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/fisiologia-humana'), 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.2', 'Posição anatômica', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/posicao-anatomica'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.3', 'Divisões do corpo humano', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/divisoes-do-corpo-humano'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.4', 'Quadrantes abdominais (órgãos)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/quadrantes-abdominais'), 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.5', 'Sistema tegumentar: pele, pêlos, unhas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-tegumentar'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.6', 'Sistema muscular', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-muscular'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.7', 'Sistema esquelético: funções, divisão anatômica do esqueleto, ossos, crânio, coluna vertebral, articulações', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-esqueletico'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.8', 'Sistema respiratório: função, respiração, órgãos componentes, mecanismo da respiração', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-respiratorio'), 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.9', 'Sistema cardiovascular: principais funções, sangue, coração, movimentos cardíacos, pulso, vasos sanguíneos, circulação sanguínea', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-cardiovascular'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.10', 'Sistema geniturinário: sistema urinário, sistema genital masculino, sistema genital feminino', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-geniturinario'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.11', 'Sistema digestório', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-digestorio'), 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '3.12', 'Sistema nervoso: função, divisão, meninges, sistema nervoso central, sistema nervoso periférico, sistema nervoso visceral, sistema nervoso somático', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'biologia/sistema-nervoso'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '4', 'Tecidos animais: características estruturais e funcionais', null, (select id from public.topicos_canonicos where slug = 'biologia/tecidos-animais'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '5', 'Evolução dos seres vivos', null, (select id from public.topicos_canonicos where slug = 'biologia/evolucao'), 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '6', 'Reino vegetal', null, null, 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '6.1', 'Funções vitais das plantas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'biologia/funcoes-vitais-das-plantas'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '6.2', 'Briófitas, pteridófitas, gimnospermas e angiospermas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'biologia/grupos-vegetais'), 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7', 'Reino Animal', null, null, 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.1', 'Características gerais, reprodução, nutrição, locomoção e coordenação', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/reino-animal-caracteristicas-gerais'), 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.2', 'Poríferos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/poriferos'), 25)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.3', 'Cnidários', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/cnidarios'), 26)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.4', 'Artrópodes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/artropodes'), 27)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.5', 'Moluscos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/moluscos'), 28)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.6', 'Equinodermos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/equinodermos'), 29)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.7', 'Nematelmintos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/nematelmintos'), 30)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.8', 'Platelmintos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/platelmintos'), 31)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.9', 'Anelídeos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/anelideos'), 32)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '7.10', 'Cordados', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'biologia/cordados'), 33)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '8', 'Saúde, higiene e saneamento básico', null, null, 34)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '8.1', 'Princípios básicos de saúde', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'biologia/principios-basicos-de-saude'), 35)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '8.2', 'Doenças adquiridas transmissíveis: viroses (transmissão e profilaxia) — AIDS, dengue, poliomielite, raiva e sarampo; infecções bacterianas (transmissão e profilaxia) — tuberculose, sífilis, meningite meningocócica, cólera, tétano e leptospirose; protozoonoses (transmissão e profilaxia) — amebíase, malária e doença de Chagas; verminoses (ciclo de vida e profilaxia) — ascaridíase, teníase, cisticercose, esquistossomose e ancilostomose', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'biologia/doencas-transmissiveis'), 36)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '8.3', 'Defesas do organismo: imunidade passiva e imunidade ativa', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '8'), (select id from public.topicos_canonicos where slug = 'biologia/imunidade-passiva-e-ativa'), 37)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '9', 'Ecologia', null, null, 38)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '9.1', 'Relações tróficas entre os seres vivos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/relacoes-troficas'), 39)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '9.2', 'Biomas', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/biomas'), 40)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '9.3', 'Ciclos biogeoquímicos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/ciclos-biogeoquimicos'), 41)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado'), '9.4', 'Conservação e preservação da natureza, ação antrópica, poluição e biocidas, ecossistemas e espécies ameaçadas de extinção (principalmente no Brasil)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'biologia-soldado') and t.codigo = '9'), (select id from public.topicos_canonicos where slug = 'biologia/conservacao-e-acao-antropica'), 42)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/motor-combustao-interna-conceito', 'Conceito') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/motor-ciclo-quatro-tempos', 'Ciclo de funcionamento (4 tempos)') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/ciclo-otto', 'Ciclo Otto') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/ciclo-diesel', 'Ciclo Diesel') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/transmissao-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/transmissao-componentes', 'Componentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/freios-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/freios-tipos', 'Tipos') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/freios-principio-fisico', 'Princípio físico') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/suspensao-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/suspensao-componentes', 'Componentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/sistema-eletrico-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/sistema-eletrico-componentes', 'Componentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/arrefecimento-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/arrefecimento-componentes', 'Componentes') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/alimentacao-funcao', 'Função') on conflict (slug) do nothing;
insert into public.topicos_canonicos (slug, titulo) values ('mecanica-automotiva/alimentacao-componentes', 'Componentes') on conflict (slug) do nothing;
delete from public.topicos where disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and codigo <> all (array['1', '1.1', '1.2', '1.3', '1.3.1', '1.3.2', '2', '2.1', '2.2', '3', '3.1', '3.2', '3.3', '4', '4.1', '4.2', '5', '5.1', '5.2', '6', '6.1', '6.2', '7', '7.1', '7.2']::text[]);
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1', 'Motor de combustão interna', null, null, 0)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1.1', 'Conceito', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/motor-combustao-interna-conceito'), 1)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1.2', 'Ciclo de funcionamento (4 tempos)', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '1'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/motor-ciclo-quatro-tempos'), 2)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1.3', 'Tipos de motores', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '1'), null, 3)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1.3.1', 'Ciclo Otto', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '1.3'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/ciclo-otto'), 4)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '1.3.2', 'Ciclo Diesel', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '1.3'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/ciclo-diesel'), 5)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '2', 'Sistema de transmissão', null, null, 6)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '2.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/transmissao-funcao'), 7)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '2.2', 'Componentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '2'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/transmissao-componentes'), 8)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '3', 'Sistema de freios', null, null, 9)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '3.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/freios-funcao'), 10)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '3.2', 'Tipos', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/freios-tipos'), 11)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '3.3', 'Princípio físico', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '3'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/freios-principio-fisico'), 12)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '4', 'Sistema de suspensão', null, null, 13)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '4.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/suspensao-funcao'), 14)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '4.2', 'Componentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '4'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/suspensao-componentes'), 15)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '5', 'Sistema elétrico', null, null, 16)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '5.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/sistema-eletrico-funcao'), 17)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '5.2', 'Componentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '5'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/sistema-eletrico-componentes'), 18)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '6', 'Sistema de arrefecimento', null, null, 19)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '6.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/arrefecimento-funcao'), 20)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '6.2', 'Componentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '6'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/arrefecimento-componentes'), 21)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '7', 'Sistema de alimentação', null, null, 22)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '7.1', 'Função', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/alimentacao-funcao'), 23)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values ((select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral'), '7.2', 'Componentes', (select t.id from public.topicos t where t.disciplina_id = (select id from public.disciplinas where concurso_id = (select id from public.concursos where slug = 'cbmal-2026') and slug = 'mecanica-geral') and t.codigo = '7'), (select id from public.topicos_canonicos where slug = 'mecanica-automotiva/alimentacao-componentes'), 24)
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;
commit;

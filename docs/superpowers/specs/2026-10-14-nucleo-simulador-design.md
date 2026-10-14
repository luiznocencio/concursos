# Núcleo + Simulador — Especificação de Design

- **Data:** 2026-10-14
- **Status:** aprovado em brainstorming, aguardando revisão do documento
- **Sub-projeto:** 1 de 4 da plataforma de estudos para concursos
- **Concurso piloto:** CBM-AL 2026 (Cebraspe) — cargos Oficial de Estado-Maior (CFO) e Soldado QPBM/1

## 1. Contexto e objetivo

Plataforma web para estudar para concursos, orientada pelos parâmetros do **edital** e da **banca**. O produto completo foi decomposto em sub-projetos, cada um com ciclo próprio de especificação → plano → implementação:

1. **Núcleo + Simulador** (este documento)
2. Corretor de redação (discursiva)
3. Importador automático de editais (PDF → `edital.yaml`)
4. Curadoria de conteúdos

Uso inicial: um único usuário (o autor). A arquitetura deve permitir virar produto multiusuário sem reescrita.

**Objetivo deste sub-projeto:** representar editais e bancas de forma genérica, manter um banco de itens com qualidade verificada (reais + gerados por IA com dupla validação) e oferecer treino adaptativo e simulados fiéis à prova, **com todo o estudo direcionado aos pontos fracos do usuário**.

### Critérios de sucesso

- O CBM-AL 2026 está modelado para CFO e Soldado; um segundo concurso pode ser adicionado escrevendo apenas um novo `edital.yaml` (sem alterar código), desde que sua banca use um formato suportado.
- A pontuação e as notas de corte de um simulado coincidem com o cálculo manual pelas fórmulas do edital.
- Nenhum item gerado por IA chega a um simulado sem concordância entre dois modelos ou aprovação manual.
- "Estudar agora" monta sessões em que a maior parte dos itens vem dos tópicos de maior prioridade calculada.

### Fora de escopo

Corretor de redação, curadoria de conteúdo, importador automático de editais, TAF e demais fases não-escritas, pagamentos/planos, telas de administração multiusuário, app nativo/offline.

## 2. Fatos do edital usados no design

Fontes: `editais/cbmal-2026/edital-01-abertura.pdf` (Edital nº 1, 21/05/2026) e `editais/cbmal-2026/edital-02-retificacao.pdf` (Edital nº 2, 15/06/2026).

- Banca: **Cebraspe**. Itens de julgamento **Certo/Errado**, agrupados por comandos (item 8.2).
- **P1 – Conhecimentos gerais:** 50 itens, comum a todos os cargos. Língua Portuguesa, Língua Inglesa, Noções de Informática, Matemática, Raciocínio Lógico e Analítico, Legislação pertinente ao CBMAL, Cidadania e Direitos Humanos.
- **P2 – Conhecimentos específicos:** 70 itens, por cargo.
  - CFO: Física, Química, Biologia (programa aprofundado), Noções de Direito Administrativo, Noções de Direito Constitucional.
  - Soldado: Física, Química, Biologia (programa básico), Mecânica Geral.
- O Edital nº 2 unificou Combatente e Motomecanização em **Cargo 2: Soldado**, com qualificações QPBM/1 e QPBM/2; a prova é a mesma, a qualificação afeta só vagas e classificação.
- Nota por item (8.11.2): `N/(N − np)` se concordar com o gabarito, o mesmo valor negativo se discordar, 0 se em branco ou dupla marcação. `N` = 50 (P1) ou 70 (P2); `np` = itens com gabarito alterado.
- Cortes (8.11.4–8.11.5): `M1 = ⌊(50 − np1) × 0,2⌋`, `M2 = ⌊(70 − np2) × 0,3⌋`, `M3 = ⌊(120 − nT) × 0,3⌋`. Eliminado se P1 < M1, P2 < M2 ou P1+P2 < M3. Com np = 0: **M1 = 10, M2 = 21, M3 = 36**.
- Duração das provas objetivas + discursiva: 4h30.
- Discursiva (9.1, 9.7): até 30 linhas, Atualidades, `NPD = NC − 6 × NE ÷ TL`, aprovação com NPD ≥ 15 — modelada no YAML agora, usada no sub-projeto 2.
- O texto do item 19 foi retificado no Edital nº 2, mas a publicação no DOE omitiu o conteúdo (`[...]`). O conteúdo programático do Edital nº 1 é a base, com essa ressalva registrada no YAML.
- Data da prova: 11/10/2026 no cronograma do Edital nº 1. Portais de concursos noticiam remarcação para **24/01/2027**, mas nenhum documento oficial no repositório confirma isso. O YAML usa 24/01/2027 com ressalva registrada e deve ser atualizado quando o ato oficial for obtido.
- `portaria-cbmal-185-2026-taf.pdf` (índices do TAF) fica arquivada para referência; o TAF está fora de escopo.

## 3. Arquitetura

**Stack:** Next.js (App Router, TypeScript) na Vercel; Supabase (Postgres, Auth, Storage); Zod para validação; Vitest e Playwright para testes. SDKs oficiais da Anthropic e da OpenAI.

**Módulos e fronteiras**

| Módulo | Responsabilidade | Depende de |
|---|---|---|
| `core/` | Regras puras: motor de pontuação e cortes, motor de foco (prioridade), repetição espaçada, schema e validação do `edital.yaml`, montagem de sessões a partir de uma lista de itens candidatos | nada (sem I/O) |
| `ai/` | Interface `AiProvider` (`generateJson(prompt, schema)`), implementações Claude e GPT, registro de uso e custo, prompts versionados | Zod |
| `pipeline/` | Geração e validação de lotes, fila de jobs | `ai/`, `db/`, `core/` |
| `db/` | Acesso ao Supabase, tipos gerados, migrações SQL, seed | Supabase |
| `app/` | Telas e rotas de servidor | todos |

`core/` não importa nada de `db/`, `ai/` ou `app/`. Isso mantém as regras do edital e da banca testáveis isoladamente.

**Segredos:** chaves das IAs apenas em variáveis de ambiente do servidor. Chamadas de IA só em rotas/funções de servidor.

**Jobs em segundo plano:** tabela `jobs` (tipo, payload, status, tentativas, erro). Uma rota de worker processa um job por invocação, em lotes pequenos (até 5 itens) para caber no limite de tempo das funções da Vercel. A rota é disparada logo após o enfileiramento e periodicamente via `pg_cron` do Supabase (a cada minuto), protegida por segredo compartilhado.

## 4. Modelo de dados

### 4.1 Edital como fonte de verdade

Cada concurso tem uma pasta `editais/<slug>/` com os PDFs oficiais, `edital.yaml` e `fontes/` (textos legais). O script `db/seed` valida o YAML com o schema de `core/` e faz upsert no banco. Retificações = editar o YAML; o git registra o histórico.

Esboço do `edital.yaml`:

```yaml
slug: cbmal-2026
nome: Concurso CBM-AL 2026 (CFO e CFP)
banca: cebraspe
data_prova: 2027-01-24
editais_fonte: [edital-01-abertura.pdf, edital-02-retificacao.pdf]
ressalvas:
  - "Item 19 retificado no Edital nº 2 sem texto publicado; conteúdo baseado no Edital nº 1."
  - "Data da prova 24/01/2027 segundo noticiário; sem ato oficial no repositório."
cargos:
  - slug: cfo
    nome: Oficial de Estado-Maior
    provas: [p1-gerais, p2-cfo, discursiva]
    corte_conjunto: { provas: [p1-gerais, p2-cfo], corte: { regra: piso_fator, fator: 0.3 } }
  - slug: soldado
    nome: Soldado
    qualificacoes: [QPBM/1, QPBM/2]
    provas: [p1-gerais, p2-soldado, discursiva]
    corte_conjunto: { provas: [p1-gerais, p2-soldado], corte: { regra: piso_fator, fator: 0.3 } }
provas:
  - slug: p1-gerais
    nome: P1 – Conhecimentos gerais
    formato: certo_errado
    itens: 50
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.2 }
    duracao_min_conjunta: 270
    distribuicao_estimada:   # valores ilustrativos; os reais seguem a regra abaixo
      estimada: true
      disciplinas: { lp: 10, ingles: 5, informatica: 5, matematica: 6, rlm: 8, legislacao-cbmal: 10, cidadania-dh: 6 }
    disciplinas: [lp, ingles, informatica, matematica, rlm, legislacao-cbmal, cidadania-dh]
  # p2-cfo, p2-soldado e discursiva seguem o mesmo formato
disciplinas:
  - slug: lp
    nome: Língua Portuguesa
    topicos:
      - codigo: "5.7"
        titulo: Emprego do sinal indicativo de crase
        canonico: portugues/sintaxe/crase
```

Regras do schema: códigos de tópico únicos por disciplina; todo tópico folha tem `canonico`; a soma de `distribuicao_estimada` é igual a `itens` da prova; toda prova referenciada em `corte_conjunto` pertence ao cargo.

**Distribuição estimada:** o edital não informa itens por disciplina. A distribuição inicial é definida a partir de provas anteriores do Cebraspe para corpos de bombeiros e fica marcada como `estimada: true`. Enquanto não houver estimativa, a divisão é igual entre as disciplinas, com arredondamento ajustado para fechar o total.

### 4.2 Tabelas

| Tabela | Campos principais |
|---|---|
| `bancas` | slug, nome, formatos suportados, guia de estilo (texto para prompts) |
| `concursos` | slug, nome, banca_id, data_prova, ressalvas |
| `cargos` | concurso_id, slug, nome, qualificacoes[] |
| `provas` | concurso_id, slug, formato, n_itens, regra_pontuacao (jsonb), regra_corte (jsonb), distribuicao (jsonb) |
| `cargo_provas` | cargo_id, prova_id (a P1 é compartilhada) |
| `disciplinas` | concurso_id, slug, nome; ligação N:N com `provas` |
| `topicos` | disciplina_id, codigo, titulo, parent_id, canonico_id |
| `topicos_canonicos` | slug (ex.: `portugues/sintaxe/crase`), titulo, area |
| `fontes` | slug, tipo (lei, decreto, conceito), titulo, url_oficial, texto por dispositivo (artigo, parágrafo) |
| `textos_base` | texto/comando compartilhado por vários itens, origem |
| `itens` | formato, texto_base_id, enunciado, alternativas (para múltipla escolha), gabarito, justificativa, citacao, fonte_id, origem (`real`/`ia`), status (`pendente`, `revisao`, `aprovado`, `suspeito`, `descartado`), dificuldade (1–3), hash_normalizado, validacao (jsonb: modelo gerador, modelo validador, respostas, concordância), banca_id |
| `item_topicos` | item_id, topico_canonico_id |
| `simulados` | user_id, cargo_id, modo (`completo`, `treino`, `revisao`), config, iniciado_em, finalizado_em, resultado (jsonb) |
| `respostas` | simulado_id, item_id, user_id, resposta (`C`, `E`, `A`–`E`, `branco`), duvida (bool), tempo_ms, respondida_em |
| `revisao_espacada` | user_id, item_id, etapa, proxima_em |
| `jobs` | tipo, payload, status, tentativas, erro |
| `ai_usage` | provedor, modelo, finalidade, tokens_entrada, tokens_saida, custo_usd, job_id |

Tabelas com `user_id` usam RLS do Supabase (cada usuário vê só os próprios dados). As tabelas de conteúdo (edital, itens, fontes) são de leitura para usuários autenticados e só o servidor escreve nelas.

### 4.3 Generalização multi-concurso

- **Banca = configuração.** Formatos e regras de pontuação e corte são *tipos de regra parametrizáveis* em `core/`:
  - Pontuação: `certo_errado_penalidade` (valor `N/(N − np)`, erro negativo), `multipla_escolha` (`peso` por acerto, `penalidade` opcional por erro, padrão 0).
  - Corte: `piso_fator` (`⌊(N − np) × fator⌋`), `minimo_percentual` (fração da pontuação máxima), `minimo_absoluto`.
  - Uma nova banca com esses formatos exige só dados; um formato novo exige um novo tipo de regra em `core/`.
- **Taxonomia canônica.** Itens se ligam a tópicos canônicos; tópicos de edital mapeiam para eles. Um item gerado para o CBM-AL serve a qualquer concurso que mapeie o mesmo tópico canônico. Tópicos de programas diferentes, mas sobrepostos (ex.: "Leis de Newton" em Física CFO e Física Soldado), apontam para o mesmo canônico.
- **Estilo de banca.** Itens também guardam `banca_id`; a geração usa exemplos e guia de estilo da banca do concurso-alvo.

## 5. Geração e validação de itens

### 5.1 Fontes primárias

Para legislação (Lei Estadual 5.346/1992, Decreto 37.042/1996, Leis Estaduais 6.514/2004 e 6.544/2004, Lei Federal 14.751/2023) e direito (CF/88), o texto oficial é salvo em `editais/cbmal-2026/fontes/*.md`, dividido por dispositivo e carregado na tabela `fontes`. Os textos vêm de sites oficiais (Planalto, Assembleia Legislativa/AL); se algum não for encontrado, o usuário fornece o PDF. Geração e validação de itens de legislação **sempre** recebem o trecho exato; o item cita o dispositivo. Nas demais disciplinas, a justificativa cita o conceito.

### 5.2 Pipeline de um lote

1. **Entrada:** tópico canônico, banca, quantidade (até 5 por job), concurso-alvo. Origem: pedido manual ou disparo automático do motor de foco (§6.4).
2. **Gerador (IA A):** recebe guia de estilo da banca, 3–5 itens reais aprovados do mesmo tópico canônico (quando existirem), o trecho de fonte e o programa do tópico no edital. Devolve JSON (validado com Zod): texto-base opcional e itens com gabarito, justificativa e citação.
3. **Deduplicação:** descarta itens cujo `hash_normalizado` (texto sem acentos, pontuação e espaços extras, em minúsculas) já exista.
4. **Validador (IA B):** recebe texto-base, itens **sem gabarito** e a fonte; devolve julgamento e justificativa por item.
5. **Decisão:** concordância → `aprovado`; discordância → `revisao` (fila manual, com as duas justificativas lado a lado). JSON inválido em qualquer etapa → item descartado e erro registrado.
6. **Alternância:** os papéis de gerador e validador alternam entre Claude e GPT a cada job.

### 5.3 Itens reais

Tela de importação: colar texto-base e itens com gabarito oficial e informar a prova de origem. A IA sugere tópicos canônicos e o usuário confirma. Os itens entram como `origem=real`, `aprovado`. Em modo produto (flag de configuração), itens reais deixam de ser exibidos a usuários e servem apenas como referência de estilo.

### 5.4 Qualidade durante o uso

Qualquer item pode ser marcado como **suspeito** (com comentário opcional). Itens suspeitos saem da seleção de sessões e suas respostas são excluídas das estatísticas até a revisão, que os devolve a `aprovado` (com gabarito corrigido, se for o caso) ou os marca como `descartado`.

## 6. Simulador e motor de foco

### 6.1 Modos

| Modo | Seleção de itens | Tempo | Feedback |
|---|---|---|---|
| **Estudar agora** (treino adaptativo, tela principal) | 20 itens (configurável): ~70% tópicos de maior prioridade, ~20% revisão espaçada vencida, ~10% tópicos fortes (manutenção) | livre | imediato: gabarito, justificativa, fonte |
| **Treino por tópico** | tópicos e quantidade escolhidos pelo usuário; prioriza itens não vistos | livre | imediato |
| **Revisão de erros** | itens com revisão espaçada vencida | livre | imediato |
| **Simulado completo** | provas do cargo (P1 + P2) seguindo a `distribuicao` do YAML, **sem viés adaptativo**, priorizando itens não vistos | 4h30 (opção "só objetivas": 3h30) | apenas ao final |

Itens de um mesmo texto-base são apresentados juntos. Cada resposta é salva ao ser marcada; sessões interrompidas podem ser retomadas.

### 6.2 Pontuação e resultado

O motor de `core/` aplica a regra de pontuação e as regras de corte da prova. No simulado, `np = 0`. O resultado mostra nota por prova e total, cortes, situação (aprovado/eliminado e qual corte falhou), desempenho por disciplina e a **análise de dúvida**: saldo líquido dos itens marcados como dúvida, por disciplina, com a recomendação de arriscar mais (saldo positivo) ou deixar mais itens em branco (saldo negativo). A recomendação só aparece com pelo menos 10 itens com dúvida na disciplina.

### 6.3 Repetição espaçada

Um item errado ou deixado em branco entra na etapa 1. Intervalos: 1, 3, 7 e 15 dias. Acertar sem dúvida avança uma etapa; acertar após a etapa 4 remove o item da revisão. Errar ou deixar em branco volta para a etapa 1. Acertar com dúvida mantém a etapa.

### 6.4 Motor de foco

A prioridade é calculada por **tópico folha do edital**, para o cargo do usuário. As respostas são agregadas via tópico canônico.

```
prioridade = peso × fraqueza × esquecimento × incerteza
```

- **peso** = itens estimados da disciplina na prova ÷ nº de tópicos folha da disciplina.
- **fraqueza** = `(1 − L) / 2`, onde `L ∈ [−1, 1]` é o aproveitamento líquido ponderado: cada resposta vale +1 (certa sem dúvida), +0,5 (certa com dúvida), −1 (errada) ou 0 (branco), com peso `0,5^(dias/14)` (meia-vida de 14 dias). Sem respostas: `L = 0`.
- **esquecimento** = `max(0,1; 1 − e^(−dias_desde_última/7))`; nunca praticado = 1.
- **incerteza** = `1 + 1/(1 + n/5)`, onde `n` = respostas no tópico.

As constantes ficam em um único arquivo de configuração de `core/`. Itens suspeitos e descartados são ignorados.

**Geração automática:** ao montar "Estudar agora", se algum dos 10 tópicos de maior prioridade tiver menos de 10 itens aprovados não vistos pelo usuário, um job de geração é enfileirado para ele (no máximo 3 jobs automáticos pendentes por vez). A sessão atual usa os itens disponíveis; se faltarem, completa com os próximos tópicos da lista.

### 6.5 Painel

- Contagem regressiva até a prova.
- Evolução das notas nos simulados completos em relação a M1, M2 e M3.
- Tabela por disciplina e tópico: aproveitamento líquido, taxa de brancos, nº de respostas, tendência de 4 semanas e prioridade atual.
- Lista dos 10 tópicos prioritários, com ação "treinar este tópico".
- Fila de revisão de itens (discordâncias e suspeitos).
- Custo de IA no mês, por finalidade.

## 7. Tratamento de erros

- **Falha ou limite de um provedor de IA:** o job usa o outro provedor para o papel em falha. Se ambos falharem, o job volta para a fila com backoff (até 3 tentativas) e depois fica `falhou` e visível no painel. O estudo nunca depende de geração síncrona.
- **Saída de IA fora do schema:** item descartado, erro registrado no job.
- **Interrupção de sessão:** respostas persistidas uma a uma; a sessão aberta aparece como "retomar" na tela inicial; o cronômetro do simulado completo usa `iniciado_em` do servidor.
- **Itens insuficientes para simulado completo:** o app mostra quantos faltam por disciplina e oferece enfileirar a geração.
- **YAML inválido:** o seed falha com a mensagem de validação e não altera o banco (transação).

## 8. Testes

- **Unitários (Vitest) em `core/`:** pontuação e cortes (incluindo np > 0, comparados com cálculo manual pelas fórmulas do edital), regras de múltipla escolha, prioridade do motor de foco, repetição espaçada, montagem de sessões (proporções 70/20/10, agrupamento por texto-base, distribuição do simulado completo) e validação do `edital.yaml` real do CBM-AL.
- **Integração:** pipeline de geração com provedores falsos (concordância, discordância, JSON inválido, falha de provedor, deduplicação); seed contra Supabase local.
- **E2E (Playwright):** sessão "Estudar agora", simulado curto até o resultado, interromper e retomar, marcar item como suspeito.
- Testes automatizados nunca chamam IA real. Um script manual (`scripts/try-prompt`) permite avaliar os prompts com chamadas reais.

## 9. Entregas (ordem de implementação)

1. Projeto base: Next.js, Supabase (migrações, Auth por link mágico, RLS), deploy na Vercel.
2. `edital.yaml` do CBM-AL (CFO e Soldado), taxonomia canônica, distribuição estimada e seed.
3. `core/`: pontuação, cortes, motor de foco, repetição espaçada e montagem de sessões, com testes.
4. `ai/` (Claude e GPT, registro de custo), `fontes` legais e pipeline de geração e validação com fila de jobs.
5. "Estudar agora", treino por tópico e revisão de erros.
6. Simulado completo com resultado e análise de dúvida.
7. Painel de desempenho e fila de revisão de itens.
8. Importação de itens reais.

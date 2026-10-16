# Corretor de Discursiva — Especificação de Design

- **Data:** 2026-10-15
- **Status:** aprovado em brainstorming, aguardando revisão do documento
- **Sub-projeto:** 2 de 4 da plataforma de estudos para concursos (ver `2026-10-14-nucleo-simulador-design.md`)
- **Concurso piloto:** CBM-AL 2026 (Cebraspe), prova P3 – discursiva, comum a CFO e Soldado

## 1. Contexto e objetivo

O Núcleo + Simulador já treina as provas objetivas e direciona o estudo aos pontos fracos. Falta a prova discursiva, que elimina quem tirar menos de 15. Este sub-projeto permite **escrever (ou fotografar) a redação, recebê-la corrigida no padrão Cebraspe e usar os erros para orientar o estudo de Língua Portuguesa**.

### Decisões do brainstorming

| Tema | Decisão |
|---|---|
| Origem dos temas | IA gera (com padrão de resposta), e temas reais podem ser importados, como os itens reais |
| Entrada | Folha digitada de 30 linhas na tela **e** foto da folha manuscrita, com transcrição conferida pelo usuário antes da correção |
| Devolutiva | Espelho no estilo Cebraspe (nota por aspecto, erros por linha, cálculo do NPD) + 3 prioridades de estudo |
| Motor de foco | Erros de língua alimentam os tópicos de LP do edital, com peso menor que um item errado; o painel ganha uma seção de redação |
| Correção | Duas IAs independentes corrigem o conteúdo, como os dois examinadores da banca, com terceira correção na divergência; processamento em segundo plano pela fila de jobs |

### Critérios de sucesso

- Para uma correção com notas e erros conhecidos, o NPD exibido coincide com o cálculo manual pela fórmula do edital, incluindo convergência, terceira correção e casos de nota zero.
- Uma redação entregue nunca se perde: falhas de IA deixam a redação em estado recuperável, com o texto intacto.
- Um segundo concurso com discursiva pode ser atendido apenas com seu `edital.yaml` (pontuação, linhas, mínimo, caracteres por linha), sem alterar código.
- Após corrigir uma redação com erros de concordância, o tópico `portugues/concordancia-verbal-e-nominal` sobe na lista de prioridades.

### Fora de escopo

Comparação com outros candidatos, reescrita automática da redação, outros gêneros (peças, pareceres, estudos de caso; o campo `tipo` do tema deixa espaço), recursos contra o padrão de resposta.

## 2. Fatos do edital usados no design

Fonte: Edital nº 1, itens 9.1 a 9.7 (texto em `editais/cbmal-2026/edital-01-abertura.pdf`).

- 9.1: 30,00 pontos; texto dissertativo de até 30 linhas sobre Atualidades.
- 9.7.1: só é corrigida a discursiva de quem foi aprovado nas objetivas; quem não tem a discursiva corrigida é eliminado (9.7.2).
- 9.7.4.1.1 a 9.7.4.1.3: conteúdo avaliado por dois examinadores; vale a média de duas notas **convergentes** (diferença de até 25% da nota máxima de conteúdo, ou seja, 7,5 pontos). Se divergirem, há terceira correção e vale a média das duas notas mais próximas.
- 9.7.5:
  - NC (apresentação, estrutura e desenvolvimento do tema) até 30,00;
  - NE = número de erros de grafia, morfossintaxe e propriedade vocabular;
  - texto fora do local ou além da 30ª linha é desconsiderado;
  - `NPD = NC − 6 × NE ÷ TL`, com TL = linhas efetivamente escritas;
  - NPD < 0 vira 0; fuga ao tema ou ausência de texto dá 0.
- 9.7.6: aprovado com NPD ≥ 15,00.
- O edital **não** fixa um número mínimo de linhas. O app não inventa essa regra.

## 3. Modelo de dados

Nova migração `0009_discursiva.sql`, aplicada pelo controlador (não pelos agentes).

### `temas_discursiva`
- `id`, `concurso_id`, `prova_id` (prova `discursiva`), `tipo` (`dissertativo` por ora), `origem` (`gerado` | `real`), `prova_origem` (texto, para temas reais), `status` (`aprovado` | `revisao` | `rejeitado`).
- `enunciado` (texto), `textos_apoio` (jsonb: lista de `{titulo, texto, fonte}`).
- `padrao_resposta` (jsonb): lista de aspectos `{codigo, descricao, pontos}` cuja soma é a NC máxima (30), mais `expectativas` (texto livre com o que a banca espera).
- `hash` para deduplicar, `criado_em`.
- RLS: leitura por usuários autenticados apenas de temas `aprovado`; escrita só via service role ou função `security definer` de importação, chamada apenas por moderador (mesmo padrão de `itens_importar_reais`).

### `redacoes`
- `id`, `usuario_id`, `tema_id`, `simulado_id` (nulo fora do simulado).
- `entrada` (`digitada` | `foto`), `linhas` (text[] com até 30 linhas válidas; excedente guardado em `excedente` text[]).
- `status`: `rascunho` → (`transcrevendo` → `aguardando_confirmacao`, só com foto) → `na_fila` → `corrigindo` → `corrigida` | `falhou`.
- Resultado consolidado: `nc`, `ne`, `tl`, `npd`, `zerada_motivo` (`fuga_tema` | `sem_texto` | `npd_negativo` | nulo), `terceira_correcao` (bool), `prioridades` (jsonb), `corrigida_em`.
- `fotos` (text[] com caminhos no Storage), `fotos_apagar_em`.
- RLS: o dono lê e edita só as próprias, e só em `rascunho` ou `aguardando_confirmacao`. Mudanças de estado posteriores só pelo worker (service role).

### `correcoes_discursiva`
- `id`, `redacao_id`, `papel` (`conteudo_1` | `conteudo_2` | `conteudo_3` | `lingua` | `transcricao`), `provedor`, `modelo`, `resposta` (jsonb validado), `custo_usd`, `criado_em`.
- Cada chamada de IA concluída é gravada aqui imediatamente; é o que permite retomar sem pagar de novo.
- RLS: o dono da redação lê; só service role escreve.

### `erros_redacao`
- `id`, `redacao_id`, `usuario_id`, `linha` (1–30), `trecho`, `tipo` (`grafia` | `morfossintaxe` | `propriedade_vocabular`), `correcao`, `explicacao`, `canonico` (tópico de LP), `criado_em`.
- Fonte do motor de foco e das estatísticas de "erros frequentes".

### Storage
- Bucket privado `redacoes-fotos`, com política por pasta `usuario_id/`. Fotos apagadas 30 dias após a correção (job diário ou na passagem do worker).

### Funções
- `discursiva_entregar(p_redacao)` (`security definer`, confere `auth.uid()`): valida dono e estado, aplica os limites (no máximo 2 redações em `na_fila`/`corrigindo` e 10 entregas por dia por usuário) e enfileira `corrigir_redacao`.
- `discursiva_pedir_tema(p_concurso)` (`security definer`): enfileira `gerar_tema`, com limite próprio (igual a `estudo_pedir_geracao`).
- `discursiva_importar_temas(jsonb)`: só service role; a Server Action verifica `ehModerador`.
- `estudo_historico` passa a incluir os erros de redação (ver §7).

## 4. Núcleo puro (`src/core/discursiva/`)

Sem I/O, testado à exaustão.

- `nota.ts`:
  - `notaConteudo(notas: number[], max)`: aplica convergência (≤ 25% de `max`) e, com três notas, a média das duas mais próximas (empate: a maior média). Devolve `{nc, precisaTerceira}`.
  - `calcularNPD({nc, ne, tl, fugaTema})`: aplica a fórmula, zera fuga ao tema, texto vazio e NPD negativo. Arredonda a 2 casas no final, como a banca publica.
  - `aprovado(npd, minimo)`.
- `linhas.ts`: `distribuirEmLinhas(texto, caracteresPorLinha)` quebra por palavra, respeita parágrafos (linha nova) e corta palavra maior que a linha. Devolve linhas válidas (até `linhas_max`) e excedente. `contarTL(linhas)` conta as não vazias.
- `erros.ts`: `filtrarErrosValidos(erros, linhas)` descarta erros com linha inexistente ou trecho ausente na linha (comparação normalizada de espaços e caixa). `mapearCanonico(tipo, categoria)` usa a tabela da §7.
- `prioridades.ts`: escolhe as 3 prioridades a partir de aspectos com menor aproveitamento e categorias de erro mais frequentes.
- Configuração vinda do edital: `pontuacao_maxima`, `linhas_max`, `nota_minima` e o novo `caracteres_por_linha` (padrão 70) na prova `discursiva` do `edital.yaml`; o carregador do edital e os tipos passam a aceitar esse campo.

## 5. Pipeline de IA (`src/pipeline/discursiva/`)

Segue o padrão existente: prompts versionados, respostas validadas com Zod, custo registrado em `ai_usage`, nenhuma chamada real em testes (usa `src/ai/falso.ts`).

### Jobs
- **`gerar_tema`**: uma IA gera tema, textos de apoio e padrão de resposta (aspectos somando 30); a outra valida às cegas (o tema é atual, plausível para a Cebraspe e o padrão é coerente). Concordância → `aprovado`; senão → `revisao`.
- **`transcrever_redacao`**: modelo com visão lê as fotos e devolve 30 linhas, marcando cada linha `{texto, confianca}`. Se mais de 20% das linhas vierem ilegíveis, a redação volta para `rascunho` com o aviso "foto ilegível, envie outra". Senão, vai para `aguardando_confirmacao`.
- **`corrigir_redacao`**, em etapas idempotentes. Antes de cada chamada, consulta `correcoes_discursiva` e pula o que já existe:
  1. `conteudo_1` (Claude) e `conteudo_2` (GPT), cada um sem ver o outro. Recebe tema, padrão de resposta e as linhas numeradas. Devolve, por aspecto, `{codigo, nota, justificativa}` e `fuga_tema: bool`.
  2. `lingua` (Claude): devolve a lista de erros `{linha, trecho, tipo, categoria, correcao, explicacao}`.
  3. O código soma as notas por aspecto, cortando cada uma no máximo do aspecto, e aplica `notaConteudo`.
     - Se as notas divergirem, ou se só uma banca apontar fuga ao tema, roda `conteudo_3` com o modelo que ainda não corrigiu aquela redação. Por padrão é o Claude, de novo e com outra semente de instrução.
     - Fuga ao tema só zera a nota se as duas notas usadas concordarem.
  4. O código filtra os erros, calcula NE, TL e NPD, grava `erros_redacao`, monta as prioridades e marca `corrigida`.
- Retentativas: até 3 por job, como hoje; esgotadas → `falhou`, com o botão "Tentar de novo" (chama `discursiva_entregar` de novo, que aceita o estado `falhou`).

### Configuração
- Modelos por papel, por variável de ambiente, com padrões:
  - `DISCURSIVA_MODELO_CONTEUDO_1` = Claude;
  - `DISCURSIVA_MODELO_CONTEUDO_2` = GPT;
  - `DISCURSIVA_MODELO_LINGUA` = Claude;
  - `DISCURSIVA_MODELO_TRANSCRICAO` = Claude.
- Os padrões reaproveitam `CLAUDE_MODEL`/`OPENAI_MODEL` e a configuração de esforço atual.
- Limites: 2 redações em correção ao mesmo tempo e 10 entregas por dia, fixos na função `discursiva_checar_limites` do banco (mudar exige migração; variável de ambiente não protegeria uma função chamada direto pela API).
- Custo esperado: US$ 0,10 a 0,25 por correção, + cerca de US$ 0,05 com foto, + cerca de US$ 0,03 por tema gerado.

## 6. Telas

Seguem `docs/design/DESIGN.md`, tokens do tema claro e escuro, componentes de `src/components/ui.ts`.

- **`/redacao`**:
  - ações "Gerar tema novo" e "Escolher tema" (reais primeiro, depois gerados ainda não feitos);
  - lista das redações com tema, data, estado e NPD;
  - gráfico pequeno de evolução do NPD.
- **`/redacao/[id]`**, uma página com três modos conforme o estado:
  - **Escrita** (`rascunho`):
    - enunciado e textos de apoio recolhíveis;
    - folha com 30 linhas numeradas, preenchida por `distribuirEmLinhas` enquanto o usuário digita;
    - contador "N/30 linhas" e excedente marcado em vermelho como "não será corrigido";
    - cronômetro opcional (1 h sugerida);
    - rascunho salvo automaticamente (com debounce);
    - botões "Enviar foto da folha" e "Entregar para correção".
  - **Conferência da foto** (`aguardando_confirmacao`):
    - a foto ao lado das 30 linhas editáveis (empilhadas no celular);
    - linhas de baixa confiança destacadas;
    - botão "Confirmar transcrição", que entrega para correção.
  - **Correção em andamento** (`na_fila`/`corrigindo`):
    - passos com estado (Banca 1, Banca 2, Revisão de língua, Terceira correção quando houver), lidos de `correcoes_discursiva`;
    - atualização periódica; dá para sair e voltar.
  - **Resultado** (`corrigida`), em blocos:
    1. NPD em destaque, com pílula acima ou abaixo do mínimo e a conta por extenso;
    2. tabela de aspectos com nota de cada banca, média e justificativas, e o aviso de terceira correção;
    3. o texto com erros sublinhados por linha; tocar mostra tipo, correção e explicação;
    4. 3 prioridades com links para treinar o tópico;
    5. padrão de resposta recolhido.
  - **Falhou**: mensagem clara, texto preservado e "Tentar de novo".
- **`/importar`**: nova aba "Temas de discursiva" para moderadores, com validação de formato e relatório de gravados/duplicados.
- **Navegação**: item "Redação" no cabeçalho.

## 7. Integração com o estudo

### Motor de foco
- `RespostaHistorico` ganha `peso` opcional (padrão 1).
- Cada erro de redação entra no histórico como um `errado` no tópico canônico mapeado, com `peso = 0,5` (`CONFIG_FOCO.pesoErroRedacao`), sujeito à mesma meia-vida.
- Mapeamento de `categoria` do erro para o tópico de LP:

| Categoria | Tópico canônico |
|---|---|
| ortografia, acentuação, hífen | `portugues/ortografia` |
| concordância | `portugues/concordancia-verbal-e-nominal` |
| regência | `portugues/regencia-verbal-e-nominal` |
| crase | `portugues/crase` |
| pontuação | `portugues/pontuacao` |
| colocação pronominal | `portugues/colocacao-pronominal` |
| tempos e modos verbais | `portugues/tempos-e-modos-verbais` |
| coesão e conectores | `portugues/coesao-referenciacao-conectores` |
| classes de palavras | `portugues/classes-de-palavras` |
| coordenação/subordinação | `portugues/coordenacao` ou `portugues/subordinacao` |
| propriedade vocabular | `portugues/significacao-das-palavras` |

- A IA de língua escolhe a `categoria` numa lista fechada (enum no schema), então o mapeamento é determinístico.

### Painel
- Nova seção "Redação":
  - último NPD e média das últimas 5;
  - evolução do NPD;
  - as 5 categorias de erro mais frequentes nos últimos 30 dias.

### Simulado completo
- O modo "completo" passa a incluir a discursiva no mesmo cronômetro de 4h30. A opção "só objetivas" (3h30) continua.
- A redação do simulado é entregue junto com as objetivas e corrigida em seguida.
- O resultado do simulado mostra a nota das objetivas imediatamente e a da discursiva quando a correção terminar.
- Se o candidato não passou nos cortes das objetivas, aparece o aviso: "Na prova real, sua redação não seria corrigida (item 9.7.1)". A redação é corrigida mesmo assim, para treino.

## 8. Erros e casos-limite

- IA devolve JSON inválido → conta como falha da etapa e entra na retentativa; a resposta bruta vai para o log do job.
- Erros fora do texto → descartados por `filtrarErrosValidos`; quantidade descartada registrada na correção.
- Nota de aspecto acima do máximo → cortada no máximo; nota negativa → 0.
- Texto vazio (TL = 0) → NPD 0, motivo `sem_texto`, sem chamar IA.
- Foto ilegível → volta a `rascunho`, com aviso.
- Entrega acima do limite → mensagem com o motivo e o horário em que libera.
- Tema `revisao`/`rejeitado` nunca aparece para escolha.

## 9. Testes

Nenhum teste chama IA real.

- **Unitários** (`src/core/discursiva/`):
  - NPD com valores do edital;
  - convergência no limite exato de 7,5;
  - terceira correção, com empate entre as duas notas mais próximas;
  - zeros por fuga ao tema, texto vazio e NPD negativo;
  - distribuição de linhas (palavra longa, parágrafos, excedente);
  - filtro de erros;
  - mapeamento de categorias.
- **Pipeline**, com IA falsa:
  - ordem das etapas;
  - retomada após falha no meio sem refazer etapas pagas;
  - terceira correção só na divergência;
  - fuga ao tema apontada por uma banca só;
  - transcrição ilegível.
- **Banco** (Postgres local, `*.dbtest.ts`):
  - RLS de `redacoes`, `correcoes_discursiva` e `erros_redacao`;
  - limites de `discursiva_entregar`;
  - importação restrita a service role.
- **Motor de foco**: um erro de redação aumenta a prioridade do tópico com metade do efeito de um item errado.
- **E2E** (infraestrutura de Playwright + Supabase local já em construção): escrever uma redação, entregar e ver o estado "na fila". O resultado é semeado direto no banco local para testar a tela de devolutiva.

## 10. Entrega

Quatro etapas, cada uma com plano próprio executado por agentes, commit por tarefa, revisão do controlador entre etapas:

1. **Núcleo**: `src/core/discursiva/`, tipos, campo `caracteres_por_linha` no edital, migração `0009_discursiva.sql` (aplicada pelo controlador) e tipos do banco.
2. **Pipeline**: prompts, schemas, jobs `gerar_tema`, `transcrever_redacao` e `corrigir_redacao` no worker, limites e custos.
3. **Telas**: `/redacao`, escrita, conferência da foto, andamento e resultado.
4. **Integração**: simulado completo, motor de foco, painel e importação de temas reais.

Para ir ao ar: aplicar a migração (inclui o bucket privado) e, opcionalmente, definir as variáveis `DISCURSIVA_*`. Nenhuma chave nova.

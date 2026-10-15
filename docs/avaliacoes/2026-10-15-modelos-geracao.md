# Avaliação de modelos Claude para gerar itens (2026-10-15)

## Pergunta

Hoje o Claude gera lotes com `claude-opus-5-5` em esforço `high`, a US$ 0,05 a 0,07 por lote. Um modelo mais barato gera itens Cebraspe com qualidade suficiente?

## Como foi medido

- Script: `scripts/avaliar-modelos.ts` (manual, fora do `npm test`). Rodado uma vez com `npx tsx --env-file=.env.local scripts/avaliar-modelos.ts <pasta>`.
- Seis tópicos fixos do `editais/cbmal-2026/edital.yaml`:
  `portugues/concordancia-verbal-e-nominal`, `raciocinio-logico/contagem-e-probabilidade`, `fisica/leis-de-newton`, `direito-administrativo/ato-administrativo`, `informatica/virus-worms-e-pragas-virtuais` e `legislacao-cbmal/lei-5346-1992-estatuto` (com o texto de `editais/cbmal-2026/fontes/lei-al-5346-1992.txt`, janela da rodada 4: arts. 33 a 40).
- Cada candidato gerou 1 lote de 5 itens por tópico chamando o próprio `gerarLote` do pipeline, com o mesmo prompt (`PROMPT_VERSAO` 2026-10-15.1). O repositório foi trocado por um em memória: nada foi gravado no Supabase e não houve itens reais como exemplo de estilo (em produção o prompt recebe até 5).
- Validador cego fixo: Claude Opus 5.5, esforço `high`, com o prompt de validação existente. A OpenAI está bloqueada neste ambiente.
- Candidatos: Haiku 5.5 `high`, Sonnet 5.5 `high` e Opus 5.5 `high` (referência).
- Custo calculado de `usage` × `PRECOS_CLAUDE`. Trava de orçamento de US$ 1,50. Gasto real: **US$ 0,7644** (US$ 0,43 em geração e US$ 0,34 em validação).
- Itens e julgamentos brutos (279 KB, não versionados): `/tmp/claude-0/-home-user-concursos/a05e04a6-07e3-51d2-a00d-eafc74660174/scratchpad/avaliacao-modelos/resultados.json`.

## Resultado

| Modelo (esforço) | Custo de geração por lote | Faixa por lote | Tokens de saída por lote | Tempo médio de geração | Concordância com o validador | Itens inválidos ou descartados | Lotes com texto-base ou situação |
|---|---|---|---|---|---|---|---|
| Haiku 5.5 (high) | US$ 0,0018 | 0,0011 a 0,0033 | 3.335 | 15,5 s | 30/30 (100%) | 0 | 0/6 |
| Sonnet 5.5 (high) | US$ 0,0176 | 0,0139 a 0,0244 | 1.533 | 11,4 s | 30/30 (100%) | 0 (1 item mal redigido) | 0/6 |
| Opus 5.5 (high) | US$ 0,0517 | 0,0402 a 0,0728 | 2.371 | 21,8 s | 30/30 (100%) | 0 | 3/6 |

Outras observações das métricas:

- Nenhuma falha de API, recusa, saída fora do schema, item faltando, duplicado, dificuldade fora de 1 a 3 ou item de lei sem citação.
- Gabarito equilibrado em todos (C/E: Haiku 17/13, Sonnet 16/14, Opus 13/17).
- A validação cega com Opus custou cerca de US$ 0,019 por lote e levou cerca de 8 s.
- O custo do Opus aqui (US$ 0,04 a 0,07) bate com o de produção, o que dá confiança à comparação de custo.
- O Haiku pensa muito em `high` (mais tokens de saída que o Opus), mas o preço por token é 40 vezes menor.

**A concordância não separou os modelos.** Os 90 itens tiveram o gabarito confirmado. Conferi à mão os cálculos de contagem e probabilidade, os de física e os itens da Lei 5.346/1992 contra o texto: todos corretos. A diferença entre os modelos está no estilo e na profundidade, não no acerto do gabarito.

## Qualidade lida nos itens

### Opus 5.5

O mais próximo da Cebraspe. Em Português criou um texto-base sobre transparência pública e fez os 5 itens sobre ele (reescrita, substituição de forma verbal), que é o formato típico da banca. Em RLM e Física montou uma situação hipotética e encadeou os itens nela; na Física, a situação é um salvamento em altura, aderente ao CBM. As pegadinhas são finas e corretas. Exemplos:

- Bom (Português, E): "A expressão 'é necessária muita paciência' poderia ser reescrita como é necessário muita paciência sem prejuízo da correção gramatical, porque [...] este permanece sempre invariável." Testa a regra com determinante, não a decoreba.
- Bom (Lei 5.346, E): "[...] abster-se, sem qualquer exceção, do uso das designações hierárquicas para discutir [...] pela imprensa [...]". A alínea d do inciso XVIII do art. 39 ressalva os assuntos exclusivamente técnicos. Pegadinha de exceção legítima, tirada do texto.
- Bom (RLM, E): "[...] a probabilidade de que os sorteados sejam de sexos diferentes será inferior a 1/2." Exige o cálculo (8/15).

Ponto fraco: é o mais caro e o mais lento.

### Sonnet 5.5

Correto e com boa variedade de conceitos, mas com itens isolados e sem texto-base de verdade; o campo `texto_base` vira só o comando ("Julgue os itens a seguir..."). Algumas pegadinhas boas e um item ruim:

- Bom (Informática, E): "Keyloggers [...] sendo, por isso, ineficazes contra o uso de teclados virtuais [...] que impedem qualquer forma de captura". Generalização indevida típica e fundamentada (screenlogger).
- Bom (RLM, E): senha de 4 dígitos distintos sem zero na frente "igual a 5.040" (o certo é 4.536). Distrator plausível.
- Ruim (Português, E): "[...] o uso do singular em 'foi' é admitido pela norma-padrão, pois a expressão 'bem como' estabelece relação de adição equivalente à da conjunção 'e', o que exigiria o plural 'foram'." O enunciado se contradiz; o gabarito sobrevive, mas o item é confuso.
- Fraco: itens com duas ideias julgáveis ("Vendem-se casas" e "Precisa-se de servidores" no mesmo item; "anexas" e "em anexo" no mesmo item), contra a própria regra do guia de estilo. Detalhe solto na Física ("elevador de massa desprezível").

### Haiku 5.5

Gabaritos certos, mas itens mais escolares e repetitivos:

- Redundância no lote: em Informática, 3 dos 5 itens giram em torno de "vírus precisa de hospedeiro, worm não"; em Direito Administrativo, 2 itens tratam da mesma troca ato composto x ato complexo.
- Pegadinhas óbvias: "Sempre que o sujeito for composto e vier ligado pela conjunção 'ou', o verbo deverá obrigatoriamente ser flexionado no plural, independentemente do sentido da frase."
- Lei seca copiada: em Legislação os itens certos são transcrições quase literais ("O Conselho de Justificação também poderá ser aplicado aos Oficiais da reserva."), e um deles veio marcado como dificuldade 3.
- Redação menos precisa: "um corpo em repouso permanece em repouso, ou em movimento retilíneo uniforme, enquanto a resultante [...] for nula" (a frase junta repouso e MRU de forma ambígua).
- `citacao` nas disciplinas sem lei vira um parágrafo de doutrina em vez de uma referência curta.
- Bom: os itens de Legislação foram fiéis ao texto, com prazo trocado (12 h em vez de 24 h) como distrator legítimo, e a RLM teve um item de complementar bem feito (comissões sem A e B juntos).

## Limites desta avaliação

- Amostra pequena: 6 lotes (30 itens) por modelo, uma rodada só, sem medir variância.
- O validador é o próprio Opus 5.5. Isso favorece o Opus como gerador (autovalidação) e, com 100% de concordância, a métrica ficou no teto: ela só pega gabarito errado, não item fraco.
- Sem itens reais como exemplo de estilo no prompt, que em produção existem e podem aproximar os modelos menores da banca.
- Não testei esforços `medium` ou `low` (orçamento). Sonnet `medium` e Opus `medium` são as próximas variações óbvias.

## Recomendação

1. **Gerar com Claude Sonnet 5.5, esforço `high`**, como padrão do lado Claude. Custa cerca de um terço do Opus (US$ 0,018 contra US$ 0,052 por lote), é o mais rápido, e acertou todos os gabaritos. A perda de qualidade é real, mas pequena: menos texto-base e alguns itens com duas ideias, que a revisão e o validador cego da outra IA seguram. Para trocar, basta `CLAUDE_MODEL=claude-sonnet-5-5` (e, se quiser explicitar, `CLAUDE_ESFORCO=high`) no Vercel e no `.env.local`; nenhum código precisa mudar.
2. **Manter o Opus 5.5 (`high`) para Língua Portuguesa** se o orçamento permitir. É onde a diferença mais aparece: a prova de Português da Cebraspe é baseada em texto-base, e só o Opus produziu isso. Hoje o modelo é global; separar por disciplina exigiria um mapa disciplina → modelo em `src/pipeline/config.ts` e no `gerarLote`. Vale fazer só se, depois de algumas semanas com Sonnet, a taxa de itens de Português em `revisao` ou rejeitados na moderação subir. A economia de usar Sonnet em tudo (em vez de Opus só em Português) é de uns US$ 0,034 por lote de Português gerado pelo Claude, ou seja, pouco em termos absolutos.
3. **Não usar o Haiku 5.5 como gerador padrão.** É 29 vezes mais barato que o Opus e não errou gabarito, mas os lotes são repetitivos e as pegadinhas, rasas. Se um dia for preciso volume muito barato, o único uso razoável é Legislação com fonte (lei seca), onde o texto da lei limita o estrago e a fidelidade foi boa.
4. **Próximo experimento barato**, se quiser refinar: rodar o mesmo script com Sonnet `medium` e Opus `medium` (editar `CANDIDATOS`), de preferência com um validador diferente do Opus para tirar o viés de autovalidação.

## Mudanças de código desta avaliação

- `CLAUDE_ESFORCO` (opcional, `low` a `max`, padrão `high`) passa o esforço ao provedor Claude; antes só o modelo era configurável. `CLAUDE_MODEL` e `CLAUDE_ESFORCO` vazios (como no `.env.example`) agora contam como ausentes, em vez de quebrar a validação.
- O pedido ao Haiku 5.5 não envia mais `fallbacks`: o Haiku não tem fallback de recusa no servidor (com `"default"` a recusa continua recusa).
- `PRECOS_CLAUDE` já tinha Opus 5.5 (US$ 4/20), Sonnet 5.5 (US$ 2/10) e Haiku 5.5 (US$ 0,10/0,50 até 100 mil tokens de prompt); ganhou teste para os dois candidatos.
- O padrão do app continua `claude-opus-5-5` com esforço `high`.

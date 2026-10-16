# Deploy e configuração

## Supabase (projeto `concursos`, ref `gmcjgtpamdhqpclqxtvg`)

- Migrações: `supabase/migrations/`, aplicadas em ordem.
- Seed de um concurso: `npm run seed:gerar -- <slug>` gera `supabase/seed/<slug>.sql`, que é executado no SQL Editor ou via MCP. O SQL é idempotente; rode de novo após editar o `edital.yaml`.
- `jobs`, `ai_usage` e `seed_partes` têm RLS sem políticas de propósito: só o servidor, com a chave secreta (ou o SQL Editor/MCP, como dono do banco), acessa. O aviso "RLS enabled, no policy" do Security Advisor para essas tabelas é esperado.

### Carregar ou atualizar um edital pelo MCP

- **Pelo SQL Editor do painel:** basta colar o conteúdo de `supabase/seed/<slug>.sql` e executar.
- **Pelo MCP do Supabase:** o MCP trava em SQL que julga destrutivo (`DROP`, `DELETE ... USING`, funções grandes com vários `DELETE`), e o seed completo de um edital grande costuma cair nisso. Por isso a carga é feita em duas etapas:
  1. Envie o JSON do edital em partes para `public.seed_partes (lote, parte, conteudo)`, uma parte por chamada, usando dollar-quoting para não precisar escapar aspas:

     ```sql
     insert into public.seed_partes (lote, parte, conteudo)
     values ('<slug>', 1, $seed$...trecho do JSON...$seed$);
     ```

  2. Confira o `md5` de cada parte e do total contra os valores calculados localmente:

     ```sql
     select parte, md5(conteudo) from public.seed_partes where lote = '<slug>' order by parte;
     select md5(string_agg(conteudo, '' order by parte)) from public.seed_partes where lote = '<slug>';
     ```

  3. Com tudo conferido, carregue:

     ```sql
     select public.carregar_edital((select string_agg(conteudo, '' order by parte) from public.seed_partes where lote = '<slug>')::jsonb);
     ```

  Depois da carga, as linhas do lote em `seed_partes` podem ser apagadas pelo SQL Editor.

### Autenticação (painel do Supabase → Authentication → URL Configuration)

- **Site URL:** a URL de produção da Vercel (ex.: `https://concursos-luiz-inocencio.vercel.app`).
- **Redirect URLs:** `http://localhost:3000/**` e `https://concursos-*-luiz-inocencio.vercel.app/**`, mais a URL de produção com `/**` no final. O curinga cobre as URLs de preview que a Vercel cria a cada branch.
- Abra o link do e-mail no mesmo navegador e no mesmo endereço em que pediu o login: o código de acesso só pode ser trocado onde o pedido foi feito.
- Opcional: em Authentication → Sign In / Providers, desligue "Allow new users to sign up" depois do primeiro login, para que só a sua conta exista.

## Vercel

1. Em vercel.com → Add New → Project, importe o repositório `luiznocencio/concursos` (framework Next.js, sem alterações de build).
2. Em Settings → Environment Variables, cadastre para Production e Preview:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `AUTH_EMAILS_PERMITIDOS`
3. Faça o deploy e use a URL gerada nos campos de autenticação do Supabase acima.

## Testes

- `npm test`: suíte unitária.
- `npm run db:test:start && npm run test:db`: migrações, RLS e seed num Postgres local descartável. Fora do ambiente de nuvem, defina `TEST_DATABASE_URL` apontando para um Postgres seu (o usuário precisa poder criar bancos).
- `npx supabase start && npm run test:e2e`: E2E com Playwright contra o Supabase local (Docker), sem IA e sem tocar na produção. Detalhes, login nos testes e CI em [testes.md](testes.md).

## Geração de questões por IA

### Variáveis (Vercel → Settings → Environment Variables, e `.env.local` para os scripts)

| Variável | Onde obter |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → chave secreta (`sb_secret_…`) |
| `WORKER_SECRET` | Gere com `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CLAUDE_MODEL` | Opcional; padrão `claude-opus-5-5` (precisa ter preço em `src/ai/custo.ts`) |
| `CLAUDE_ESFORCO` | Opcional; `low`, `medium`, `high` (padrão), `xhigh` ou `max` |
| `OPENAI_API_KEY` | platform.openai.com → API keys |
| `OPENAI_MODEL` | O modelo GPT que você quer usar |
| `OPENAI_PRECO_ENTRADA_USD_MTOK`, `OPENAI_PRECO_SAIDA_USD_MTOK` | Preço desse modelo na página de preços da OpenAI |

### Como funciona

1. Um job `gerar_itens` entra na fila (`npm run ia:enfileirar -- cbmal-2026 portugues/crase 5`; no Plano 4, o próprio app enfileira).
2. O worker (`POST /api/jobs/worker`) pega um job: uma IA gera até 5 itens, a outra julga sem ver o gabarito.
3. Itens com concordância entram como `aprovado`; os demais ficam em `revisao`. O custo de cada chamada vai para `ai_usage`.
4. Falhas voltam para a fila com espera crescente; depois de 3 tentativas o job fica `falhou`, com a mensagem em `jobs.erro`.

Para testar uma geração na hora, sem fila: `npm run ia:lote -- cbmal-2026 portugues/crase 3` (chamada real, com custo).

### Agendar o worker no Supabase (SQL Editor)

Troque `<URL>` pela URL de produção e `<WORKER_SECRET>` pelo segredo. O segredo fica visível só para administradores do banco.

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule(
  'worker-jobs',
  '* * * * *',
  $$ select net.http_post(
       url := '<URL>/api/jobs/worker',
       headers := jsonb_build_object('Authorization', 'Bearer <WORKER_SECRET>'),
       timeout_milliseconds := 300000
     ) $$
);
```

Para parar: `select cron.unschedule('worker-jobs');`.

### Leis do CBM-AL

Coloque os textos em `editais/cbmal-2026/fontes/` com os nomes do `fontes.yaml` (texto puro, cada artigo começando com "Art.") e rode `npm run fontes:carregar -- cbmal-2026`. O script substitui os artigos de cada lei a cada execução.

## Telas de estudo

- **Início:** "Estudar agora" monta 20 itens pelo motor de foco (70% pontos fracos, 20% revisão, 10% manutenção). Se algum dos 10 tópicos prioritários tiver menos de 10 itens novos, a sessão pede geração (até 3 pedidos em aberto por pessoa, 5 itens cada). Os pedidos só andam com o worker agendado e as chaves de IA configuradas.
- **Treinar:** escolha tópicos do edital e a quantidade (10, 20 ou 30).
- **Simulado:** só as provas objetivas, na distribuição do edital, com 1h a menos que a duração total (a discursiva entra com o corretor de redação). A correção sai na entrega; erros e brancos vão para a revisão espaçada.
- **Painel:** contagem regressiva, evolução nos simulados contra os cortes, desempenho por disciplina e tópico, 10 tópicos prioritários. Moderadores veem também o custo de IA do mês, a fila de geração e o link para a revisão de itens.
- **Itens:** fila de itens em que as IAs discordaram ou que alguém marcou como suspeito. Aprovar, aprovar com o gabarito invertido ou descartar. Usa `SUPABASE_SECRET_KEY`.

Variável opcional: `MODERADORES_EMAILS` (Vercel, produção e preview). Sem ela, todos os e-mails de `AUTH_EMAILS_PERMITIDOS` moderam.

## Importação de itens reais

Tela **Importar** (só moderadores): itens de provas anteriores da banca, com o gabarito oficial.

1. Informe a prova de origem (ex.: "CBM-AL 2021 Soldado") e cole o texto da prova e o gabarito. O texto é lido no navegador: textos-base e comandos ("Julgue os itens a seguir...") seguidos de itens numerados. O gabarito aceita "1 C 2 E 3 X", uma resposta por linha ou a tabela do gabarito definitivo do Cebraspe. Anulados (X) não entram.
2. Confira a prévia: grupos, gabaritos e inconsistências (item sem gabarito, gabarito sem item, saltos na numeração, texto que sobrou). Se algo estiver errado, volte e corrija o texto colado; uma linha em branco entre blocos resolve quase tudo.
3. Tópicos: a IA (Claude, com as chaves de IA do worker) sugere 1 ou 2 tópicos canônicos do concurso por item; confirme ou troque. Sem as chaves, ou se a IA falhar, escolha à mão. O custo vai para `ai_usage` com a finalidade `sugerir_topicos`.
4. Gravar: os itens entram como `origem = real`, `status = aprovado`, com `prova_origem` e o gabarito oficial. Itens com o mesmo texto (hash normalizado) já gravados contam como duplicados e não se repetem. Usa `SUPABASE_SECRET_KEY`.

Variável opcional `ITENS_REAIS_VISIVEIS` (Vercel, produção e preview). Vazia ou `true`: os itens reais entram nas sessões (uso pessoal). `false`: modo produto, os itens reais saem de treino, simulado e revisão e continuam como exemplos de estilo na geração.

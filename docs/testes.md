# Testes

| Comando | O que cobre | Precisa de |
|---|---|---|
| `npm test` | Suíte unitária (`src/**/*.test.ts`) | Nada |
| `npm run test:db` | Migrações, RLS e seed (`src/**/*.dbtest.ts`) | Postgres em `TEST_DATABASE_URL` (ou `npm run db:test:start`) |
| `npm run test:e2e` | O app inteiro no navegador (`e2e/`) | Docker e o Supabase local |

## E2E (Playwright + Supabase local)

O E2E nunca usa o Supabase de produção nem chama IA. Roda contra o Supabase local do CLI, com as chaves de desenvolvimento lidas de `npx supabase status -o env` na hora (nenhuma chave fica no repositório; dá para sobrescrever com `E2E_SUPABASE_PUBLISHABLE_KEY` e `E2E_SUPABASE_SECRET_KEY`), e o app sobe com as chaves de IA vazias.

### Localmente

```bash
npx supabase start          # 1ª vez: baixa as imagens; aplica migrações e seed do edital
npx playwright install chromium   # só na 1ª vez
npm run test:e2e            # build + start do app na porta 3100 e os testes
```

- `supabase start` aplica `supabase/migrations/` e `supabase/seed/*.sql` num banco novo. Para voltar o banco local ao zero: `npx supabase db reset`.
- O `globalSetup` (`e2e/preparar-banco.ts`) aplica `e2e/banco/preparar.sql` a cada execução: semeia 3 itens aprovados por tópico canônico (o 2º com gabarito Errado), com hash `e2e:<tópico>:<n>`, sem duplicar.
- Para repetir os testes sem refazer o build: `E2E_SEM_BUILD=1 npm run test:e2e`. Um servidor já de pé na porta 3100 é reaproveitado (fora do CI); se ele estiver com outras variáveis, pare-o antes.
- Relatório: `npx playwright show-report`. Traces e capturas de tela dos testes que falharam ficam em `test-results/`.
- Endereços e chaves podem ser trocados por `E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`, `E2E_SUPABASE_SECRET_KEY`, `E2E_DB_URL`, `E2E_MAILPIT_URL` e `E2E_PORTA`; URLs fora de `localhost`/`127.0.0.1` são recusadas.
- O Next carrega `.env.local` no build, mas o E2E define todas as variáveis do app (`e2e/ambiente.ts`), inclusive as de IA como vazias; o que estiver no `.env.local` não vale durante o E2E.

### Login nos testes

- **Login completo** (`e2e/acesso.spec.ts`): pede o link pela tela `/entrar` com o e-mail autorizado do E2E, lê o e-mail no Mailpit local (`http://127.0.0.1:54324`) e abre o link, que passa pelo Auth local e pelo `/auth/callback`.
- **Demais testes**: o fixture `usuarioLogado` (`e2e/fixtures.ts`) cria um usuário novo por teste, gera o link mágico pela API de administração do Auth local e troca o token por uma sessão com o mesmo `@supabase/ssr` do app. Os cookies vão direto para o navegador. Como cada teste tem o seu usuário, sessões, respostas e pedidos de geração não se misturam.

### O que é neutralizado no banco local

- As migrações não agendam nada, mas o guia de deploy agenda o worker (`worker-jobs`, pg_cron + pg_net chamando a URL de produção). Se algum agendamento assim existir no banco local, `e2e/banco/preparar.sql` o desfaz (`cron.unschedule`) antes dos testes. As migrações não são alteradas.
- O worker (`/api/jobs/worker`) não roda no E2E: o teste de geração para quando a linha entra em `jobs` (conferida com a chave de serviço local).

### No CI

`.github/workflows/ci.yml` roda a cada push e pull request, em três jobs paralelos e sem segredos:

1. `npm ci`, `typecheck`, `lint` e `npm test`.
2. `npm run test:db` contra um Postgres 17 de serviço.
3. E2E: `supabase start` (CLI fixado em `supabase/setup-cli`), `npx playwright install --with-deps chromium` e `npm run test:e2e`. Se falhar, o relatório do Playwright e `test-results/` ficam como artifact `playwright-report` por 14 dias.

Nada precisa ser configurado no GitHub além de deixar o Actions habilitado.

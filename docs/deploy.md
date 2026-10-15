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

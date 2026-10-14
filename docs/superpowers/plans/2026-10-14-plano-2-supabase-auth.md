# Plano 2 — Supabase, seed do edital e login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o banco no Supabase (schema completo da spec §4.2 com RLS), carregar o edital do CBM-AL a partir do `edital.yaml` e colocar o app atrás de login por link mágico, pronto para deploy na Vercel.

**Architecture:** As migrações SQL vivem em `supabase/migrations/` e são testadas num Postgres local descartável, com stubs mínimos do Supabase (`auth.uid()`, papéis `anon`/`authenticated`/`service_role`). O seed é SQL **gerado** a partir do `edital.yaml` por uma função pura (`sqlDoEdital`), idempotente, aplicado no projeto remoto sem precisar da chave secreta. O app usa `@supabase/ssr` com a chave publicável; o `src/proxy.ts` (substituto do `middleware` no Next 16) renova a sessão e manda quem não está logado para `/entrar`.

**Tech Stack:** Next.js 16, `@supabase/supabase-js` 2.x, `@supabase/ssr` 0.12, `pg` 8 (só testes), `tsx` (scripts), Postgres 16 local para testes, projeto Supabase `concursos` (ref `gmcjgtpamdhqpclqxtvg`, região sa-east-1).

**Especificação:** `docs/superpowers/specs/2026-10-14-nucleo-simulador-design.md` (§3, §4.2, §7)

## Global Constraints

- O Next.js 16 tem APIs diferentes das versões anteriores. Antes de escrever código Next, consulte `node_modules/next/dist/docs/` (ex.: `01-app/03-api-reference/03-file-conventions/proxy.md`). O arquivo `middleware.ts` foi renomeado para `proxy.ts`, e a função exportada se chama `proxy`.
- `cacheComponents` e `partialPrefetching` ficam **desligados** (Task 1). O app é pessoal e dinâmico, e isso evita exigir `<Suspense>` em toda leitura de sessão.
- `src/core/` continua sem importar nada de `src/db`, `src/app` ou `src/lib`.
- Nenhuma chave secreta entra no repositório. `.env.local` fica fora do git; `.env.example` lista as variáveis sem valores.
- Tabelas de conteúdo: leitura para `authenticated`, sem escrita pelo cliente. Tabelas de uso (`simulados`, `simulado_itens`, `respostas`, `revisao_espacada`): o usuário só lê e escreve as próprias linhas (`user_id = auth.uid()`). `jobs` e `ai_usage`: sem política, só o servidor (service role) acessa.
- O login aceita apenas e-mails listados em `AUTH_EMAILS_PERMITIDOS` (separados por vírgula). Variável ausente ou vazia significa ninguém autorizado.
- Destinos de redirecionamento vindos da URL passam por `destinoSeguro` (só caminhos internos).
- Mensagens de commit terminam com as linhas de atribuição da sessão.

## Estrutura de arquivos

```
supabase/migrations/0001_conteudo.sql     # bancas, concursos, cargos, provas, disciplinas, tópicos, fontes, itens
supabase/migrations/0002_uso.sql          # simulados, simulado_itens, respostas, revisao_espacada, jobs, ai_usage
supabase/migrations/0003_rls.sql          # RLS e políticas
supabase/tests/stubs.sql                  # papéis e auth.uid() para o Postgres local
supabase/seed/cbmal-2026.sql              # gerado por npm run seed:gerar -- cbmal-2026
scripts/db-test.sh                        # sobe/derruba o Postgres de teste
scripts/gerar-seed.ts                     # edital.yaml -> supabase/seed/<slug>.sql
vitest.db.config.ts                       # suíte de testes de banco (*.dbtest.ts)
src/db/testing/banco.ts                   # cria banco descartável e executa como usuário
src/db/migracoes.dbtest.ts                # testes do schema e do RLS
src/db/seed/edital-sql.ts                 # sqlDoEdital(edital): string
src/db/seed/edital-sql.test.ts            # testes unitários do gerador
src/db/seed/edital-sql.dbtest.ts          # seed aplicado no Postgres
src/db/env.ts                             # leitura validada das variáveis públicas
src/db/types.ts                           # tipos gerados do Supabase
src/db/supabase/server.ts                 # cliente para Server Components, actions e rotas
src/db/supabase/proxy.ts                  # renovação de sessão usada pelo proxy
src/lib/auth/rotas.ts                     # rotaPublica, destinoSeguro, emailPermitido
src/proxy.ts                              # proteção das rotas
src/app/entrar/page.tsx, actions.ts       # login por link mágico
src/app/auth/callback/route.ts            # troca o código pela sessão
src/app/actions.ts                        # sair
src/app/page.tsx, layout.tsx, globals.css # página inicial mínima autenticada
docs/deploy.md                            # passos de deploy e configuração manual
```

---

### Task 1: Dependências, configuração e variáveis de ambiente

**Files:**
- Modify: `next.config.ts`
- Modify: `package.json`, `.gitignore`
- Create: `.env.example`
- Create: `src/db/env.ts`
- Test: `src/db/env.test.ts`

**Interfaces:**
- Produces: `lerEnvSupabase(env?): { url: string; chave: string }`

- [ ] **Step 1: Instalar dependências**

```bash
npm install @supabase/supabase-js@2 @supabase/ssr@0.12
npm install -D pg@8 @types/pg@8 tsx@4
```

- [ ] **Step 2: Desligar Cache Components**

Substitua o conteúdo de `next.config.ts` por:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
```

- [ ] **Step 3: Variáveis de ambiente**

Create `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# E-mails autorizados a entrar, separados por vírgula
AUTH_EMAILS_PERMITIDOS=
```

Em `.gitignore`, logo abaixo da linha que ignora `.env*`, adicione:

```
!.env.example
```

- [ ] **Step 4: Escrever o teste**

Create `src/db/env.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lerEnvSupabase } from "./env";

describe("lerEnvSupabase", () => {
  it("devolve url e chave válidas", () => {
    expect(
      lerEnvSupabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({ url: "https://abc.supabase.co", chave: "sb_publishable_x" });
  });

  it("lista as variáveis ausentes", () => {
    expect(() => lerEnvSupabase({ NEXT_PUBLIC_SUPABASE_URL: "nao-e-url" })).toThrow(
      "Variáveis do Supabase ausentes ou inválidas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});
```

- [ ] **Step 5: Rodar e confirmar a falha**

Run: `npx vitest run src/db/env.test.ts`
Expected: FAIL (`Cannot find module './env'`).

- [ ] **Step 6: Implementar**

Create `src/db/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

// Os acessos literais a process.env.NEXT_PUBLIC_* são necessários para o Next embuti-los no bundle do cliente.
export function lerEnvSupabase(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): { url: string; chave: string } {
  const r = schema.safeParse(env);
  if (!r.success) {
    const campos = r.error.issues.map((i) => i.path.join("."));
    throw new Error(`Variáveis do Supabase ausentes ou inválidas: ${campos.join(", ")}`);
  }
  return { url: r.data.NEXT_PUBLIC_SUPABASE_URL, chave: r.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
```

- [ ] **Step 7: Rodar tudo**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todos PASS; build concluído.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: dependências do Supabase, env validado e Cache Components desligado"
```

---

### Task 2: Postgres de teste e migrações do schema

**Files:**
- Create: `scripts/db-test.sh`
- Create: `supabase/tests/stubs.sql`
- Create: `vitest.db.config.ts`
- Create: `src/db/testing/banco.ts`
- Create: `supabase/migrations/0001_conteudo.sql`, `0002_uso.sql`, `0003_rls.sql`
- Test: `src/db/migracoes.dbtest.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces:
  - `criarBancoDeTeste(): Promise<{ client: pg.Client; destruir(): Promise<void> }>` — banco novo com stubs e todas as migrações
  - `comoUsuario<T>(client, userId, fn: () => Promise<T>): Promise<T>` — executa como `authenticated` com `auth.uid() = userId`, em transação revertida ao final
  - Comandos: `npm run db:test:start`, `npm run db:test:stop`, `npm run test:db`

- [ ] **Step 1: Script do Postgres de teste**

Create `scripts/db-test.sh`:

```bash
#!/usr/bin/env bash
# Sobe um Postgres descartável para os testes de banco (*.dbtest.ts).
# Requer os binários do Postgres e execução como root (usa o usuário "postgres").
# Fora deste ambiente, aponte TEST_DATABASE_URL para um Postgres seu e pule este script.
set -euo pipefail
DIR=/var/tmp/concursos-pg
PORT=54329
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)

case "${1:-}" in
  start)
    if [ ! -d "$DIR/data" ]; then
      mkdir -p "$DIR"
      chown postgres "$DIR"
      su postgres -c "$BIN/initdb -D $DIR/data -A trust -U postgres" >/dev/null
    fi
    if ! su postgres -c "$BIN/pg_ctl -D $DIR/data status" >/dev/null 2>&1; then
      su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR' -l $DIR/log -w start" >/dev/null
    fi
    echo "Postgres de teste: postgresql://postgres@127.0.0.1:$PORT/postgres"
    ;;
  stop)
    su postgres -c "$BIN/pg_ctl -D $DIR/data -w stop" >/dev/null
    echo "Postgres de teste parado"
    ;;
  *)
    echo "uso: $0 start|stop" >&2
    exit 1
    ;;
esac
```

Run: `chmod +x scripts/db-test.sh`

Em `package.json`, dentro de `"scripts"`, adicione:

```json
"db:test:start": "bash scripts/db-test.sh start",
"db:test:stop": "bash scripts/db-test.sh stop",
"test:db": "vitest run --config vitest.db.config.ts"
```

- [ ] **Step 2: Stubs do Supabase**

Create `supabase/tests/stubs.sql`:

```sql
-- Imitação mínima do ambiente Supabase para testar migrações num Postgres comum.
do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end
$$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);

create or replace function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
```

- [ ] **Step 3: Configuração da suíte de banco e helper**

Create `vitest.db.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.dbtest.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
```

Create `src/db/testing/banco.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";

const URL_ADMIN = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:54329/postgres";

export async function criarBancoDeTeste(): Promise<{ client: Client; destruir(): Promise<void> }> {
  const nome = `teste_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const admin = new Client({ connectionString: URL_ADMIN });
  await admin.connect();
  await admin.query(`create database ${nome}`);

  const url = new URL(URL_ADMIN);
  url.pathname = `/${nome}`;
  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  await client.query(readFileSync("supabase/tests/stubs.sql", "utf8"));
  for (const arquivo of readdirSync("supabase/migrations").sort()) {
    await client.query(readFileSync(`supabase/migrations/${arquivo}`, "utf8"));
  }

  return {
    client,
    async destruir() {
      await client.end();
      await admin.query(`drop database ${nome}`);
      await admin.end();
    },
  };
}

export async function comoUsuario<T>(client: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    return await fn();
  } finally {
    await client.query("rollback");
  }
}
```

- [ ] **Step 4: Escrever os testes de migração**

Create `src/db/migracoes.dbtest.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;

async function umValor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query("insert into auth.users (id, email) values ($1, 'ana@x.com'), ($2, 'bruno@x.com')", [ANA, BRUNO]);
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.concursos (slug, nome, banca_id, data_prova)
      values ('c1', 'Concurso 1', (select id from public.bancas where slug = 'cebraspe'), '2027-01-24');
    insert into public.cargos (concurso_id, slug, nome, duracao_min)
      values ((select id from public.concursos where slug = 'c1'), 'cargo', 'Cargo', 270);
    insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas where slug = 'cebraspe'), 'certo_errado', 'Item 1', 'C', 'ia', 'h1');
  `);
});

afterAll(async () => {
  await destruir();
});

describe("schema", () => {
  it("cria todas as tabelas da spec", async () => {
    const r = await client.query(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );
    expect(r.rows.map((x) => x.table_name)).toEqual([
      "ai_usage", "bancas", "cargo_provas", "cargos", "concursos", "disciplinas", "fonte_dispositivos",
      "fontes", "item_topicos", "itens", "jobs", "prova_disciplinas", "provas", "respostas",
      "revisao_espacada", "simulado_itens", "simulados", "textos_base", "topicos", "topicos_canonicos",
    ]);
  });

  it("habilita RLS em todas as tabelas", async () => {
    expect(await umValor<number>(
      "select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity",
    )).toBe(0);
  });

  it("rejeita gabarito incompatível com o formato", async () => {
    await expect(client.query(`
      insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas limit 1), 'certo_errado', 'x', 'A', 'ia', 'h-x')
    `)).rejects.toThrow(/itens_gabarito_formato/);
  });

  it("rejeita item duplicado pelo hash normalizado", async () => {
    await expect(client.query(`
      insert into public.itens (banca_id, formato, enunciado, gabarito, origem, hash_normalizado)
      values ((select id from public.bancas limit 1), 'certo_errado', 'Item 1 de novo', 'E', 'ia', 'h1')
    `)).rejects.toThrow(/duplicate key/);
  });

  it("rejeita slug canônico mal formatado", async () => {
    await expect(client.query("insert into public.topicos_canonicos (slug, titulo) values ('Sem Barra', 'x')"))
      .rejects.toThrow(/topicos_canonicos_slug_check/);
  });

  it("deriva a área do slug canônico", async () => {
    await client.query("insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase')");
    expect(await umValor<string>("select area from public.topicos_canonicos where slug = 'portugues/crase'")).toBe("portugues");
  });
});

describe("RLS", () => {
  it("usuário autenticado lê conteúdo, mas não escreve", async () => {
    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.itens")).toBe(1);
    });
    await expect(
      comoUsuario(client, ANA, () => client.query("update public.itens set gabarito = 'E'")),
    ).resolves.toMatchObject({ rowCount: 0 });
    await expect(
      comoUsuario(client, ANA, () => client.query("insert into public.bancas (slug, nome) values ('x', 'x')")),
    ).rejects.toThrow(/row-level security/);
  });

  it("anônimo não lê conteúdo", async () => {
    await client.query("begin");
    try {
      await client.query("set local role anon");
      expect(await umValor<number>("select count(*)::int from public.itens")).toBe(0);
    } finally {
      await client.query("rollback");
    }
  });

  it("cada usuário só vê os próprios simulados e respostas", async () => {
    const cargo = await umValor<string>("select id from public.cargos limit 1");
    const item = await umValor<string>("select id from public.itens limit 1");
    await client.query(
      "insert into public.simulados (id, user_id, cargo_id, modo) values ('10000000-0000-0000-0000-000000000001', $1, $2, 'treino')",
      [BRUNO, cargo],
    );
    await client.query(
      "insert into public.respostas (simulado_id, item_id, user_id, resposta) values ('10000000-0000-0000-0000-000000000001', $1, $2, 'C')",
      [item, BRUNO],
    );

    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.simulados")).toBe(0);
      expect(await umValor<number>("select count(*)::int from public.respostas")).toBe(0);
    });
    await comoUsuario(client, BRUNO, async () => {
      expect(await umValor<number>("select count(*)::int from public.simulados")).toBe(1);
      expect(await umValor<number>("select count(*)::int from public.respostas")).toBe(1);
    });
  });

  it("usuário cria simulado próprio com user_id padrão e não consegue criar para outro", async () => {
    const cargo = await umValor<string>("select id from public.cargos limit 1");
    await comoUsuario(client, ANA, async () => {
      const r = await client.query("insert into public.simulados (cargo_id, modo) values ($1, 'treino') returning user_id", [cargo]);
      expect(r.rows[0].user_id).toBe(ANA);
    });
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.simulados (user_id, cargo_id, modo) values ($1, $2, 'treino')", [BRUNO, cargo]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("jobs e ai_usage ficam invisíveis para o usuário", async () => {
    await client.query("insert into public.jobs (tipo, payload) values ('gerar_itens', '{}')");
    await comoUsuario(client, ANA, async () => {
      expect(await umValor<number>("select count(*)::int from public.jobs")).toBe(0);
      expect(await umValor<number>("select count(*)::int from public.ai_usage")).toBe(0);
    });
  });
});
```

- [ ] **Step 5: Subir o Postgres e confirmar a falha**

Run: `npm run db:test:start && npm run test:db`
Expected: FAIL (`ENOENT ... supabase/migrations`).

- [ ] **Step 6: Migração de conteúdo**

Create `supabase/migrations/0001_conteudo.sql`:

```sql
create table public.bancas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  formatos text[] not null default '{}',
  guia_estilo text not null default '',
  criado_em timestamptz not null default now()
);

create table public.concursos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  banca_id uuid not null references public.bancas (id),
  data_prova date not null,
  ressalvas text[] not null default '{}',
  editais_fonte text[] not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.cargos (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  qualificacoes text[] not null default '{}',
  duracao_min integer not null check (duracao_min > 0),
  corte_conjunto jsonb,
  unique (concurso_id, slug)
);

create table public.provas (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  tipo text not null check (tipo in ('objetiva', 'discursiva')),
  formato text check (formato in ('certo_errado', 'multipla_escolha')),
  n_itens integer check (n_itens > 0),
  alternativas integer check (alternativas between 2 and 5),
  regra_pontuacao jsonb,
  regra_corte jsonb,
  distribuicao jsonb,
  config_discursiva jsonb,
  unique (concurso_id, slug),
  constraint provas_campos_por_tipo check (
    (tipo = 'objetiva' and formato is not null and n_itens is not null and regra_pontuacao is not null and distribuicao is not null)
    or (tipo = 'discursiva' and config_discursiva is not null)
  )
);

create table public.cargo_provas (
  cargo_id uuid not null references public.cargos (id) on delete cascade,
  prova_id uuid not null references public.provas (id) on delete cascade,
  ordem integer not null,
  primary key (cargo_id, prova_id)
);

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  slug text not null,
  nome text not null,
  unique (concurso_id, slug)
);

create table public.prova_disciplinas (
  prova_id uuid not null references public.provas (id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas (id) on delete cascade,
  ordem integer not null,
  primary key (prova_id, disciplina_id)
);

create table public.topicos_canonicos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)+$'),
  titulo text not null,
  area text generated always as (split_part(slug, '/', 1)) stored
);

create table public.topicos (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  parent_id uuid references public.topicos (id) on delete cascade,
  canonico_id uuid references public.topicos_canonicos (id),
  ordem integer not null,
  unique (disciplina_id, codigo)
);
create index topicos_canonico_idx on public.topicos (canonico_id);

create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  tipo text not null check (tipo in ('lei', 'decreto', 'constituicao', 'conceito')),
  titulo text not null,
  url_oficial text,
  criado_em timestamptz not null default now()
);

create table public.fonte_dispositivos (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references public.fontes (id) on delete cascade,
  referencia text not null,
  texto text not null,
  ordem integer not null,
  unique (fonte_id, referencia)
);

create table public.textos_base (
  id uuid primary key default gen_random_uuid(),
  conteudo text not null,
  origem text not null check (origem in ('real', 'ia')),
  criado_em timestamptz not null default now()
);

create table public.itens (
  id uuid primary key default gen_random_uuid(),
  banca_id uuid not null references public.bancas (id),
  formato text not null check (formato in ('certo_errado', 'multipla_escolha')),
  texto_base_id uuid references public.textos_base (id) on delete set null,
  enunciado text not null,
  alternativas jsonb,
  gabarito text not null,
  justificativa text not null default '',
  citacao text,
  fonte_id uuid references public.fontes (id),
  origem text not null check (origem in ('real', 'ia')),
  prova_origem text,
  status text not null default 'pendente'
    check (status in ('pendente', 'revisao', 'aprovado', 'suspeito', 'descartado')),
  dificuldade smallint check (dificuldade between 1 and 3),
  hash_normalizado text not null unique,
  validacao jsonb not null default '{}',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint itens_gabarito_formato check (
    (formato = 'certo_errado' and gabarito in ('C', 'E') and alternativas is null)
    or (formato = 'multipla_escolha' and gabarito in ('A', 'B', 'C', 'D', 'E') and alternativas is not null)
  )
);
create index itens_status_idx on public.itens (status);

create table public.item_topicos (
  item_id uuid not null references public.itens (id) on delete cascade,
  topico_canonico_id uuid not null references public.topicos_canonicos (id),
  primary key (item_id, topico_canonico_id)
);
create index item_topicos_canonico_idx on public.item_topicos (topico_canonico_id);
```

- [ ] **Step 7: Migração de uso**

Create `supabase/migrations/0002_uso.sql`:

```sql
create table public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cargo_id uuid not null references public.cargos (id),
  modo text not null check (modo in ('completo', 'treino', 'revisao')),
  config jsonb not null default '{}',
  iniciado_em timestamptz not null default now(),
  finalizado_em timestamptz,
  resultado jsonb
);
create index simulados_user_idx on public.simulados (user_id, iniciado_em desc);

create table public.simulado_itens (
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  item_id uuid not null references public.itens (id),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ordem integer not null,
  primary key (simulado_id, item_id)
);

create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  simulado_id uuid not null references public.simulados (id) on delete cascade,
  item_id uuid not null references public.itens (id),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  resposta text not null check (resposta in ('A', 'B', 'C', 'D', 'E', 'branco')),
  duvida boolean not null default false,
  tempo_ms integer check (tempo_ms >= 0),
  respondida_em timestamptz not null default now(),
  unique (simulado_id, item_id)
);
create index respostas_user_idx on public.respostas (user_id, respondida_em desc);

create table public.revisao_espacada (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.itens (id) on delete cascade,
  etapa smallint not null check (etapa between 1 and 4),
  proxima_em timestamptz not null,
  primary key (user_id, item_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  payload jsonb not null default '{}',
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'concluido', 'falhou')),
  tentativas integer not null default 0,
  erro text,
  executar_apos timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index jobs_fila_idx on public.jobs (status, executar_apos);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  provedor text not null check (provedor in ('anthropic', 'openai')),
  modelo text not null,
  finalidade text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(10, 6) not null default 0,
  job_id uuid references public.jobs (id) on delete set null,
  criado_em timestamptz not null default now()
);
```

- [ ] **Step 8: Migração de RLS**

Create `supabase/migrations/0003_rls.sql`:

```sql
do $$
declare
  t text;
begin
  foreach t in array array[
    'bancas', 'concursos', 'cargos', 'provas', 'cargo_provas', 'disciplinas', 'prova_disciplinas',
    'topicos_canonicos', 'topicos', 'fontes', 'fonte_dispositivos', 'textos_base', 'itens', 'item_topicos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "leitura para autenticados" on public.%I for select to authenticated using (true)', t);
  end loop;

  foreach t in array array['simulados', 'simulado_itens', 'respostas', 'revisao_espacada'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono le e escreve" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;

  -- Apenas o servidor (service role, que ignora RLS) acessa estas tabelas.
  alter table public.jobs enable row level security;
  alter table public.ai_usage enable row level security;
end
$$;
```

- [ ] **Step 9: Rodar os testes de banco**

Run: `npm run test:db`
Expected: 11 testes PASS.

- [ ] **Step 10: Rodar a suíte unitária e commit**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS (os `.dbtest.ts` não entram na suíte padrão).

```bash
git add -A
git commit -m "feat(db): migrações do schema com RLS e Postgres de teste"
```

---

### Task 3: Seed do edital gerado a partir do YAML

> **Revisão durante a execução:** o SQL gerado linha a linha tinha 417 KB, grande demais para ser enviado ao projeto pelo MCP ou colado no SQL Editor. O seed passou a ser `select public.carregar_edital('<edital em JSON>'::jsonb);` (cerca de 55 KB), e os upserts foram para a função `public.carregar_edital(jsonb)` na migração `supabase/migrations/0004_carregar_edital.sql`. A função não pode ser executada pelos papéis `anon` e `authenticated`. Os arquivos no repositório (`0004_carregar_edital.sql`, `src/db/seed/edital-sql.ts`, `edital-sql.test.ts` e `edital-sql.dbtest.ts`) são a referência; o código abaixo é a versão original.

**Files:**
- Create: `src/db/seed/edital-sql.ts`
- Create: `scripts/gerar-seed.ts`
- Create (gerado): `supabase/seed/cbmal-2026.sql`
- Test: `src/db/seed/edital-sql.test.ts`
- Test: `src/db/seed/edital-sql.dbtest.ts`
- Modify: `package.json` (script `seed:gerar`)

**Interfaces:**
- Consumes: `Edital`, `Topico` (Plano 1); `parseEdital`; `editalMini()`; `criarBancoDeTeste` (Task 2)
- Produces: `sqlDoEdital(e: Edital): string` — SQL idempotente em uma transação; comando `npm run seed:gerar -- <slug>`

- [ ] **Step 1: Testes unitários do gerador**

Create `src/db/seed/edital-sql.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { editalMini } from "../../core/edital/__fixtures__/mini";
import { sqlDoEdital } from "./edital-sql";

describe("sqlDoEdital", () => {
  const sql = sqlDoEdital(editalMini());

  it("roda tudo numa transação", () => {
    expect(sql.startsWith("begin;\n")).toBe(true);
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("faz upsert por chaves naturais", () => {
    expect(sql).toContain("on conflict (slug) do update set");
    expect(sql).toContain("on conflict (concurso_id, slug) do update set");
    expect(sql).toContain("on conflict (disciplina_id, codigo) do update set");
  });

  it("escapa aspas simples", () => {
    const e = editalMini();
    e.disciplinas[0].topicos[0].titulo = "Interpretação d'água";
    expect(sqlDoEdital(e)).toContain("'Interpretação d''água'");
  });

  it("grava subtópicos depois do pai, com parent_id pelo código", () => {
    const pai = sql.indexOf("'2', 'Sintaxe'");
    const filho = sql.indexOf("'2.1', 'Crase'");
    expect(pai).toBeGreaterThan(-1);
    expect(filho).toBeGreaterThan(pai);
    expect(sql).toContain("and t.codigo = '2')");
  });

  it("remove tópicos que saíram do edital", () => {
    expect(sql).toContain("delete from public.topicos");
    expect(sql).toContain("codigo <> all (array['1', '2', '2.1', '2.2']::text[])");
  });

  it("registra a configuração da discursiva", () => {
    expect(sql).toContain('\'{"pontuacao_maxima":30,"linhas_max":30,"nota_minima":15}\'::jsonb');
  });
});
```

- [ ] **Step 2: Teste do seed aplicado no banco**

Create `src/db/seed/edital-sql.dbtest.ts`:

```ts
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { parseEdital } from "../../core/edital/parse";
import type { Topico } from "../../core/edital/schema";
import { editalMini } from "../../core/edital/__fixtures__/mini";
import { criarBancoDeTeste } from "../testing/banco";
import { sqlDoEdital } from "./edital-sql";

const cbmal = parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"));

function contarNos(topicos: Topico[]): number {
  return topicos.reduce((n, t) => n + 1 + (t.subtopicos ? contarNos(t.subtopicos) : 0), 0);
}

let client: Client;
let destruir: () => Promise<void>;

async function contar(tabela: string): Promise<number> {
  const r = await client.query(`select count(*)::int as n from public.${tabela}`);
  return r.rows[0].n;
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
});

afterAll(async () => {
  await destruir();
});

describe("seed do CBM-AL", () => {
  it("carrega o edital completo", async () => {
    await client.query(sqlDoEdital(cbmal));
    expect(await contar("concursos")).toBe(1);
    expect(await contar("cargos")).toBe(2);
    expect(await contar("provas")).toBe(4);
    expect(await contar("disciplinas")).toBe(17);
    expect(await contar("topicos")).toBe(cbmal.disciplinas.reduce((n, d) => n + contarNos(d.topicos), 0));
    expect(await contar("cargo_provas")).toBe(6);
  });

  it("é idempotente", async () => {
    const antes = await contar("topicos");
    await client.query(sqlDoEdital(cbmal));
    expect(await contar("topicos")).toBe(antes);
    expect(await contar("cargo_provas")).toBe(6);
  });

  it("liga a P1 aos dois cargos e as folhas aos canônicos", async () => {
    const r = await client.query(`
      select count(*)::int as n from public.cargo_provas cp
      join public.provas p on p.id = cp.prova_id where p.slug = 'p1-gerais'`);
    expect(r.rows[0].n).toBe(2);
    const semCanonico = await client.query(`
      select count(*)::int as n from public.topicos t
      where t.canonico_id is null and not exists (select 1 from public.topicos f where f.parent_id = t.id)`);
    expect(semCanonico.rows[0].n).toBe(0);
  });
});

describe("retificação", () => {
  it("remove tópicos que saíram do YAML e atualiza títulos", async () => {
    await client.query(sqlDoEdital(editalMini()));
    const e = editalMini();
    e.disciplinas[1].topicos = [{ codigo: "1", titulo: "Porcentagem e razão", canonico: "matematica/porcentagem" }];
    e.provas[0] = { ...e.provas[0] };
    await client.query(sqlDoEdital(e));
    const r = await client.query(`
      select t.codigo, t.titulo from public.topicos t
      join public.disciplinas d on d.id = t.disciplina_id
      join public.concursos c on c.id = d.concurso_id
      where c.slug = 'mini-2026' and d.slug = 'mat' order by t.ordem`);
    expect(r.rows).toEqual([{ codigo: "1", titulo: "Porcentagem e razão" }]);
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/db/seed/edital-sql.test.ts`
Expected: FAIL (`Cannot find module './edital-sql'`).

- [ ] **Step 4: Implementar o gerador**

Create `src/db/seed/edital-sql.ts`:

```ts
import type { Edital, Topico } from "../../core/edital/schema";

function lit(valor: string): string {
  return `'${valor.replaceAll("'", "''")}'`;
}

function litOuNull(valor: string | number | undefined | null): string {
  if (valor === undefined || valor === null) return "null";
  return typeof valor === "number" ? String(valor) : lit(valor);
}

function arr(valores: string[]): string {
  return valores.length === 0 ? "'{}'::text[]" : `array[${valores.map(lit).join(", ")}]::text[]`;
}

function json(valor: unknown): string {
  return valor === undefined || valor === null ? "null" : `${lit(JSON.stringify(valor))}::jsonb`;
}

interface NoPlano {
  codigo: string;
  titulo: string;
  canonico?: string;
  pai: string | null;
}

function achatar(topicos: Topico[], pai: string | null = null): NoPlano[] {
  return topicos.flatMap((t) => [
    { codigo: t.codigo, titulo: t.titulo, canonico: t.canonico, pai },
    ...(t.subtopicos ? achatar(t.subtopicos, t.codigo) : []),
  ]);
}

export function sqlDoEdital(e: Edital): string {
  const linhas: string[] = ["begin;"];
  const concurso = `(select id from public.concursos where slug = ${lit(e.slug)})`;
  const cargo = (slug: string) => `(select id from public.cargos where concurso_id = ${concurso} and slug = ${lit(slug)})`;
  const prova = (slug: string) => `(select id from public.provas where concurso_id = ${concurso} and slug = ${lit(slug)})`;
  const disciplina = (slug: string) =>
    `(select id from public.disciplinas where concurso_id = ${concurso} and slug = ${lit(slug)})`;

  linhas.push(
    `insert into public.bancas (slug, nome) values (${lit(e.banca)}, ${lit(e.banca)}) on conflict (slug) do nothing;`,
    `insert into public.concursos (slug, nome, banca_id, data_prova, ressalvas, editais_fonte)
values (${lit(e.slug)}, ${lit(e.nome)}, (select id from public.bancas where slug = ${lit(e.banca)}), ${lit(e.data_prova)}, ${arr(e.ressalvas)}, ${arr(e.editais_fonte)})
on conflict (slug) do update set nome = excluded.nome, banca_id = excluded.banca_id, data_prova = excluded.data_prova,
  ressalvas = excluded.ressalvas, editais_fonte = excluded.editais_fonte, atualizado_em = now();`,
  );

  for (const c of e.cargos) {
    linhas.push(`insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
values (${concurso}, ${lit(c.slug)}, ${lit(c.nome)}, ${arr(c.qualificacoes ?? [])}, ${c.duracao_min}, ${json(c.corte_conjunto)})
on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
  duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;`);
  }

  for (const p of e.provas) {
    const objetiva = p.tipo === "objetiva";
    const discursiva =
      p.tipo === "discursiva"
        ? { pontuacao_maxima: p.pontuacao_maxima, linhas_max: p.linhas_max, nota_minima: p.nota_minima }
        : null;
    linhas.push(`insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas, regra_pontuacao, regra_corte, distribuicao, config_discursiva)
values (${concurso}, ${lit(p.slug)}, ${lit(p.nome)}, ${lit(p.tipo)}, ${litOuNull(objetiva ? p.formato : null)}, ${litOuNull(objetiva ? p.itens : null)}, ${litOuNull(objetiva ? p.alternativas : null)}, ${json(objetiva ? p.pontuacao : null)}, ${json(objetiva ? p.corte : null)}, ${json(objetiva ? p.distribuicao_estimada : null)}, ${json(discursiva)})
on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
  n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
  regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;`);
  }

  linhas.push(`delete from public.cargo_provas where cargo_id in (select id from public.cargos where concurso_id = ${concurso});`);
  for (const c of e.cargos) {
    c.provas.forEach((p, i) => {
      linhas.push(`insert into public.cargo_provas (cargo_id, prova_id, ordem) values (${cargo(c.slug)}, ${prova(p)}, ${i});`);
    });
  }

  for (const d of e.disciplinas) {
    linhas.push(`insert into public.disciplinas (concurso_id, slug, nome) values (${concurso}, ${lit(d.slug)}, ${lit(d.nome)})
on conflict (concurso_id, slug) do update set nome = excluded.nome;`);
  }

  linhas.push(`delete from public.prova_disciplinas where prova_id in (select id from public.provas where concurso_id = ${concurso});`);
  for (const p of e.provas) {
    p.disciplinas.forEach((d, i) => {
      linhas.push(`insert into public.prova_disciplinas (prova_id, disciplina_id, ordem) values (${prova(p.slug)}, ${disciplina(d)}, ${i});`);
    });
  }

  for (const d of e.disciplinas) {
    const nos = achatar(d.topicos);
    for (const n of nos) {
      if (n.canonico) {
        linhas.push(`insert into public.topicos_canonicos (slug, titulo) values (${lit(n.canonico)}, ${lit(n.titulo)}) on conflict (slug) do nothing;`);
      }
    }
    linhas.push(`delete from public.topicos where disciplina_id = ${disciplina(d.slug)} and codigo <> all (${arr(nos.map((n) => n.codigo))});`);
    nos.forEach((n, ordem) => {
      const pai = n.pai === null
        ? "null"
        : `(select t.id from public.topicos t where t.disciplina_id = ${disciplina(d.slug)} and t.codigo = ${lit(n.pai)})`;
      const canonico = n.canonico ? `(select id from public.topicos_canonicos where slug = ${lit(n.canonico)})` : "null";
      linhas.push(`insert into public.topicos (disciplina_id, codigo, titulo, parent_id, canonico_id, ordem)
values (${disciplina(d.slug)}, ${lit(n.codigo)}, ${lit(n.titulo)}, ${pai}, ${canonico}, ${ordem})
on conflict (disciplina_id, codigo) do update set titulo = excluded.titulo, parent_id = excluded.parent_id,
  canonico_id = excluded.canonico_id, ordem = excluded.ordem;`);
    });
  }

  linhas.push("commit;");
  return `${linhas.join("\n")}\n`;
}
```

- [ ] **Step 5: Script de geração**

Create `scripts/gerar-seed.ts`:

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEdital } from "../src/core/edital/parse";
import { sqlDoEdital } from "../src/db/seed/edital-sql";

const slug = process.argv[2];
if (!slug) {
  console.error("uso: npm run seed:gerar -- <slug-do-concurso>");
  process.exit(1);
}

const edital = parseEdital(readFileSync(`editais/${slug}/edital.yaml`, "utf8"));
mkdirSync("supabase/seed", { recursive: true });
writeFileSync(`supabase/seed/${slug}.sql`, sqlDoEdital(edital));
console.log(`supabase/seed/${slug}.sql gerado`);
```

Em `package.json`, dentro de `"scripts"`, adicione:

```json
"seed:gerar": "tsx scripts/gerar-seed.ts"
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test && npm run test:db`
Expected: PASS em ambas as suítes.

- [ ] **Step 7: Gerar o seed do CBM-AL**

Run: `npm run seed:gerar -- cbmal-2026 && head -3 supabase/seed/cbmal-2026.sql`
Expected: `supabase/seed/cbmal-2026.sql gerado`; o arquivo começa com `begin;`.

- [ ] **Step 8: Typecheck, lint e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add -A
git commit -m "feat(db): seed idempotente do edital gerado a partir do YAML"
```

---

### Task 4: Aplicar no projeto Supabase e gerar os tipos

Esta tarefa usa as ferramentas MCP do Supabase (`apply_migration`, `execute_sql`, `get_advisors`, `generate_typescript_types`, `get_project_url`, `get_publishable_keys`) no projeto `gmcjgtpamdhqpclqxtvg`. Quem executa precisa ter essas ferramentas. Ela é feita pelo controlador da execução, não por um subagente sem acesso.

**Files:**
- Create: `src/db/types.ts` (gerado)
- Create: `.env.local` (não versionado)

- [ ] **Step 1: Aplicar as migrações**

Para cada arquivo em `supabase/migrations/` em ordem, chame `apply_migration` com `name` igual ao nome do arquivo sem extensão (`0001_conteudo`, `0002_uso`, `0003_rls`, `0004_carregar_edital`) e `query` igual ao conteúdo do arquivo.

- [ ] **Step 2: Aplicar o seed**

Chame `execute_sql` com o conteúdo de `supabase/seed/cbmal-2026.sql`. Depois confira:

```sql
select (select count(*) from public.disciplinas) as disciplinas,
       (select count(*) from public.topicos) as topicos,
       (select count(*) from public.cargo_provas) as cargo_provas;
```

Expected: 17 disciplinas, o mesmo nº de tópicos do teste de seed, 6 ligações cargo–prova.

- [ ] **Step 3: Verificar os avisos de segurança**

Chame `get_advisors` com `type: "security"`. Expected: nenhum aviso de tabela sem RLS. Avisos de "RLS habilitado sem política" em `jobs` e `ai_usage` são intencionais (só o servidor acessa) e ficam registrados em `docs/deploy.md`.

- [ ] **Step 4: Gerar os tipos**

Chame `generate_typescript_types` e grave o resultado em `src/db/types.ts`.

- [ ] **Step 5: Criar `.env.local`**

Com `get_project_url` e `get_publishable_keys` (use a chave publicável `sb_publishable_…`, ou a `anon` se não houver publicável), crie `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<chave publicável>
AUTH_EMAILS_PERMITIDOS=<e-mail do usuário>
```

- [ ] **Step 6: Typecheck e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/db/types.ts
git commit -m "feat(db): tipos gerados do projeto Supabase"
```

---

### Task 5: Clientes do Supabase, proxy e login por link mágico

**Files:**
- Create: `src/lib/auth/rotas.ts`
- Test: `src/lib/auth/rotas.test.ts`
- Create: `src/db/supabase/server.ts`
- Create: `src/db/supabase/proxy.ts`
- Create: `src/proxy.ts`
- Create: `src/app/entrar/page.tsx`, `src/app/entrar/actions.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/actions.ts`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `lerEnvSupabase` (Task 1); `Database` de `src/db/types.ts` (Task 4)
- Produces:
  - `rotaPublica(caminho: string): boolean`
  - `destinoSeguro(proximo: string | null | undefined): string`
  - `emailPermitido(email: string, lista: string | undefined): boolean`
  - `criarClienteServidor(): Promise<SupabaseClient<Database>>`
  - `atualizarSessao(request: NextRequest): Promise<{ resposta: NextResponse; autenticado: boolean }>`

- [ ] **Step 1: Testes das regras de rota**

Create `src/lib/auth/rotas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { destinoSeguro, emailPermitido, rotaPublica } from "./rotas";

describe("rotaPublica", () => {
  it("libera login e callback", () => {
    expect(rotaPublica("/entrar")).toBe(true);
    expect(rotaPublica("/auth/callback")).toBe(true);
  });

  it("protege o resto", () => {
    expect(rotaPublica("/")).toBe(false);
    expect(rotaPublica("/entrarx")).toBe(false);
    expect(rotaPublica("/simulado")).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(destinoSeguro("/simulado?x=1")).toBe("/simulado?x=1");
  });

  it("recusa destinos externos ou vazios", () => {
    for (const d of [null, undefined, "", "https://mal.com", "//mal.com", "/\\mal.com", "simulado"]) {
      expect(destinoSeguro(d)).toBe("/");
    }
  });
});

describe("emailPermitido", () => {
  it("compara sem diferenciar maiúsculas e ignora espaços", () => {
    expect(emailPermitido("Ana@X.com", " ana@x.com , bia@y.com")).toBe(true);
    expect(emailPermitido("bia@y.com", "ana@x.com,bia@y.com")).toBe(true);
  });

  it("nega quando a lista não existe ou não contém o e-mail", () => {
    expect(emailPermitido("ana@x.com", undefined)).toBe(false);
    expect(emailPermitido("ana@x.com", "")).toBe(false);
    expect(emailPermitido("ana@x.com", "bia@y.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/lib/auth/`
Expected: FAIL (`Cannot find module './rotas'`).

- [ ] **Step 3: Implementar as regras**

Create `src/lib/auth/rotas.ts`:

```ts
const ROTAS_PUBLICAS = ["/entrar", "/auth/callback"];

export function rotaPublica(caminho: string): boolean {
  return ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(`${r}/`));
}

export function destinoSeguro(proximo: string | null | undefined): string {
  if (!proximo || !proximo.startsWith("/") || proximo.startsWith("//") || proximo.startsWith("/\\")) return "/";
  return proximo;
}

export function emailPermitido(email: string, lista: string | undefined): boolean {
  const permitidos = (lista ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return permitidos.includes(email.trim().toLowerCase());
}
```

Run: `npx vitest run src/lib/auth/`
Expected: PASS.

- [ ] **Step 4: Clientes do Supabase**

Create `src/db/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

export async function criarClienteServidor() {
  const { url, chave } = lerEnvSupabase();
  const store = await cookies();
  return createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) store.set(name, value, options);
        } catch {
          // Server Components não podem gravar cookies; o proxy já renova a sessão.
        }
      },
    },
  });
}
```

Create `src/db/supabase/proxy.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

export async function atualizarSessao(request: NextRequest): Promise<{ resposta: NextResponse; autenticado: boolean }> {
  const { url, chave } = lerEnvSupabase();
  let resposta = NextResponse.next({ request });
  const supabase = createServerClient<Database>(url, chave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) request.cookies.set(name, value);
        resposta = NextResponse.next({ request });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { resposta, autenticado: user !== null };
}
```

- [ ] **Step 5: Proxy**

Antes, leia `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

Create `src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { atualizarSessao } from "@/db/supabase/proxy";
import { rotaPublica } from "@/lib/auth/rotas";

export async function proxy(request: NextRequest) {
  const { resposta, autenticado } = await atualizarSessao(request);
  const { pathname, search } = request.nextUrl;
  if (!autenticado && !rotaPublica(pathname)) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    destino.searchParams.set("proximo", `${pathname}${search}`);
    return NextResponse.redirect(destino);
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

- [ ] **Step 6: Login, callback e sair**

Create `src/app/entrar/actions.ts`:

```ts
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/db/supabase/server";
import { destinoSeguro, emailPermitido } from "@/lib/auth/rotas";

export async function enviarLinkMagico(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const proximo = destinoSeguro(String(formData.get("proximo") ?? ""));
  const voltar = (params: string) => redirect(`/entrar?${params}&proximo=${encodeURIComponent(proximo)}`);

  if (!/^\S+@\S+\.\S+$/.test(email)) voltar("erro=email");
  if (!emailPermitido(email, process.env.AUTH_EMAILS_PERMITIDOS)) voltar("erro=nao-autorizado");

  const origem = (await headers()).get("origin") ?? "http://localhost:3000";
  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origem}/auth/callback?proximo=${encodeURIComponent(proximo)}` },
  });
  voltar(error ? "erro=envio" : "enviado=1");
}
```

Create `src/app/entrar/page.tsx`:

```tsx
import { enviarLinkMagico } from "./actions";

const MENSAGENS: Record<string, string> = {
  email: "Informe um e-mail válido.",
  "nao-autorizado": "Este e-mail não tem acesso à plataforma.",
  envio: "Não foi possível enviar o link. Tente de novo em alguns minutos.",
  link: "O link expirou ou já foi usado. Peça um novo.",
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string; proximo?: string }>;
}) {
  const { erro, enviado, proximo } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-[40px] font-semibold leading-tight tracking-tight">Entrar</h1>
      {enviado ? (
        <p className="rounded-xl border border-black/10 bg-white p-6 text-[#615d59]">
          Enviamos um link de acesso para o seu e-mail. Abra-o neste navegador.
        </p>
      ) : (
        <form action={enviarLinkMagico} className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-6">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-black/15 px-3 py-2"
          />
          <input type="hidden" name="proximo" value={proximo ?? "/"} />
          {erro && <p className="text-sm text-[#e32d14]">{MENSAGENS[erro] ?? "Algo deu errado."}</p>}
          <button type="submit" className="rounded-lg bg-[#0075de] px-4 py-2 text-sm font-medium text-white">
            Receber link de acesso
          </button>
        </form>
      )}
    </main>
  );
}
```

Create `src/app/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/db/supabase/server";
import { destinoSeguro } from "@/lib/auth/rotas";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const proximo = destinoSeguro(request.nextUrl.searchParams.get("proximo"));
  if (code) {
    const supabase = await criarClienteServidor();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(proximo, request.url));
  }
  return NextResponse.redirect(new URL("/entrar?erro=link", request.url));
}
```

Create `src/app/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/db/supabase/server";

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}
```

- [ ] **Step 7: Página inicial, layout e estilos base**

Substitua `src/app/page.tsx` por:

```tsx
import { criarClienteServidor } from "@/db/supabase/server";
import { sair } from "./actions";

export default async function Inicio() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: concursos } = await supabase
    .from("concursos")
    .select("slug, nome, data_prova, cargos(slug, nome)")
    .order("nome");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <header className="flex items-center justify-between">
        <p className="text-sm text-black/60">{user?.email}</p>
        <form action={sair}>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-black/90 hover:bg-black/5">
            Sair
          </button>
        </form>
      </header>
      <h1 className="text-[40px] font-semibold leading-tight tracking-tight">Seus concursos</h1>
      {(concursos ?? []).map((c) => (
        <section key={c.slug} className="rounded-xl border border-black/10 bg-white p-6">
          <h2 className="text-[22px] font-bold tracking-tight">{c.nome}</h2>
          <p className="text-[#615d59]">Prova em {new Date(`${c.data_prova}T12:00:00`).toLocaleDateString("pt-BR")}</p>
          <ul className="mt-3 flex gap-2">
            {c.cargos.map((cargo) => (
              <li key={cargo.slug} className="rounded-full bg-[#e6f3fe] px-3 py-1 text-sm text-[#0075de]">
                {cargo.nome}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
```

Em `src/app/layout.tsx`, troque a fonte do template por Inter e o idioma por `pt-BR`. O arquivo final:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Concursos",
  description: "Estudo para concursos guiado pelo edital e pela banca",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
```

Substitua `src/app/globals.css` por:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
}

body {
  background: #f6f5f4;
  color: #000;
  font-family: var(--font-sans);
}
```

- [ ] **Step 8: Verificar build e comportamento**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todos PASS; build concluído com `/`, `/entrar` e `/auth/callback` dinâmicos e o proxy registrado.

Com `.env.local` presente (Task 4), suba o servidor e confira os redirecionamentos:

```bash
npm run start -- -p 3100 &
sleep 4
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3100/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/entrar
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3100/auth/callback?proximo=//mal.com"
kill %1
```

Expected:
- `/` responde `307` para `http://localhost:3100/entrar?proximo=%2F`
- `/entrar` responde `200`
- `/auth/callback` sem código responde `307` para `/entrar?erro=link`

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(auth): login por link mágico com Supabase e proxy de rotas"
```

---

### Task 6: Documentação de deploy

**Files:**
- Create: `docs/deploy.md`

- [ ] **Step 1: Escrever o guia**

Create `docs/deploy.md`:

```markdown
# Deploy e configuração

## Supabase (projeto `concursos`, ref `gmcjgtpamdhqpclqxtvg`)

- Migrações: `supabase/migrations/`, aplicadas em ordem.
- Seed de um concurso: `npm run seed:gerar -- <slug>` gera `supabase/seed/<slug>.sql`, que é executado no SQL Editor ou via MCP. O SQL é idempotente; rode de novo após editar o `edital.yaml`.
- `jobs` e `ai_usage` têm RLS sem políticas de propósito: só o servidor, com a chave secreta, acessa. O aviso "RLS enabled, no policy" do Security Advisor para essas tabelas é esperado.

### Autenticação (painel do Supabase → Authentication → URL Configuration)

- **Site URL:** a URL de produção da Vercel (ex.: `https://concursos.vercel.app`).
- **Redirect URLs:** adicione `http://localhost:3000/auth/callback` e `https://<url-de-produção>/auth/callback`.
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy.md
git commit -m "docs: guia de deploy na Vercel e configuração do Supabase"
```

# Plano 4 — Telas de estudo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar as telas de estudo das entregas 5, 6 e 7 da spec: "Estudar agora" (motor de foco), treino por tópico, revisão de erros, simulado completo cronometrado com resultado pelas regras da banca e análise de dúvida, painel de desempenho e fila de revisão de itens (discordâncias das IAs e itens marcados como suspeitos).

**Architecture:** Mesmo padrão do pipeline do Plano 3. `src/estudo/` tem a lógica de aplicação, sem I/O: monta a estrutura do cargo a partir das tabelas, cria sessões com as funções de `core/`, corrige respostas, atualiza a repetição espaçada e entrega o simulado. Tudo depende da interface `RepositorioEstudo` e é testado com um repositório em memória. `src/db/repositorios/estudo.ts` implementa a interface com o cliente Supabase **do usuário** (RLS vale). A migração `0007_estudo.sql` cria as funções que a API não faz bem: candidatos e histórico em `jsonb` (escapam do limite de 1000 linhas), criação atômica da sessão, marcar suspeito e pedir geração com limite. Moderação e custos usam a chave secreta e só aparecem para moderadores. As telas são Server Components; só o player de treino, o player do simulado, o cronômetro, a denúncia de item e o link ativo do menu são Client Components, e falam com o servidor por Server Actions.

**Tech Stack:** Next.js 16.4 (App Router, Server Actions, `refresh`/`revalidatePath`), React 19.3, Tailwind v4 (tokens em `@theme`), `@phosphor-icons/react` 2.1.10 (ícones; `/ssr` em Server Components), Supabase (`@supabase/ssr`), Zod 3, Vitest, Postgres local para testes de banco.

**Especificação:** `docs/superpowers/specs/2026-10-14-nucleo-simulador-design.md` (§6, §7, §9 itens 5 a 7). **UI:** `docs/design/DESIGN.md`.

## Global Constraints

- Leia `AGENTS.md`: o Next.js 16 tem APIs novas; consulte `node_modules/next/dist/docs/01-app/` (em especial `01-getting-started/07-mutating-data.md`) antes de escrever código Next. `params` e `searchParams` são `Promise`.
- O gabarito, a justificativa e a citação de um item **nunca** vão ao navegador antes da hora: no treino, só depois de a resposta ser gravada; no simulado completo, só depois da entrega. `itensDaSessao` recebe o critério e as páginas passam o certo.
- Resposta de treino gravada não muda (o gabarito já foi mostrado). No simulado completo a marcação muda livremente até o prazo (`iniciado_em` + duração, com 60 s de tolerância).
- O estudo nunca depende da geração: pedir geração é melhor-esforço (`pedirSemFalhar`), e o limite é de 3 pedidos em aberto por pessoa, 5 itens cada.
- Itens `suspeito` e `descartado` não entram em sessões nem no histórico do motor de foco.
- Simulado completo usa só as provas objetivas e dura a duração do cargo menos 60 min quando o cargo tem discursiva (3h30 no CBM-AL), conforme a opção "só objetivas" da spec. A discursiva entra com o corretor de redação.
- Funções SQL: sem `DROP`, sem `DELETE ... USING`, pequenas; `EXECUTE` revogado de `public` e `anon`. As de leitura e `simulado_criar` são `security invoker`; `itens_marcar_suspeito` e `estudo_pedir_geracao` são `security definer` com `search_path = ''` e checam `auth.uid()`.
- Nada de segredo no repositório. `SUPABASE_SECRET_KEY` só é usada em Server Components e Server Actions de moderador.
- Agentes não fazem push, não mexem em `.env.local`, não aplicam migrações no Supabase remoto e não editam `src/db/types.ts` à mão (a Task 2 é do controlador).
- Mensagens de commit terminam com as linhas de atribuição da sessão.

## Interface (DESIGN.md + design-taste-frontend)

Leitura do design: aplicativo de estudo pessoal, para uma pessoa estudando todo dia, na linguagem calma do Notion descrita em `docs/design/DESIGN.md`. Dials: `DESIGN_VARIANCE 4`, `MOTION_INTENSITY 3`, `VISUAL_DENSITY 5`. Só transições CSS de 200 ms; sem biblioteca de animação.

- **Cores:** canvas `#f6f5f4` (`bg-papel`), cartões brancos com borda `rgba(0,0,0,0.08)` (`border-borda`) e **sem sombra**. Um só botão azul cheio (`#0075de`) por tela: a ação principal. Secundário em azul-claro (`#e6f3fe`), terciário só texto. Acentos com moderação: meia-noite `#02093a` no cartão da contagem regressiva, coral `#f64932` para o que ficou abaixo do corte, marigold para "dúvida".
- **Formas:** cartões 12px (`rounded-xl`), botões e campos 8px (`rounded-lg`), etiquetas em pílula. Sem mistura.
- **Tipografia:** Inter (o DESIGN.md indica Inter como substituta da NotionInter). Títulos com `tracking` negativo; texto de apoio em grafite `#615d59`; números com `tabular-nums`.
- **Acessibilidade:** foco visível azul, `aria-pressed` nos botões de alternância, `aria-current` no mapa de itens, cor nunca é o único sinal (ícone e texto em "Você acertou/errou"), contraste AA (vermelho `#e32d14` só em texto ≥ 14px ou sobre o fundo claro dele), `prefers-reduced-motion` zera as transições.
- **Layout:** Início assimétrico (1,5fr/1fr), sem hero centralizado; uma coluna abaixo de 768px; `min-h-[100dvh]`, nunca `h-screen`; menu em uma linha que rola na horizontal no celular.
- **Estados:** vazio (sem concurso, sem itens, sem revisão, nenhum simulado), erro inline nas ações (`role="alert"`), carregamento por `disabled` nos botões durante a ação.
- **Copy:** português direto, sem travessão como enfeite, sem "eyebrows".
- **Tema:** claro apenas (o DESIGN.md é um tema claro). Modo escuro fica fora deste plano.

## Estrutura de arquivos

```
supabase/migrations/0007_estudo.sql        # candidatos, histórico, criar sessão, suspeito, pedir geração
src/db/estudo.dbtest.ts
src/core/sessao/treino-simulado.ts         # + disciplinaDoItem no simulado
src/estudo/estrutura.ts                    # linhas do banco → tópicos-alvo, provas e demandas do cargo
src/estudo/__fixtures__/linha-cargo.ts     # edital → linhas como o seed grava
src/estudo/tipos.ts                        # Sessao, ConfigSessao, RepositorioEstudo, resultados
src/estudo/resultado.ts                    # correção de treino e do simulado completo
src/estudo/servico.ts                      # iniciar sessões, responder, marcar, entregar
src/estudo/__fixtures__/repositorio-falso.ts
src/estudo/painel.ts                       # tabela por disciplina/tópico, tendência, dias até a prova
src/lib/formato.ts                         # números e datas pt-BR
src/lib/auth/moderacao.ts                  # quem modera
src/lib/modos.ts                           # nome e rota de cada sessão
src/db/repositorios/estudo.ts              # RepositorioEstudo com Supabase + leituras das telas
src/db/repositorios/moderacao.ts           # decidir item, custo de IA, fila de jobs (chave secreta)
src/app/globals.css                        # tokens do DESIGN.md
src/components/ui.ts, nav-link.tsx, aviso.tsx
src/components/sessao/{enunciado,feedback,marcar-suspeito,player-treino,lista-correcao}.tsx
src/components/simulado/{cronometro,player-simulado}.tsx
src/components/painel/{evolucao,tendencia}.tsx
src/app/(app)/layout.tsx, contexto.ts, acoes.ts, page.tsx      # Início (substitui src/app/page.tsx)
src/app/(app)/sessao/[id]/{page,acoes}.ts(x)
src/app/(app)/treinar/page.tsx
src/app/(app)/simulado/page.tsx, [id]/{page,acoes}.ts(x), [id]/resultado/page.tsx
src/app/(app)/painel/page.tsx
src/app/(app)/itens/{page,acoes}.ts(x)
```

---

### Task 1: Migração das telas de estudo

**Files:**
- Create: `supabase/migrations/0007_estudo.sql`
- Test: `src/db/estudo.dbtest.ts`

**Interfaces:**
- Produces (SQL):
  ```
  estudo_canonicos_do_cargo(p_cargo uuid) returns setof uuid
  estudo_candidatos(p_cargo uuid) returns jsonb   -- [{ id, textoBaseId, canonicos[], visto }]
  estudo_historico(p_cargo uuid) returns jsonb    -- [{ canonico, resultado, respondidaEm }]
  simulado_criar(p_cargo uuid, p_modo text, p_config jsonb, p_itens uuid[]) returns uuid
  itens_marcar_suspeito(p_item uuid, p_motivo text) returns void
  estudo_pedir_geracao(p_concurso text, p_canonicos text[]) returns integer
  ```

- [ ] **Step 1: Subir o Postgres de teste**

Run: `npm run db:test:start`
Expected: `Postgres de teste: postgresql://postgres@127.0.0.1:54329/postgres`

- [ ] **Step 2: Escrever o teste**

`src/db/estudo.dbtest.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;
let cargo: string;
const item: Record<string, string> = {};

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
      values ('c1', 'Concurso 1', (select id from public.bancas), '2027-01-24');
    insert into public.cargos (concurso_id, slug, nome, duracao_min)
      values ((select id from public.concursos), 'cfo', 'CFO', 270);
    insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, regra_pontuacao, distribuicao)
      values ((select id from public.concursos), 'p1', 'P1', 'objetiva', 'certo_errado', 2,
              '{"regra":"certo_errado_penalidade"}', '{"estimada":true,"disciplinas":{"lp":2}}');
    insert into public.cargo_provas (cargo_id, prova_id, ordem)
      values ((select id from public.cargos), (select id from public.provas), 1);
    insert into public.disciplinas (concurso_id, slug, nome) values ((select id from public.concursos), 'lp', 'Português');
    insert into public.prova_disciplinas (prova_id, disciplina_id, ordem)
      values ((select id from public.provas), (select id from public.disciplinas), 1);
    insert into public.topicos_canonicos (slug, titulo)
      values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência'), ('fisica/optica', 'Óptica');
    insert into public.topicos (disciplina_id, codigo, titulo, canonico_id, ordem)
      select (select id from public.disciplinas), v.codigo, v.titulo, tc.id, v.ordem
      from (values ('1', 'Crase', 'portugues/crase', 1), ('2', 'Regência', 'portugues/regencia', 2)) as v(codigo, titulo, slug, ordem)
      join public.topicos_canonicos tc on tc.slug = v.slug;
  `);
  const novo = async (nome: string, status: string, canonicos: string[]) => {
    item[nome] = await umValor<string>(
      `insert into public.itens (banca_id, formato, enunciado, gabarito, origem, status, hash_normalizado)
       values ((select id from public.bancas), 'certo_errado', $1, 'C', 'ia', $2, $1) returning id`,
      [nome, status],
    );
    for (const c of canonicos) {
      await client.query(
        "insert into public.item_topicos (item_id, topico_canonico_id) select $1, id from public.topicos_canonicos where slug = $2",
        [item[nome], c],
      );
    }
  };
  await novo("crase", "aprovado", ["portugues/crase"]);
  await novo("regencia", "aprovado", ["portugues/regencia", "portugues/crase"]);
  await novo("revisao", "revisao", ["portugues/crase"]);
  await novo("optica", "aprovado", ["fisica/optica"]);
  cargo = await umValor<string>("select id from public.cargos");
});

afterAll(async () => {
  await destruir();
});

async function criarSessao(usuario: string, modo: string, itens: string[]): Promise<string> {
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [usuario]);
  await client.query("set role authenticated");
  try {
    return await umValor<string>("select public.simulado_criar($1, $2, '{}', $3::uuid[])", [cargo, modo, itens]);
  } finally {
    await client.query("reset role");
  }
}

async function responder(usuario: string, simulado: string, itemId: string, resposta: string, duvida = false) {
  await client.query(
    "insert into public.respostas (simulado_id, item_id, user_id, resposta, duvida) values ($1, $2, $3, $4, $5)",
    [simulado, itemId, usuario, resposta, duvida],
  );
}

describe("estudo_candidatos", () => {
  it("lista só itens aprovados de tópicos do cargo, com os canônicos e se a pessoa já viu", async () => {
    const sessao = await criarSessao(ANA, "treino", [item.crase]);
    await responder(ANA, sessao, item.crase, "C");
    const candidatos = await comoUsuario(client, ANA, () => umValor<unknown[]>("select public.estudo_candidatos($1)", [cargo]));
    expect(candidatos).toEqual([
      { id: item.crase, textoBaseId: null, canonicos: ["portugues/crase"], visto: true },
      { id: item.regencia, textoBaseId: null, canonicos: ["portugues/crase", "portugues/regencia"], visto: false },
    ]);
    const paraBruno = await comoUsuario(client, BRUNO, () => umValor<{ visto: boolean }[]>("select public.estudo_candidatos($1)", [cargo]));
    expect(paraBruno.map((c) => c.visto)).toEqual([false, false]);
  });
});

describe("estudo_historico", () => {
  it("devolve uma linha por canônico com o resultado, sem simulado completo em andamento", async () => {
    const treino = await criarSessao(BRUNO, "treino", [item.crase, item.regencia]);
    await responder(BRUNO, treino, item.crase, "E");
    await responder(BRUNO, treino, item.regencia, "C", true);
    const completo = await criarSessao(BRUNO, "completo", [item.crase]);
    await responder(BRUNO, completo, item.crase, "C");

    const historico = await comoUsuario(client, BRUNO, () =>
      umValor<{ canonico: string; resultado: string }[]>("select public.estudo_historico($1)", [cargo]),
    );
    expect(historico.map(({ canonico, resultado }) => `${canonico}:${resultado}`).sort()).toEqual([
      "portugues/crase:certo_duvida", "portugues/crase:errado", "portugues/regencia:certo_duvida",
    ]);

    await client.query("update public.simulados set finalizado_em = now() where id = $1", [completo]);
    const depois = await comoUsuario(client, BRUNO, () => umValor<unknown[]>("select public.estudo_historico($1)", [cargo]));
    expect(depois).toHaveLength(4);
  });
});

describe("simulado_criar", () => {
  it("cria a sessão do usuário com os itens na ordem dada", async () => {
    const id = await criarSessao(ANA, "revisao", [item.regencia, item.crase]);
    const r = await client.query("select item_id, ordem, user_id from public.simulado_itens where simulado_id = $1 order by ordem", [id]);
    expect(r.rows).toEqual([
      { item_id: item.regencia, ordem: 1, user_id: ANA },
      { item_id: item.crase, ordem: 2, user_id: ANA },
    ]);
    expect(await umValor<string>("select user_id from public.simulados where id = $1", [id])).toBe(ANA);
  });

  it("recusa sessão vazia", async () => {
    await expect(criarSessao(ANA, "treino", [])).rejects.toThrow(/sem itens/);
  });
});

describe("itens_marcar_suspeito", () => {
  it("só aceita quem respondeu o item e guarda o motivo", async () => {
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.itens_marcar_suspeito($1, 'x')", [item.optica])),
    ).rejects.toThrow(/só quem respondeu/);

    // comoUsuario desfaz a transação; a marcação de verdade roda fora dela
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [ANA]);
    await client.query("select public.itens_marcar_suspeito($1, 'gabarito errado')", [item.crase]);
    const r = await client.query("select status, validacao->'denuncias'->0->>'motivo' as motivo from public.itens where id = $1", [item.crase]);
    expect(r.rows[0]).toEqual({ status: "suspeito", motivo: "gabarito errado" });
  });
});

describe("estudo_pedir_geracao", () => {
  it("enfileira no máximo 3 pedidos em aberto por usuário e não duplica tópico já na fila", async () => {
    await client.query("delete from public.jobs");
    await client.query(
      "insert into public.jobs (tipo, payload) values ('gerar_itens', '{\"concurso\":\"c1\",\"canonico\":\"a/b\",\"quantidade\":5}')",
    );
    const novos = await comoUsuario(client, ANA, () =>
      umValor<number>("select public.estudo_pedir_geracao('c1', array['a/b', 'a/c', 'a/d', 'a/e', 'a/f'])"),
    );
    expect(novos).toBe(3);
    // comoUsuario desfaz a transação; repete fora dela para conferir o limite acumulado
    await client.query("select set_config('request.jwt.claim.sub', $1, false)", [ANA]);
    expect(await umValor<number>("select public.estudo_pedir_geracao('c1', array['a/c', 'a/d'])")).toBe(2);
    expect(await umValor<number>("select public.estudo_pedir_geracao('c1', array['a/e', 'a/f'])")).toBe(1);
    const r = await client.query("select payload->>'canonico' as c, payload->>'pedido_por' as por from public.jobs order by criado_em, payload->>'canonico'");
    expect(r.rows.map((x) => x.c)).toEqual(["a/b", "a/c", "a/d", "a/e"]);
    expect(r.rows.slice(1).every((x) => x.por === ANA)).toBe(true);
  });

  it("não pode ser chamada por anônimo", async () => {
    await client.query("select set_config('request.jwt.claim.sub', '', false)");
    await expect(client.query("select public.estudo_pedir_geracao('c1', array['a/z'])")).rejects.toThrow(/não autenticado/);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm run test:db -- src/db/estudo.dbtest.ts`
Expected: FAIL com `function public.simulado_criar(...) does not exist`.

- [ ] **Step 4: Escrever a migração**

`supabase/migrations/0007_estudo.sql`:

```sql
-- Funções de leitura e escrita das telas de estudo. As de leitura e a de criação de sessão rodam
-- com os direitos do usuário (RLS vale); as que mexem em tabelas do servidor são security definer
-- e checam auth.uid(). Devolvem jsonb para não esbarrar no limite de linhas da API do Supabase.

-- Tópicos canônicos que caem nas provas objetivas do cargo.
create or replace function public.estudo_canonicos_do_cargo(p_cargo uuid)
returns setof uuid
language sql
stable
set search_path = ''
as $$
  select distinct t.canonico_id
  from public.cargo_provas cp
  join public.provas p on p.id = cp.prova_id and p.tipo = 'objetiva'
  join public.prova_disciplinas pd on pd.prova_id = p.id
  join public.topicos t on t.disciplina_id = pd.disciplina_id
  where cp.cargo_id = p_cargo and t.canonico_id is not null
$$;

-- Itens aprovados do cargo: [{ "id", "textoBaseId", "canonicos": [slug], "visto" }].
create or replace function public.estudo_candidatos(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'textoBaseId', x.texto_base_id, 'canonicos', x.canonicos, 'visto', x.visto
  ) order by x.criado_em, x.id), '[]'::jsonb)
  from (
    select i.id, i.texto_base_id, i.criado_em,
      array_agg(tc.slug order by tc.slug) as canonicos,
      exists (select 1 from public.respostas r where r.item_id = i.id and r.user_id = (select auth.uid())) as visto
    from public.itens i
    join public.item_topicos it on it.item_id = i.id
    join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
    where i.status = 'aprovado'
      and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
    group by i.id
  ) x
$$;

-- Histórico do usuário por tópico canônico do cargo: [{ "canonico", "resultado", "respondidaEm" }].
-- Respostas de simulado completo só contam depois da entrega. Itens suspeitos ou descartados não contam.
create or replace function public.estudo_historico(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'canonico', tc.slug,
    'resultado', case
      when r.resposta = 'branco' then 'branco'
      when r.resposta = i.gabarito then case when r.duvida then 'certo_duvida' else 'certo' end
      else 'errado'
    end,
    'respondidaEm', r.respondida_em
  ) order by r.respondida_em), '[]'::jsonb)
  from public.respostas r
  join public.simulados s on s.id = r.simulado_id
  join public.itens i on i.id = r.item_id and i.status in ('aprovado', 'revisao')
  join public.item_topicos it on it.item_id = i.id
  join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
  where r.user_id = (select auth.uid())
    and (s.modo <> 'completo' or s.finalizado_em is not null)
    and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
$$;

-- Cria a sessão e a lista ordenada de itens numa só transação.
create or replace function public.simulado_criar(p_cargo uuid, p_modo text, p_config jsonb, p_itens uuid[])
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if coalesce(array_length(p_itens, 1), 0) = 0 then
    raise exception 'sessão sem itens';
  end if;
  insert into public.simulados (cargo_id, modo, config)
  values (p_cargo, p_modo, coalesce(p_config, '{}'::jsonb))
  returning id into v_id;
  insert into public.simulado_itens (simulado_id, item_id, ordem)
  select v_id, u.item_id, u.ordem::integer
  from unnest(p_itens) with ordinality as u(item_id, ordem);
  return v_id;
end
$$;

-- Qualquer pessoa que já respondeu o item pode marcá-lo como suspeito; ele sai das sessões
-- até alguém revisar. O motivo fica em validacao->'denuncias'.
create or replace function public.itens_marcar_suspeito(p_item uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'não autenticado';
  end if;
  if not exists (select 1 from public.respostas where item_id = p_item and user_id = (select auth.uid())) then
    raise exception 'só quem respondeu o item pode marcá-lo';
  end if;
  update public.itens
  set status = case when status in ('aprovado', 'revisao') then 'suspeito' else status end,
      validacao = jsonb_set(
        validacao, '{denuncias}',
        coalesce(validacao->'denuncias', '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('usuario', (select auth.uid()), 'motivo', left(coalesce(p_motivo, ''), 500), 'em', now()))
      ),
      atualizado_em = now()
  where id = p_item;
end
$$;

-- Pede geração para os tópicos com poucos itens. Limite de 3 pedidos automáticos em aberto por usuário.
-- Devolve quantos jobs novos entraram na fila.
create or replace function public.estudo_pedir_geracao(p_concurso text, p_canonicos text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_abertos integer;
  v_novos integer := 0;
  v_canonico text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  select count(*) into v_abertos from public.jobs
  where tipo = 'gerar_itens' and status in ('pendente', 'processando') and payload->>'pedido_por' = v_usuario::text;
  foreach v_canonico in array coalesce(p_canonicos, '{}') loop
    exit when v_abertos + v_novos >= 3;
    continue when exists (
      select 1 from public.jobs
      where tipo = 'gerar_itens' and status in ('pendente', 'processando')
        and payload->>'concurso' = p_concurso and payload->>'canonico' = v_canonico
    );
    insert into public.jobs (tipo, payload)
    values ('gerar_itens', jsonb_build_object(
      'concurso', p_concurso, 'canonico', v_canonico, 'quantidade', 5, 'pedido_por', v_usuario
    ));
    v_novos := v_novos + 1;
  end loop;
  return v_novos;
end
$$;

revoke all on function public.estudo_canonicos_do_cargo(uuid) from public, anon;
revoke all on function public.estudo_candidatos(uuid) from public, anon;
revoke all on function public.estudo_historico(uuid) from public, anon;
revoke all on function public.simulado_criar(uuid, text, jsonb, uuid[]) from public, anon;
revoke all on function public.itens_marcar_suspeito(uuid, text) from public, anon;
revoke all on function public.estudo_pedir_geracao(text, text[]) from public, anon;
grant execute on function public.estudo_canonicos_do_cargo(uuid) to authenticated, service_role;
grant execute on function public.estudo_candidatos(uuid) to authenticated, service_role;
grant execute on function public.estudo_historico(uuid) to authenticated, service_role;
grant execute on function public.simulado_criar(uuid, text, jsonb, uuid[]) to authenticated;
grant execute on function public.itens_marcar_suspeito(uuid, text) to authenticated;
grant execute on function public.estudo_pedir_geracao(text, text[]) to authenticated;
```

- [ ] **Step 5: Rodar todos os testes de banco**

Run: `npm run test:db`
Expected: PASS (31 testes; os de migração, seed e pipeline continuam verdes).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_estudo.sql src/db/estudo.dbtest.ts
git commit -m "feat(db): funções das telas de estudo (candidatos, histórico, sessão, suspeito, geração)"
```

---

### Task 2: Aplicar a migração no Supabase e atualizar os tipos (controlador)

Esta task é do controlador, não de um agente: mexe no banco remoto e em `src/db/types.ts`.

- [ ] **Step 1: Aplicar pelo MCP do Supabase**

`apply_migration` com `name: "0007_estudo"` e o conteúdo do arquivo. Se o MCP travar pedindo confirmação, aplicar função por função (cada `create or replace function` com o seu `revoke`/`grant`) via `execute_sql` e registrar a versão em `supabase_migrations.schema_migrations`, como feito no Plano 3.

- [ ] **Step 2: Conferir**

`execute_sql`: `select proname from pg_proc where proname like 'estudo_%' or proname in ('simulado_criar', 'itens_marcar_suspeito') order by 1;`
Expected: 6 linhas.

- [ ] **Step 3: Regenerar os tipos**

`generate_typescript_types` e gravar em `src/db/types.ts` (removendo, se aparecerem, as funções `_teste_mcp*`). As entradas novas em `Functions` devem ser:

```ts
      estudo_candidatos: { Args: { p_cargo: string }; Returns: Json }
      estudo_canonicos_do_cargo: { Args: { p_cargo: string }; Returns: string[] }
      estudo_historico: { Args: { p_cargo: string }; Returns: Json }
      estudo_pedir_geracao: {
        Args: { p_canonicos: string[]; p_concurso: string }
        Returns: number
      }
      itens_marcar_suspeito: {
        Args: { p_item: string; p_motivo: string }
        Returns: undefined
      }
      simulado_criar: {
        Args: { p_cargo: string; p_config: Json; p_itens: string[]; p_modo: string }
        Returns: string
      }
```

- [ ] **Step 4: Typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/db/types.ts
git commit -m "chore(db): tipos com as funções das telas de estudo"
```

---

### Task 3: Disciplina de cada item no simulado

**Files:**
- Modify: `src/core/sessao/treino-simulado.ts`, `src/core/sessao/treino-simulado.test.ts`

**Interfaces:**
- Produces: `SimuladoMontado.disciplinaDoItem: Record<string, string>` (id do item → slug da disciplina cuja demanda o escolheu). Usado na análise por disciplina e de dúvida.

- [ ] **Step 1: Acrescentar a expectativa ao teste existente**

No teste `"cumpre a quantidade de cada disciplina cobrindo os tópicos em rodízio"`, depois de `expect(r.faltantes).toEqual([]);`:

```ts
    expect(r.disciplinaDoItem).toMatchObject({ "p/x#0": "port", "p/y#1": "port", "m/x#2": "mat" });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/core/sessao/treino-simulado.test.ts`
Expected: FAIL (`disciplinaDoItem` undefined).

- [ ] **Step 3: Implementar**

`src/core/sessao/treino-simulado.ts`:

```ts
import type { DemandaDisciplina } from "../edital/consultas";
import type { PrioridadeTopico } from "../foco/prioridade";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

function rodizio(canonicos: string[], itens: ItemCandidato[], usados: Set<string>, quantidade: number): string[] {
  const escolhidos: string[] = [];
  let progresso = true;
  while (escolhidos.length < quantidade && progresso) {
    progresso = false;
    for (const c of canonicos) {
      if (escolhidos.length >= quantidade) break;
      const [id] = escolherDoTopico(c, itens, usados, 1);
      if (id === undefined) continue;
      escolhidos.push(id);
      usados.add(id);
      progresso = true;
    }
  }
  return escolhidos;
}

export function montarTreinoTopico(p: { canonicos: string[]; itens: ItemCandidato[]; total: number }): string[] {
  return agruparPorTextoBase(rodizio(p.canonicos, p.itens, new Set(), p.total), p.itens);
}

export interface SimuladoMontado {
  itens: string[];
  faltantes: { disciplina: string; faltam: number }[];
  disciplinaDoItem: Record<string, string>;
}

export function montarSimuladoProva(
  demandas: DemandaDisciplina[],
  itens: ItemCandidato[],
  excluir: Set<string> = new Set(),
): SimuladoMontado {
  const usados = new Set(excluir);
  const selecionados: string[] = [];
  const faltantes: SimuladoMontado["faltantes"] = [];
  const disciplinaDoItem: Record<string, string> = {};
  for (const d of demandas) {
    const escolhidos = rodizio(d.canonicos, itens, usados, d.quantidade);
    selecionados.push(...escolhidos);
    for (const id of escolhidos) disciplinaDoItem[id] = d.disciplina;
    if (escolhidos.length < d.quantidade) faltantes.push({ disciplina: d.disciplina, faltam: d.quantidade - escolhidos.length });
  }
  return { itens: agruparPorTextoBase(selecionados, itens), faltantes, disciplinaDoItem };
}

export function topicosQuePrecisamGeracao(
  prioridades: PrioridadeTopico[],
  itens: ItemCandidato[],
  opcoes: { top?: number; minimoNaoVistos?: number } = {},
): string[] {
  const top = opcoes.top ?? 10;
  const minimo = opcoes.minimoNaoVistos ?? 10;
  const canonicos = [...new Set(prioridades.slice(0, top).map((p) => p.canonico))];
  return canonicos.filter((c) => itens.filter((i) => !i.visto && i.canonicos.includes(c)).length < minimo);
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/core`
Expected: PASS.

```bash
git add src/core/sessao/treino-simulado.ts src/core/sessao/treino-simulado.test.ts
git commit -m "feat(core): simulado informa a disciplina de cada item"
```

---

### Task 4: Estrutura do cargo a partir do banco

**Files:**
- Create: `src/estudo/estrutura.ts`, `src/estudo/__fixtures__/linha-cargo.ts`
- Test: `src/estudo/estrutura.test.ts`

**Interfaces:**
- Consumes: `regraPontuacaoSchema`, `regraCorteSchema`, `TopicoAlvo`, `DemandaDisciplina` de `@/core`.
- Produces:
  ```ts
  interface LinhaCargo { … }   // formato da consulta aninhada do Supabase (cargos → cargo_provas → provas → prova_disciplinas → disciplinas → topicos)
  interface ProvaDoCargo { id; slug; nome; nItens; regra: RegraPontuacao; corte?: RegraCorte; demandas: DemandaDisciplina[] }
  interface EstruturaCargo {
    cargo: { id; slug; nome; duracaoMin }; concurso: { id; slug; nome; dataProva };
    provas: ProvaDoCargo[]; temDiscursiva: boolean; corteConjunto?: { provas: string[]; corte: RegraCorte };
    topicosAlvo: TopicoAlvo[]; disciplinas: Record<string, string>;
  }
  function montarEstruturaCargo(l: LinhaCargo): EstruturaCargo
  ```

O teste garante que a estrutura montada das tabelas é **idêntica** à de `topicosAlvoDoCargo` e `demandasDaProva` lidas do YAML, para o edital mínimo e para o CBM-AL real (CFO e Soldado). A fixture imita o seed: ids, `parent_id` e `ordem` em profundidade por disciplina, e devolve as listas embaralhadas.

- [ ] **Step 1: Escrever a fixture e o teste**

`src/estudo/__fixtures__/linha-cargo.ts`:

```ts
import type { Edital, Topico } from "@/core";
import type { LinhaCargo, LinhaTopico } from "../estrutura";

// Reproduz o que o seed grava no banco (ids, pais e ordem em profundidade por disciplina)
// para testar a estrutura montada a partir das tabelas contra core/edital/consultas.ts.
export function linhaDoEdital(e: Edital, cargo: string): LinhaCargo {
  const c = e.cargos.find((x) => x.slug === cargo)!;
  const topicosDa = (slug: string): LinhaTopico[] => {
    const linhas: LinhaTopico[] = [];
    const visitar = (ts: Topico[], pai: string | null) => {
      for (const t of ts) {
        const id = `${slug}:${t.codigo}`;
        linhas.push({
          id,
          codigo: t.codigo,
          titulo: t.titulo,
          parent_id: pai,
          ordem: linhas.length,
          topicos_canonicos: t.canonico ? { slug: t.canonico } : null,
        });
        if (t.subtopicos) visitar(t.subtopicos, id);
      }
    };
    visitar(e.disciplinas.find((d) => d.slug === slug)!.topicos, null);
    // o banco não garante ordem: embaralha de forma determinística
    return linhas.reverse();
  };
  return {
    id: `cargo-${cargo}`,
    slug: c.slug,
    nome: c.nome,
    duracao_min: c.duracao_min,
    corte_conjunto: c.corte_conjunto ?? null,
    concursos: { id: "concurso", slug: e.slug, nome: e.nome, data_prova: e.data_prova },
    cargo_provas: c.provas
      .map((slug, i) => {
        const p = e.provas.find((x) => x.slug === slug)!;
        return {
          ordem: i + 1,
          provas:
            p.tipo === "objetiva"
              ? {
                  id: `prova-${p.slug}`,
                  slug: p.slug,
                  nome: p.nome,
                  tipo: p.tipo,
                  n_itens: p.itens,
                  regra_pontuacao: p.pontuacao,
                  regra_corte: p.corte ?? null,
                  distribuicao: p.distribuicao_estimada,
                  prova_disciplinas: p.disciplinas.map((d, j) => ({
                    ordem: j + 1,
                    disciplinas: { slug: d, nome: e.disciplinas.find((x) => x.slug === d)!.nome, topicos: topicosDa(d) },
                  })),
                }
              : {
                  id: `prova-${p.slug}`, slug: p.slug, nome: p.nome, tipo: p.tipo, n_itens: null,
                  regra_pontuacao: null, regra_corte: null, distribuicao: null, prova_disciplinas: [],
                },
        };
      })
      .reverse(),
  };
}
```

`src/estudo/estrutura.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { demandasDaProva, parseEdital, provasObjetivasDoCargo, topicosAlvoDoCargo } from "@/core";
import { editalMini } from "@/core/edital/__fixtures__/mini";
import { linhaDoEdital } from "./__fixtures__/linha-cargo";
import { montarEstruturaCargo } from "./estrutura";

const cbmal = parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"));

describe("montarEstruturaCargo", () => {
  for (const [nome, edital] of [["mini", editalMini()], ["cbmal-2026", cbmal]] as const) {
    for (const cargo of edital.cargos.map((c) => c.slug)) {
      it(`${nome}/${cargo}: dá os mesmos tópicos-alvo e demandas que o edital`, () => {
        const e = montarEstruturaCargo(linhaDoEdital(edital, cargo));
        expect(e.topicosAlvo).toEqual(topicosAlvoDoCargo(edital, cargo));
        const objetivas = provasObjetivasDoCargo(edital, cargo);
        expect(e.provas.map((p) => p.slug)).toEqual(objetivas.map((p) => p.slug));
        for (const p of e.provas) expect(p.demandas).toEqual(demandasDaProva(edital, p.slug));
      });
    }
  }

  it("lê regras, cortes, duração e se há discursiva", () => {
    const e = montarEstruturaCargo(linhaDoEdital(cbmal, "cfo"));
    expect(e.cargo).toMatchObject({ slug: "cfo", duracaoMin: 270 });
    expect(e.temDiscursiva).toBe(true);
    expect(e.provas[0]).toMatchObject({ slug: "p1-gerais", nItens: 50, regra: { regra: "certo_errado_penalidade" }, corte: { regra: "piso_fator", fator: 0.2 } });
    expect(e.corteConjunto).toEqual({ provas: ["p1-gerais", "p2-cfo"], corte: { regra: "piso_fator", fator: 0.3 } });
    expect(e.disciplinas.lp).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/estudo/estrutura.test.ts`
Expected: FAIL (módulo `./estrutura` não existe).

- [ ] **Step 3: Implementar**

`src/estudo/estrutura.ts`:

```ts
import { z } from "zod";
import {
  regraCorteSchema,
  regraPontuacaoSchema,
  type DemandaDisciplina,
  type RegraCorte,
  type RegraPontuacao,
  type TopicoAlvo,
} from "@/core";

// Formato devolvido pela consulta aninhada do Supabase (ver repositorios/estudo.ts).
export interface LinhaTopico {
  id: string;
  codigo: string;
  titulo: string;
  parent_id: string | null;
  ordem: number;
  topicos_canonicos: { slug: string } | null;
}

export interface LinhaCargo {
  id: string;
  slug: string;
  nome: string;
  duracao_min: number;
  corte_conjunto: unknown;
  concursos: { id: string; slug: string; nome: string; data_prova: string };
  cargo_provas: {
    ordem: number;
    provas: {
      id: string;
      slug: string;
      nome: string;
      tipo: string;
      n_itens: number | null;
      regra_pontuacao: unknown;
      regra_corte: unknown;
      distribuicao: unknown;
      prova_disciplinas: {
        ordem: number;
        disciplinas: { slug: string; nome: string; topicos: LinhaTopico[] };
      }[];
    };
  }[];
}

export interface ProvaDoCargo {
  id: string;
  slug: string;
  nome: string;
  nItens: number;
  regra: RegraPontuacao;
  corte?: RegraCorte;
  demandas: DemandaDisciplina[];
}

export interface EstruturaCargo {
  cargo: { id: string; slug: string; nome: string; duracaoMin: number };
  concurso: { id: string; slug: string; nome: string; dataProva: string };
  provas: ProvaDoCargo[];
  temDiscursiva: boolean;
  corteConjunto?: { provas: string[]; corte: RegraCorte };
  topicosAlvo: TopicoAlvo[];
  disciplinas: Record<string, string>;
}

const distribuicaoSchema = z.object({ disciplinas: z.record(z.string(), z.number()) });
const corteConjuntoSchema = z.object({ provas: z.array(z.string()), corte: regraCorteSchema }).nullable();

function folhas(topicos: LinhaTopico[]): LinhaTopico[] {
  const pais = new Set(topicos.map((t) => t.parent_id).filter(Boolean));
  return topicos.filter((t) => !pais.has(t.id) && t.topicos_canonicos).sort((a, b) => a.ordem - b.ordem);
}

// Mesmas regras de core/edital/consultas.ts, a partir das tabelas: peso = itens estimados da
// disciplina na prova ÷ número de tópicos folha da disciplina.
export function montarEstruturaCargo(l: LinhaCargo): EstruturaCargo {
  const provas: ProvaDoCargo[] = [];
  const topicosAlvo: TopicoAlvo[] = [];
  const disciplinas: Record<string, string> = {};
  let temDiscursiva = false;

  for (const { provas: p } of [...l.cargo_provas].sort((a, b) => a.ordem - b.ordem)) {
    if (p.tipo !== "objetiva") {
      temDiscursiva = true;
      continue;
    }
    const distribuicao = distribuicaoSchema.parse(p.distribuicao).disciplinas;
    const demandas: DemandaDisciplina[] = [];
    for (const { disciplinas: d } of [...p.prova_disciplinas].sort((a, b) => a.ordem - b.ordem)) {
      disciplinas[d.slug] = d.nome;
      const lista = folhas(d.topicos);
      const quantidade = distribuicao[d.slug] ?? 0;
      for (const t of lista) {
        topicosAlvo.push({
          disciplina: d.slug,
          codigo: t.codigo,
          titulo: t.titulo,
          canonico: t.topicos_canonicos!.slug,
          chave: `${d.slug}:${t.codigo}`,
          peso: quantidade / lista.length,
        });
      }
      demandas.push({
        disciplina: d.slug,
        canonicos: [...new Set(lista.map((t) => t.topicos_canonicos!.slug))],
        quantidade,
      });
    }
    provas.push({
      id: p.id,
      slug: p.slug,
      nome: p.nome,
      nItens: p.n_itens ?? demandas.reduce((s, d) => s + d.quantidade, 0),
      regra: regraPontuacaoSchema.parse(p.regra_pontuacao),
      corte: p.regra_corte ? regraCorteSchema.parse(p.regra_corte) : undefined,
      demandas,
    });
  }

  const corteConjunto = corteConjuntoSchema.parse(l.corte_conjunto ?? null) ?? undefined;
  return {
    cargo: { id: l.id, slug: l.slug, nome: l.nome, duracaoMin: l.duracao_min },
    concurso: { id: l.concursos.id, slug: l.concursos.slug, nome: l.concursos.nome, dataProva: l.concursos.data_prova },
    provas,
    temDiscursiva,
    corteConjunto,
    topicosAlvo,
    disciplinas,
  };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/estudo`
Expected: PASS (4 testes).

```bash
git add src/estudo
git commit -m "feat(estudo): estrutura do cargo montada das tabelas, igual à do edital"
```

---

### Task 5: Serviço de sessões

**Files:**
- Create: `src/estudo/tipos.ts`, `src/estudo/resultado.ts`, `src/estudo/servico.ts`, `src/estudo/__fixtures__/repositorio-falso.ts`
- Test: `src/estudo/servico.test.ts`

**Interfaces:**
- Consumes: `calcularPrioridades`, `montarEstudarAgora`, `montarTreinoTopico`, `montarSimuladoProva`, `topicosQuePrecisamGeracao`, `proximoEstadoRevisao`, `calcularResultado`, `analisarDuvidas`, `resultadoDaResposta`, `situacao` de `@/core`; `EstruturaCargo` da Task 4.
- Produces:
  ```ts
  type Marcacao = "C" | "E" | "branco"
  type ModoSessao = "treino" | "revisao" | "completo"
  type ConfigSessao = { tipo: "estudar_agora" } | { tipo: "topico"; canonicos } | { tipo: "revisao" }
    | { tipo: "completo"; duracaoMin; provas: { slug; itens: string[] }[]; disciplinaDoItem }
  interface RepositorioEstudo { estrutura; candidatos; historico; revisoesVencidas; criarSessao; pedirGeracao;
    sessao; itensCorrecao; respostas; gravarResposta(sessaoId, r, substituir): Promise<boolean>;
    estadosRevisao; salvarRevisao; finalizar }
  type ResultadoSessao = ResumoTreino | ResultadoCompleto
  iniciarEstudarAgora(repo, cargoId, agora): Promise<InicioSessao>
  iniciarTreinoTopico(repo, cargoId, canonicos, total): Promise<InicioSessao>
  iniciarRevisao(repo, cargoId, agora): Promise<InicioSessao>
  previaSimulado(repo, cargoId): Promise<{ config; faltantes: Faltante[] }>
  iniciarSimulado(repo, cargoId): Promise<InicioSimulado>
  pedirGeracaoDosFaltantes(repo, cargoId, canonicos): Promise<number>
  responderItem(repo, { sessaoId, itemId, resposta, duvida, tempoMs, agora }): Promise<Correcao>
  encerrarTreino(repo, sessaoId, agora): Promise<void>
  prazoDoSimulado(s: Sessao): Date | null
  marcarNoSimulado(repo, { sessaoId, itemId, resposta, duvida, agora }): Promise<void>
  entregarSimulado(repo, sessaoId, agora): Promise<ResultadoSessao>
  class ErroEstudo { codigo: "sessao_inexistente" | "sessao_encerrada" | "item_fora_da_sessao" | "modo_invalido" | "tempo_esgotado" }
  resultadoDe(resposta: Marcacao, duvida, gabarito): ResultadoResposta    // usado também no navegador
  ```

- [ ] **Step 1: Escrever o repositório falso e o teste**

`src/estudo/__fixtures__/repositorio-falso.ts`:

```ts
import type { EstadoRevisao, ItemCandidato, RespostaHistorico } from "@/core";
import type { EstruturaCargo } from "../estrutura";
import type { ItemCorrecao, RepositorioEstudo, RespostaGravada, ResultadoSessao, Sessao } from "../tipos";

export interface EstadoFalso {
  estrutura: EstruturaCargo;
  candidatos: ItemCandidato[];
  historico: RespostaHistorico[];
  gabaritos: Record<string, string>;
  vencidas: string[];
  sessoes: Map<string, Sessao>;
  respostas: Map<string, RespostaGravada[]>;
  revisao: Map<string, EstadoRevisao>;
  resultados: Map<string, ResultadoSessao>;
  pedidos: string[][];
  falharGeracao: boolean;
}

export function criarRepositorioFalso(inicial: Partial<EstadoFalso> & { estrutura: EstruturaCargo }) {
  const estado: EstadoFalso = {
    candidatos: [],
    historico: [],
    gabaritos: {},
    vencidas: [],
    sessoes: new Map(),
    respostas: new Map(),
    revisao: new Map(),
    resultados: new Map(),
    pedidos: [],
    falharGeracao: false,
    ...inicial,
  };
  let proximoId = 1;

  const repo: RepositorioEstudo = {
    async estrutura() {
      return estado.estrutura;
    },
    async candidatos() {
      return estado.candidatos;
    },
    async historico() {
      return estado.historico;
    },
    async revisoesVencidas() {
      return estado.vencidas;
    },
    async criarSessao(cargoId, modo, config, itens) {
      const id = `s${proximoId++}`;
      estado.sessoes.set(id, { id, cargoId, modo, config, iniciadaEm: new Date("2026-10-15T12:00:00Z"), finalizadaEm: null, itens });
      return id;
    },
    async pedirGeracao(_concurso, canonicos) {
      if (estado.falharGeracao) throw new Error("sem chave");
      estado.pedidos.push(canonicos);
      return Math.min(3, canonicos.length);
    },
    async sessao(id) {
      return estado.sessoes.get(id) ?? null;
    },
    async itensCorrecao(ids) {
      return ids.map<ItemCorrecao>((id) => ({
        id,
        gabarito: estado.gabaritos[id] ?? "C",
        justificativa: `porque ${id}`,
        citacao: null,
        fonte: null,
      }));
    },
    async respostas(sessaoId) {
      return [...(estado.respostas.get(sessaoId) ?? [])];
    },
    async gravarResposta(sessaoId, r, substituir) {
      const lista = estado.respostas.get(sessaoId) ?? [];
      const i = lista.findIndex((x) => x.itemId === r.itemId);
      if (i >= 0 && !substituir) return false;
      const nova = { itemId: r.itemId, resposta: r.resposta, duvida: r.duvida };
      if (i >= 0) lista[i] = nova;
      else lista.push(nova);
      estado.respostas.set(sessaoId, lista);
      return true;
    },
    async estadosRevisao(ids) {
      return new Map(ids.filter((id) => estado.revisao.has(id)).map((id) => [id, estado.revisao.get(id)!]));
    },
    async salvarRevisao(itemId, e) {
      if (e) estado.revisao.set(itemId, e);
      else estado.revisao.delete(itemId);
    },
    async finalizar(sessaoId, resultado, agora) {
      const s = estado.sessoes.get(sessaoId)!;
      s.finalizadaEm = agora;
      estado.resultados.set(sessaoId, resultado);
    },
  };
  return { repo, estado };
}
```

`src/estudo/servico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ItemCandidato } from "@/core";
import { criarRepositorioFalso } from "./__fixtures__/repositorio-falso";
import type { EstruturaCargo } from "./estrutura";
import {
  encerrarTreino,
  entregarSimulado,
  ErroEstudo,
  iniciarEstudarAgora,
  iniciarRevisao,
  iniciarSimulado,
  iniciarTreinoTopico,
  marcarNoSimulado,
  pedirGeracaoDosFaltantes,
  responderItem,
} from "./servico";
import type { ResultadoCompleto } from "./tipos";

const AGORA = new Date("2026-10-15T12:00:00Z");
const DIA = 86_400_000;

const estrutura: EstruturaCargo = {
  cargo: { id: "cargo", slug: "cfo", nome: "CFO", duracaoMin: 270 },
  concurso: { id: "concurso", slug: "c1", nome: "Concurso", dataProva: "2027-01-24" },
  provas: [
    {
      id: "p1",
      slug: "p1",
      nome: "P1",
      nItens: 3,
      regra: { regra: "certo_errado_penalidade" },
      corte: { regra: "minimo_absoluto", valor: 1 },
      demandas: [
        { disciplina: "lp", canonicos: ["lp/a", "lp/b"], quantidade: 2 },
        { disciplina: "mat", canonicos: ["mat/a"], quantidade: 1 },
      ],
    },
  ],
  temDiscursiva: true,
  topicosAlvo: [
    { disciplina: "lp", codigo: "1", titulo: "A", canonico: "lp/a", chave: "lp:1", peso: 1 },
    { disciplina: "lp", codigo: "2", titulo: "B", canonico: "lp/b", chave: "lp:2", peso: 1 },
    { disciplina: "mat", codigo: "1", titulo: "A", canonico: "mat/a", chave: "mat:1", peso: 1 },
  ],
  disciplinas: { lp: "Português", mat: "Matemática" },
};

const itens = (canonico: string, n: number): ItemCandidato[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${canonico}#${i}`, textoBaseId: null, canonicos: [canonico], visto: false }));

describe("iniciarEstudarAgora", () => {
  it("cria uma sessão de treino com os itens do motor de foco e pede geração para tópicos com poucos itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: [...itens("lp/a", 12), ...itens("mat/a", 3)] });
    const r = await iniciarEstudarAgora(repo, "cargo", AGORA);
    expect(r).toMatchObject({ tipo: "criada", pedidosGeracao: 2 });
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s).toMatchObject({ modo: "treino", config: { tipo: "estudar_agora" } });
    expect(s.itens).toHaveLength(15);
    expect(estado.pedidos).toEqual([["lp/b", "mat/a"]]);
  });

  it("não falha quando a fila de geração não está disponível", async () => {
    const { repo } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 2), falharGeracao: true });
    expect(await iniciarEstudarAgora(repo, "cargo", AGORA)).toMatchObject({ tipo: "criada", pedidosGeracao: 0 });
  });

  it("avisa quando ainda não há itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura });
    expect(await iniciarEstudarAgora(repo, "cargo", AGORA)).toEqual({ tipo: "sem_itens", pedidosGeracao: 3 });
    expect(estado.sessoes.size).toBe(0);
  });
});

describe("iniciarTreinoTopico e iniciarRevisao", () => {
  it("treina só os tópicos escolhidos", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: [...itens("lp/a", 5), ...itens("mat/a", 5)] });
    const r = await iniciarTreinoTopico(repo, "cargo", ["mat/a"], 4);
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s.itens).toEqual(["mat/a#0", "mat/a#1", "mat/a#2", "mat/a#3"]);
    expect(s.config).toEqual({ tipo: "topico", canonicos: ["mat/a"] });
  });

  it("revisa os itens vencidos que ainda são do cargo", async () => {
    const { repo, estado } = criarRepositorioFalso({
      estrutura,
      candidatos: itens("lp/a", 3),
      vencidas: ["lp/a#2", "outro-cargo", "lp/a#0"],
    });
    const r = await iniciarRevisao(repo, "cargo", AGORA);
    expect(estado.sessoes.get((r as { sessaoId: string }).sessaoId)!.itens).toEqual(["lp/a#2", "lp/a#0"]);
    const vazio = criarRepositorioFalso({ estrutura });
    expect(await iniciarRevisao(vazio.repo, "cargo", AGORA)).toEqual({ tipo: "sem_itens", pedidosGeracao: 0 });
  });
});

describe("responderItem", () => {
  async function sessaoDeTreino() {
    const f = criarRepositorioFalso({ estrutura, gabaritos: { a: "C", b: "E" } });
    const id = await f.repo.criarSessao("cargo", "treino", { tipo: "estudar_agora" }, ["a", "b"]);
    return { ...f, id };
  }

  it("corrige, agenda a revisão de um erro e não aceita trocar a resposta", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    const c = await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "E", duvida: false, tempoMs: 5000, agora: AGORA });
    expect(c).toMatchObject({ gabarito: "C", resultado: "errado", justificativa: "porque a", concluida: false });
    expect(estado.revisao.get("a")).toEqual({ etapa: 1, proximaEm: new Date(AGORA.getTime() + DIA) });

    const outra = await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: 1, agora: AGORA });
    expect(outra).toMatchObject({ resposta: "E", resultado: "errado" });
    expect(estado.revisao.get("a")!.etapa).toBe(1);
  });

  it("encerra a sessão com o resumo quando o último item é respondido", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: true, tempoMs: null, agora: AGORA });
    const c = await responderItem(repo, { sessaoId: id, itemId: "b", resposta: "branco", duvida: false, tempoMs: null, agora: AGORA });
    expect(c.concluida).toBe(true);
    expect(estado.resultados.get(id)).toEqual({ tipo: "treino", certos: 1, errados: 0, brancos: 1, comDuvida: 1 });
    await expect(
      responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toMatchObject({ codigo: "sessao_encerrada" });
  });

  it("recusa item de fora da sessão e sessão de simulado completo", async () => {
    const { repo, id } = await sessaoDeTreino();
    await expect(
      responderItem(repo, { sessaoId: id, itemId: "z", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toBeInstanceOf(ErroEstudo);
    const completo = await repo.criarSessao("cargo", "completo", { tipo: "completo", duracaoMin: 10, provas: [], disciplinaDoItem: {} }, ["a"]);
    await expect(
      responderItem(repo, { sessaoId: completo, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA }),
    ).rejects.toMatchObject({ codigo: "modo_invalido" });
  });

  it("encerrarTreino fecha a sessão só com o que foi respondido", async () => {
    const { repo, estado, id } = await sessaoDeTreino();
    await responderItem(repo, { sessaoId: id, itemId: "b", resposta: "E", duvida: false, tempoMs: null, agora: AGORA });
    await encerrarTreino(repo, id, AGORA);
    expect(estado.resultados.get(id)).toEqual({ tipo: "treino", certos: 1, errados: 0, brancos: 0, comDuvida: 0 });
  });
});

describe("simulado completo", () => {
  const candidatos = [...itens("lp/a", 2), ...itens("lp/b", 2), ...itens("mat/a", 2)];

  it("segue a distribuição da prova e desconta 1h da discursiva", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos });
    const r = await iniciarSimulado(repo, "cargo");
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s.modo).toBe("completo");
    expect(s.itens).toEqual(["lp/a#0", "lp/b#0", "mat/a#0"]);
    expect(s.config).toEqual({
      tipo: "completo",
      duracaoMin: 210,
      provas: [{ slug: "p1", itens: ["lp/a#0", "lp/b#0", "mat/a#0"] }],
      disciplinaDoItem: { "lp/a#0": "lp", "lp/b#0": "lp", "mat/a#0": "mat" },
    });
  });

  it("informa o que falta por disciplina sem criar a sessão", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 1) });
    expect(await iniciarSimulado(repo, "cargo")).toEqual({
      tipo: "faltam_itens",
      faltantes: [
        { prova: "p1", disciplina: "lp", nome: "Português", faltam: 1, canonicos: ["lp/a", "lp/b"] },
        { prova: "p1", disciplina: "mat", nome: "Matemática", faltam: 1, canonicos: ["mat/a"] },
      ],
    });
    expect(estado.sessoes.size).toBe(0);
  });

  it("pede geração começando pelos tópicos com menos itens", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos: itens("lp/a", 1) });
    await pedirGeracaoDosFaltantes(repo, "cargo", ["lp/a", "lp/b", "mat/a"]);
    expect(estado.pedidos).toEqual([["lp/b", "mat/a", "lp/a"]]);
  });

  it("aceita troca de marcação dentro do prazo e recusa depois", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos });
    const { sessaoId } = (await iniciarSimulado(repo, "cargo")) as { sessaoId: string };
    const inicio = estado.sessoes.get(sessaoId)!.iniciadaEm.getTime();
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "C", duvida: false, agora: new Date(inicio) });
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "E", duvida: true, agora: new Date(inicio + 60_000) });
    expect(estado.respostas.get(sessaoId)).toEqual([{ itemId: "lp/a#0", resposta: "E", duvida: true }]);
    await expect(
      marcarNoSimulado(repo, { sessaoId, itemId: "lp/b#0", resposta: "C", duvida: false, agora: new Date(inicio + 212 * 60_000) }),
    ).rejects.toMatchObject({ codigo: "tempo_esgotado" });
  });

  it("entrega: corrige pelas regras do edital, agenda revisões e é idempotente", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos, gabaritos: { "lp/a#0": "C", "lp/b#0": "E", "mat/a#0": "C" } });
    const { sessaoId } = (await iniciarSimulado(repo, "cargo")) as { sessaoId: string };
    const agora = estado.sessoes.get(sessaoId)!.iniciadaEm;
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/a#0", resposta: "C", duvida: false, agora });
    await marcarNoSimulado(repo, { sessaoId, itemId: "lp/b#0", resposta: "C", duvida: true, agora });

    const r = (await entregarSimulado(repo, sessaoId, AGORA)) as ResultadoCompleto;
    expect(r.provas[0]).toMatchObject({ slug: "p1", nome: "P1", nItens: 3, nota: 0, certos: 1, errados: 1, brancos: 1, corte: 1, aprovada: false });
    expect(r.aprovado).toBe(false);
    expect(r.porDisciplina).toEqual([
      { disciplina: "lp", nome: "Português", certos: 1, errados: 1, brancos: 0 },
      { disciplina: "mat", nome: "Matemática", certos: 0, errados: 0, brancos: 1 },
    ]);
    expect(r.duvidas).toEqual([
      { disciplina: "lp", nome: "Português", itens: 1, certos: 0, errados: 1, saldo: -1, recomendacao: "dados_insuficientes" },
    ]);
    expect([...estado.revisao.keys()].sort()).toEqual(["lp/b#0", "mat/a#0"]);
    expect(estado.sessoes.get(sessaoId)!.finalizadaEm).toEqual(AGORA);

    estado.revisao.clear();
    expect(await entregarSimulado(repo, sessaoId, AGORA)).toEqual(r);
    expect(estado.revisao.size).toBe(0);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/estudo/servico.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar os tipos, a correção e o serviço**

`src/estudo/tipos.ts`:

```ts
import type {
  AnaliseDuvida,
  EstadoRevisao,
  ItemCandidato,
  ResultadoProva,
  ResultadoResposta,
  RespostaHistorico,
} from "@/core";
import type { EstruturaCargo } from "./estrutura";

// Resposta marcada na tela: Certo, Errado ou em branco.
export type Marcacao = "C" | "E" | "branco";

export type ModoSessao = "treino" | "revisao" | "completo";

export type ConfigSessao =
  | { tipo: "estudar_agora" }
  | { tipo: "topico"; canonicos: string[] }
  | { tipo: "revisao" }
  | {
      tipo: "completo";
      duracaoMin: number;
      provas: { slug: string; itens: string[] }[];
      disciplinaDoItem: Record<string, string>;
    };

export interface Sessao {
  id: string;
  cargoId: string;
  modo: ModoSessao;
  config: ConfigSessao;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  itens: string[];
}

export interface ItemCorrecao {
  id: string;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
}

export interface RespostaGravada {
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
}

export interface ResumoTreino {
  tipo: "treino";
  certos: number;
  errados: number;
  brancos: number;
  comDuvida: number;
}

export interface DesempenhoDisciplina {
  disciplina: string;
  nome: string;
  certos: number;
  errados: number;
  brancos: number;
}

export interface ResultadoCompleto {
  tipo: "completo";
  provas: (ResultadoProva & { nome: string; nItens: number })[];
  total: number;
  corteConjunto: number | null;
  aprovado: boolean;
  motivos: string[];
  porDisciplina: DesempenhoDisciplina[];
  duvidas: (AnaliseDuvida & { nome: string })[];
}

export type ResultadoSessao = ResumoTreino | ResultadoCompleto;

export interface RepositorioEstudo {
  estrutura(cargoId: string): Promise<EstruturaCargo>;
  candidatos(cargoId: string): Promise<ItemCandidato[]>;
  historico(cargoId: string): Promise<RespostaHistorico[]>;
  revisoesVencidas(agora: Date): Promise<string[]>;
  criarSessao(cargoId: string, modo: ModoSessao, config: ConfigSessao, itens: string[]): Promise<string>;
  pedirGeracao(concurso: string, canonicos: string[]): Promise<number>;
  sessao(id: string): Promise<Sessao | null>;
  itensCorrecao(ids: string[]): Promise<ItemCorrecao[]>;
  respostas(sessaoId: string): Promise<RespostaGravada[]>;
  // substituir = false: não altera uma resposta já gravada e devolve false.
  gravarResposta(
    sessaoId: string,
    r: RespostaGravada & { tempoMs: number | null },
    substituir: boolean,
  ): Promise<boolean>;
  estadosRevisao(itemIds: string[]): Promise<Map<string, EstadoRevisao>>;
  salvarRevisao(itemId: string, estado: EstadoRevisao | null): Promise<void>;
  finalizar(sessaoId: string, resultado: ResultadoSessao, agora: Date): Promise<void>;
}

export type { ResultadoResposta };
```

`src/estudo/resultado.ts`:

```ts
import {
  analisarDuvidas,
  calcularResultado,
  resultadoDaResposta,
  situacao,
  type EntradaProva,
  type ResultadoResposta,
} from "@/core";
import type { EstruturaCargo } from "./estrutura";
import type { ConfigSessao, Marcacao, RespostaGravada, ResultadoCompleto, ResumoTreino } from "./tipos";

export function marcacaoParaCore(m: Marcacao): string | null {
  return m === "branco" ? null : m;
}

export function resultadoDe(resposta: Marcacao, duvida: boolean, gabarito: string): ResultadoResposta {
  return resultadoDaResposta(situacao({ marcacao: marcacaoParaCore(resposta), gabarito }), duvida);
}

export function resumoTreino(respostas: RespostaGravada[], gabaritos: Map<string, string>): ResumoTreino {
  const resumo: ResumoTreino = { tipo: "treino", certos: 0, errados: 0, brancos: 0, comDuvida: 0 };
  for (const r of respostas) {
    const res = resultadoDe(r.resposta, r.duvida, gabaritos.get(r.itemId) ?? "");
    if (res === "branco") resumo.brancos++;
    else if (res === "errado") resumo.errados++;
    else resumo.certos++;
    if (r.duvida) resumo.comDuvida++;
  }
  return resumo;
}

type ConfigCompleto = Extract<ConfigSessao, { tipo: "completo" }>;

// Corrige o simulado completo com as regras do edital (np = 0). Item sem resposta conta como branco.
export function resultadoCompleto(
  estrutura: EstruturaCargo,
  config: ConfigCompleto,
  gabaritos: Map<string, string>,
  respostas: RespostaGravada[],
): ResultadoCompleto {
  const porItem = new Map(respostas.map((r) => [r.itemId, r]));
  const marcada = (id: string) => porItem.get(id) ?? { itemId: id, resposta: "branco" as const, duvida: false };

  const entradas: EntradaProva[] = config.provas.map((p) => {
    const prova = estrutura.provas.find((x) => x.slug === p.slug);
    if (!prova) throw new Error(`Prova ${p.slug} não pertence ao cargo`);
    return {
      slug: p.slug,
      regra: prova.regra,
      corte: prova.corte,
      respostas: p.itens.map((id) => ({ marcacao: marcacaoParaCore(marcada(id).resposta), gabarito: gabaritos.get(id) ?? "" })),
    };
  });
  const conjunto =
    estrutura.corteConjunto && estrutura.corteConjunto.provas.every((s) => config.provas.some((p) => p.slug === s))
      ? estrutura.corteConjunto.corte
      : undefined;
  const r = calcularResultado(entradas, conjunto);

  const porDisciplina = new Map<string, { certos: number; errados: number; brancos: number }>();
  const comDuvida = [];
  for (const p of config.provas) {
    for (const id of p.itens) {
      const disciplina = config.disciplinaDoItem[id] ?? "outras";
      const m = marcada(id);
      const gabarito = gabaritos.get(id) ?? "";
      const s = situacao({ marcacao: marcacaoParaCore(m.resposta), gabarito });
      const acc = porDisciplina.get(disciplina) ?? { certos: 0, errados: 0, brancos: 0 };
      acc[s === "certo" ? "certos" : s === "errado" ? "errados" : "brancos"]++;
      porDisciplina.set(disciplina, acc);
      comDuvida.push({ disciplina, duvida: m.duvida, marcacao: marcacaoParaCore(m.resposta), gabarito });
    }
  }
  const nome = (d: string) => estrutura.disciplinas[d] ?? d;

  return {
    tipo: "completo",
    provas: r.provas.map((p) => {
      const prova = estrutura.provas.find((x) => x.slug === p.slug)!;
      return { ...p, nome: prova.nome, nItens: config.provas.find((x) => x.slug === p.slug)!.itens.length };
    }),
    total: r.total,
    corteConjunto: r.corteConjunto,
    aprovado: r.aprovado,
    motivos: r.motivos,
    porDisciplina: [...porDisciplina.entries()].map(([disciplina, c]) => ({ disciplina, nome: nome(disciplina), ...c })),
    duvidas: analisarDuvidas(comDuvida).map((a) => ({ ...a, nome: nome(a.disciplina) })),
  };
}
```

`src/estudo/servico.ts`:

```ts
import {
  calcularPrioridades,
  montarEstudarAgora,
  montarSimuladoProva,
  montarTreinoTopico,
  proximoEstadoRevisao,
  topicosQuePrecisamGeracao,
} from "@/core";
import { resultadoCompleto, resultadoDe, resumoTreino } from "./resultado";
import type { ConfigSessao, Marcacao, RepositorioEstudo, ResultadoResposta, ResultadoSessao, Sessao } from "./tipos";

// A prova discursiva ainda não é simulada: o simulado completo usa só as objetivas
// (4h30 menos 1h no CBM-AL, como a opção "só objetivas" da spec).
export const DURACAO_DISCURSIVA_MIN = 60;
// Tolerância para respostas que chegam logo depois do fim do tempo (latência da rede).
export const TOLERANCIA_ENTREGA_MS = 60_000;
export const MAX_ITENS_REVISAO = 30;

export class ErroEstudo extends Error {
  constructor(
    readonly codigo: "sessao_inexistente" | "sessao_encerrada" | "item_fora_da_sessao" | "modo_invalido" | "tempo_esgotado",
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroEstudo";
  }
}

export type InicioSessao =
  | { tipo: "criada"; sessaoId: string; pedidosGeracao: number }
  | { tipo: "sem_itens"; pedidosGeracao: number };

async function pedirSemFalhar(repo: RepositorioEstudo, concurso: string, canonicos: string[]): Promise<number> {
  if (canonicos.length === 0) return 0;
  try {
    return await repo.pedirGeracao(concurso, canonicos);
  } catch {
    // A geração é melhor-esforço; o estudo nunca depende dela.
    return 0;
  }
}

export async function iniciarEstudarAgora(repo: RepositorioEstudo, cargoId: string, agora: Date): Promise<InicioSessao> {
  const [estrutura, candidatos, historico, vencidas] = await Promise.all([
    repo.estrutura(cargoId),
    repo.candidatos(cargoId),
    repo.historico(cargoId),
    repo.revisoesVencidas(agora),
  ]);
  const prioridades = calcularPrioridades(estrutura.topicosAlvo, historico, agora);
  const pedidosGeracao = await pedirSemFalhar(
    repo,
    estrutura.concurso.slug,
    topicosQuePrecisamGeracao(prioridades, candidatos),
  );
  const itens = montarEstudarAgora({ prioridades, itens: candidatos, revisaoVencida: vencidas });
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao };
  const sessaoId = await repo.criarSessao(cargoId, "treino", { tipo: "estudar_agora" }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao };
}

export async function iniciarTreinoTopico(
  repo: RepositorioEstudo,
  cargoId: string,
  canonicos: string[],
  total: number,
): Promise<InicioSessao> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const itens = montarTreinoTopico({ canonicos, itens: candidatos, total });
  const faltando = canonicos.filter((c) => candidatos.filter((i) => !i.visto && i.canonicos.includes(c)).length < total);
  const pedidosGeracao = await pedirSemFalhar(repo, estrutura.concurso.slug, faltando);
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao };
  const sessaoId = await repo.criarSessao(cargoId, "treino", { tipo: "topico", canonicos }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao };
}

export async function iniciarRevisao(repo: RepositorioEstudo, cargoId: string, agora: Date): Promise<InicioSessao> {
  const [candidatos, vencidas] = await Promise.all([repo.candidatos(cargoId), repo.revisoesVencidas(agora)]);
  const doCargo = new Set(candidatos.map((c) => c.id));
  const itens = vencidas.filter((id) => doCargo.has(id)).slice(0, MAX_ITENS_REVISAO);
  if (itens.length === 0) return { tipo: "sem_itens", pedidosGeracao: 0 };
  const sessaoId = await repo.criarSessao(cargoId, "revisao", { tipo: "revisao" }, itens);
  return { tipo: "criada", sessaoId, pedidosGeracao: 0 };
}

export interface Faltante {
  prova: string;
  disciplina: string;
  nome: string;
  faltam: number;
  canonicos: string[];
}

export type InicioSimulado = { tipo: "criada"; sessaoId: string } | { tipo: "faltam_itens"; faltantes: Faltante[] };

export interface PreviaSimulado {
  config: Extract<ConfigSessao, { tipo: "completo" }>;
  faltantes: Faltante[];
}

// Sem viés adaptativo: segue a distribuição do edital, priorizando itens não vistos.
export async function previaSimulado(repo: RepositorioEstudo, cargoId: string): Promise<PreviaSimulado> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const usados = new Set<string>();
  const provas: { slug: string; itens: string[] }[] = [];
  const disciplinaDoItem: Record<string, string> = {};
  const faltantes: Faltante[] = [];
  for (const prova of estrutura.provas) {
    const m = montarSimuladoProva(prova.demandas, candidatos, usados);
    for (const id of m.itens) usados.add(id);
    Object.assign(disciplinaDoItem, m.disciplinaDoItem);
    provas.push({ slug: prova.slug, itens: m.itens });
    for (const f of m.faltantes) {
      faltantes.push({
        prova: prova.slug,
        disciplina: f.disciplina,
        nome: estrutura.disciplinas[f.disciplina] ?? f.disciplina,
        faltam: f.faltam,
        canonicos: prova.demandas.find((d) => d.disciplina === f.disciplina)?.canonicos ?? [],
      });
    }
  }
  const duracaoMin = estrutura.cargo.duracaoMin - (estrutura.temDiscursiva ? DURACAO_DISCURSIVA_MIN : 0);
  return { config: { tipo: "completo", duracaoMin, provas, disciplinaDoItem }, faltantes };
}

export async function iniciarSimulado(repo: RepositorioEstudo, cargoId: string): Promise<InicioSimulado> {
  const { config, faltantes } = await previaSimulado(repo, cargoId);
  if (faltantes.length > 0) return { tipo: "faltam_itens", faltantes };
  const sessaoId = await repo.criarSessao(cargoId, "completo", config, config.provas.flatMap((p) => p.itens));
  return { tipo: "criada", sessaoId };
}

// Os tópicos da disciplina com menos itens não vistos vão primeiro para a fila de geração.
export async function pedirGeracaoDosFaltantes(
  repo: RepositorioEstudo,
  cargoId: string,
  canonicos: string[],
): Promise<number> {
  const [estrutura, candidatos] = await Promise.all([repo.estrutura(cargoId), repo.candidatos(cargoId)]);
  const naoVistos = (c: string) => candidatos.filter((i) => !i.visto && i.canonicos.includes(c)).length;
  const ordem = [...new Set(canonicos)].sort((a, b) => naoVistos(a) - naoVistos(b) || a.localeCompare(b));
  return repo.pedirGeracao(estrutura.concurso.slug, ordem);
}

async function sessaoAberta(repo: RepositorioEstudo, sessaoId: string, itemId?: string): Promise<Sessao> {
  const s = await repo.sessao(sessaoId);
  if (!s) throw new ErroEstudo("sessao_inexistente", "Sessão não encontrada.");
  if (s.finalizadaEm) throw new ErroEstudo("sessao_encerrada", "Esta sessão já foi encerrada.");
  if (itemId && !s.itens.includes(itemId)) throw new ErroEstudo("item_fora_da_sessao", "Item não pertence à sessão.");
  return s;
}

export interface Correcao {
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
  resultado: ResultadoResposta;
  concluida: boolean;
}

async function atualizarRevisao(repo: RepositorioEstudo, itemId: string, resultado: ResultadoResposta, agora: Date) {
  const atual = (await repo.estadosRevisao([itemId])).get(itemId) ?? null;
  await repo.salvarRevisao(itemId, proximoEstadoRevisao(atual, resultado, agora));
}

// Treino e revisão: grava a resposta, devolve a correção e atualiza a repetição espaçada.
// Uma resposta já gravada não muda (o gabarito já foi mostrado).
export async function responderItem(
  repo: RepositorioEstudo,
  p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean; tempoMs: number | null; agora: Date },
): Promise<Correcao> {
  const s = await sessaoAberta(repo, p.sessaoId, p.itemId);
  if (s.modo === "completo") throw new ErroEstudo("modo_invalido", "No simulado completo a correção sai no final.");

  const nova = await repo.gravarResposta(
    p.sessaoId,
    { itemId: p.itemId, resposta: p.resposta, duvida: p.duvida, tempoMs: p.tempoMs },
    false,
  );
  const respostas = await repo.respostas(p.sessaoId);
  const gravada = respostas.find((r) => r.itemId === p.itemId)!;
  const [item] = await repo.itensCorrecao([p.itemId]);
  const resultado = resultadoDe(gravada.resposta, gravada.duvida, item.gabarito);
  if (nova) await atualizarRevisao(repo, p.itemId, resultado, p.agora);

  const concluida = s.itens.every((id) => respostas.some((r) => r.itemId === id));
  if (concluida) {
    const gabaritos = new Map((await repo.itensCorrecao(s.itens)).map((i) => [i.id, i.gabarito]));
    await repo.finalizar(p.sessaoId, resumoTreino(respostas, gabaritos), p.agora);
  }
  return {
    itemId: p.itemId,
    resposta: gravada.resposta,
    duvida: gravada.duvida,
    gabarito: item.gabarito,
    justificativa: item.justificativa,
    citacao: item.citacao,
    fonte: item.fonte,
    resultado,
    concluida,
  };
}

// Encerra um treino antes do fim (itens não respondidos ficam de fora do resumo).
export async function encerrarTreino(repo: RepositorioEstudo, sessaoId: string, agora: Date): Promise<void> {
  const s = await sessaoAberta(repo, sessaoId);
  if (s.modo === "completo") throw new ErroEstudo("modo_invalido", "Use a entrega do simulado.");
  const respostas = await repo.respostas(sessaoId);
  const gabaritos = new Map((await repo.itensCorrecao(respostas.map((r) => r.itemId))).map((i) => [i.id, i.gabarito]));
  await repo.finalizar(sessaoId, resumoTreino(respostas, gabaritos), agora);
}

export function prazoDoSimulado(s: Sessao): Date | null {
  if (s.config.tipo !== "completo") return null;
  return new Date(s.iniciadaEm.getTime() + s.config.duracaoMin * 60_000);
}

// Simulado completo: grava (ou troca) a marcação, sem correção, enquanto houver tempo.
export async function marcarNoSimulado(
  repo: RepositorioEstudo,
  p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean; agora: Date },
): Promise<void> {
  const s = await sessaoAberta(repo, p.sessaoId, p.itemId);
  const prazo = prazoDoSimulado(s);
  if (!prazo) throw new ErroEstudo("modo_invalido", "Esta sessão não é um simulado completo.");
  if (p.agora.getTime() > prazo.getTime() + TOLERANCIA_ENTREGA_MS) {
    throw new ErroEstudo("tempo_esgotado", "O tempo do simulado acabou.");
  }
  await repo.gravarResposta(p.sessaoId, { itemId: p.itemId, resposta: p.resposta, duvida: p.duvida, tempoMs: null }, true);
}

// Corrige, guarda o resultado e põe na repetição espaçada os itens errados ou em branco.
// Entregar de novo um simulado já entregue não faz nada.
export async function entregarSimulado(repo: RepositorioEstudo, sessaoId: string, agora: Date): Promise<ResultadoSessao> {
  const s = await repo.sessao(sessaoId);
  if (!s) throw new ErroEstudo("sessao_inexistente", "Sessão não encontrada.");
  if (s.config.tipo !== "completo") throw new ErroEstudo("modo_invalido", "Esta sessão não é um simulado completo.");
  const [estrutura, itens, respostas] = await Promise.all([
    repo.estrutura(s.cargoId),
    repo.itensCorrecao(s.itens),
    repo.respostas(sessaoId),
  ]);
  const gabaritos = new Map(itens.map((i) => [i.id, i.gabarito]));
  const resultado = resultadoCompleto(estrutura, s.config, gabaritos, respostas);
  if (s.finalizadaEm) return resultado;

  const porItem = new Map(respostas.map((r) => [r.itemId, r]));
  const estados = await repo.estadosRevisao(s.itens);
  for (const id of s.itens) {
    const r = porItem.get(id);
    const res = r ? resultadoDe(r.resposta, r.duvida, gabaritos.get(id) ?? "") : "branco";
    const proximo = proximoEstadoRevisao(estados.get(id) ?? null, res, agora);
    if (proximo || estados.has(id)) await repo.salvarRevisao(id, proximo);
  }
  await repo.finalizar(sessaoId, resultado, agora);
  return resultado;
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/estudo && npm run typecheck`
Expected: PASS (18 testes em `src/estudo`); typecheck limpo.

```bash
git add src/estudo
git commit -m "feat(estudo): sessões de treino, revisão e simulado completo com correção e revisão espaçada"
```

---

### Task 6: Painel, formatos e moderação (puros)

**Files:**
- Create: `src/estudo/painel.ts`, `src/lib/formato.ts`, `src/lib/auth/moderacao.ts`, `src/lib/modos.ts`
- Test: `src/estudo/painel.test.ts`, `src/lib/formato.test.ts`, `src/lib/auth/moderacao.test.ts`

**Interfaces:**
- Produces:
  ```ts
  tendenciaSemanal(respostas, agora, semanas = 4): (number | null)[]
  tabelaDesempenho(topicosAlvo, prioridades, historico, agora): LinhaDisciplina[]   // ordem do edital
  diasAte(dataProva: "AAAA-MM-DD", agora): number                                    // fuso de Brasília
  nota, percentual, aproveitamento, data, dataEHora, dataDaProva, duracao, plural      // pt-BR
  ehModerador(email, env = process.env): boolean   // MODERADORES_EMAILS ?? AUTH_EMAILS_PERMITIDOS
  nomeDaSessao(config), rotaDaSessao(id, config)
  ```

- [ ] **Step 1: Escrever os testes**

`src/estudo/painel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularPrioridades, type RespostaHistorico, type TopicoAlvo } from "@/core";
import { diasAte, tabelaDesempenho, tendenciaSemanal } from "./painel";

const AGORA = new Date("2026-10-15T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000);
const r = (canonico: string, resultado: RespostaHistorico["resultado"], dias: number): RespostaHistorico => ({
  canonico, resultado, respondidaEm: diasAtras(dias),
});

describe("tendenciaSemanal", () => {
  it("dá o aproveitamento de cada semana, da mais antiga para a atual", () => {
    const rs = [r("a", "certo", 1), r("a", "errado", 2), r("a", "certo", 9), r("a", "branco", 25)];
    expect(tendenciaSemanal(rs, AGORA)).toEqual([0, null, 1, 0]);
  });
});

describe("tabelaDesempenho", () => {
  const topicos: TopicoAlvo[] = [
    { disciplina: "lp", codigo: "1", titulo: "Crase", canonico: "lp/crase", chave: "lp:1", peso: 1 },
    { disciplina: "lp", codigo: "2", titulo: "Regência", canonico: "lp/regencia", chave: "lp:2", peso: 1 },
    { disciplina: "mat", codigo: "1", titulo: "Frações", canonico: "mat/fracoes", chave: "mat:1", peso: 1 },
  ];

  it("agrupa por disciplina na ordem do edital com brancos e tendência", () => {
    const historico = [r("lp/regencia", "errado", 1), r("lp/regencia", "branco", 2), r("lp/crase", "certo", 3)];
    const prioridades = calcularPrioridades(topicos, historico, AGORA);
    const t = tabelaDesempenho(topicos, prioridades, historico, AGORA);
    expect(t.map((d) => d.disciplina)).toEqual(["lp", "mat"]);
    expect(t[0].topicos.map((x) => x.codigo)).toEqual(["1", "2"]);
    expect(t[0]).toMatchObject({ n: 3, aproveitamento: 0, taxaBrancos: 1 / 3 });
    expect(t[0].topicos[1]).toMatchObject({ n: 2, taxaBrancos: 0.5, tendencia: [null, null, null, -0.5] });
    expect(t[1].topicos[0]).toMatchObject({ n: 0, taxaBrancos: 0, tendencia: [null, null, null, null] });
  });
});

describe("diasAte", () => {
  it("conta os dias até a prova no horário de Brasília e nunca fica negativo", () => {
    expect(diasAte("2026-10-20", AGORA)).toBe(5);
    expect(diasAte("2026-01-01", AGORA)).toBe(0);
  });
});
```

`src/lib/formato.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aproveitamento, data, dataDaProva, duracao, nota, percentual, plural } from "./formato";

describe("formato", () => {
  it("formata números no padrão brasileiro", () => {
    expect(nota(21.5)).toBe("21,5");
    expect(nota(-3)).toBe("-3");
    expect(percentual(0.256)).toBe("26%");
    expect(aproveitamento(0.5)).toBe("+50%");
    expect(aproveitamento(-0.25)).toBe("-25%");
  });

  it("formata datas no fuso de Brasília", () => {
    expect(data("2026-10-15T01:00:00Z")).toMatch(/14/);
    expect(dataDaProva("2027-01-24")).toBe("24 de janeiro de 2027");
  });

  it("formata o cronômetro e plurais", () => {
    expect(duracao(3 * 3600_000 + 5 * 60_000 + 9_000)).toBe("3:05:09");
    expect(duracao(65_000)).toBe("01:05");
    expect(duracao(-5)).toBe("00:00");
    expect(plural(1, "item", "itens")).toBe("1 item");
    expect(plural(3, "item", "itens")).toBe("3 itens");
  });
});
```

`src/lib/auth/moderacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ehModerador } from "./moderacao";

describe("ehModerador", () => {
  it("usa MODERADORES_EMAILS quando existe e a lista de acesso como reserva", () => {
    expect(ehModerador("a@x.com", { MODERADORES_EMAILS: "a@x.com", AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(true);
    expect(ehModerador("b@x.com", { MODERADORES_EMAILS: "a@x.com", AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(false);
    expect(ehModerador("B@x.com", { AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(true);
    expect(ehModerador(null, { AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/estudo/painel.test.ts src/lib`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implementar**

`src/estudo/painel.ts`:

```ts
import { VALOR_RESULTADO, type PrioridadeTopico, type RespostaHistorico, type TopicoAlvo } from "@/core";

const DIA_MS = 86_400_000;
const SEMANA_MS = 7 * DIA_MS;

export interface LinhaTopicoPainel {
  disciplina: string;
  codigo: string;
  titulo: string;
  canonico: string;
  n: number;
  aproveitamento: number;
  taxaBrancos: number;
  // Aproveitamento líquido de cada uma das últimas 4 semanas, da mais antiga para a atual (null = sem respostas).
  tendencia: (number | null)[];
  prioridade: number;
}

export interface LinhaDisciplina {
  disciplina: string;
  n: number;
  aproveitamento: number;
  taxaBrancos: number;
  topicos: LinhaTopicoPainel[];
}

function media(valores: number[]): number {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

export function tendenciaSemanal(respostas: RespostaHistorico[], agora: Date, semanas = 4): (number | null)[] {
  return Array.from({ length: semanas }, (_, i) => {
    const fim = agora.getTime() - (semanas - 1 - i) * SEMANA_MS;
    const doPeriodo = respostas.filter((r) => r.respondidaEm.getTime() > fim - SEMANA_MS && r.respondidaEm.getTime() <= fim);
    return doPeriodo.length ? media(doPeriodo.map((r) => VALOR_RESULTADO[r.resultado])) : null;
  });
}

// Tabela do painel: tópicos na ordem do edital, agrupados por disciplina. O aproveitamento
// e a prioridade vêm do motor de foco; brancos e tendência são calculados aqui.
export function tabelaDesempenho(
  topicosAlvo: TopicoAlvo[],
  prioridades: PrioridadeTopico[],
  historico: RespostaHistorico[],
  agora: Date,
): LinhaDisciplina[] {
  const porCanonico = new Map<string, RespostaHistorico[]>();
  for (const r of historico) porCanonico.set(r.canonico, [...(porCanonico.get(r.canonico) ?? []), r]);

  const posicao = new Map(topicosAlvo.map((t, i) => [t.chave, i]));
  const ordenadas = [...prioridades].sort((a, b) => (posicao.get(a.chave) ?? 0) - (posicao.get(b.chave) ?? 0));
  const disciplinas = new Map<string, LinhaTopicoPainel[]>();
  for (const p of ordenadas) {
    const rs = porCanonico.get(p.canonico) ?? [];
    const linha: LinhaTopicoPainel = {
      disciplina: p.disciplina,
      codigo: p.codigo,
      titulo: p.titulo,
      canonico: p.canonico,
      n: p.n,
      aproveitamento: p.aproveitamento,
      taxaBrancos: rs.length ? rs.filter((r) => r.resultado === "branco").length / rs.length : 0,
      tendencia: tendenciaSemanal(rs, agora),
      prioridade: p.prioridade,
    };
    disciplinas.set(p.disciplina, [...(disciplinas.get(p.disciplina) ?? []), linha]);
  }

  return [...disciplinas.entries()].map(([disciplina, topicos]) => {
    const canonicos = new Set(topicos.map((t) => t.canonico));
    const rs = historico.filter((r) => canonicos.has(r.canonico));
    return {
      disciplina,
      n: rs.length,
      aproveitamento: media(rs.map((r) => VALOR_RESULTADO[r.resultado])),
      taxaBrancos: rs.length ? rs.filter((r) => r.resultado === "branco").length / rs.length : 0,
      topicos,
    };
  });
}

export function diasAte(dataProva: string, agora: Date): number {
  const prova = new Date(`${dataProva}T00:00:00-03:00`).getTime();
  return Math.max(0, Math.ceil((prova - agora.getTime()) / DIA_MS));
}
```

`src/lib/formato.ts`:

```ts
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const porcento = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" });
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
});

export function nota(n: number): string {
  return numero.format(n);
}

export function percentual(fracao: number): string {
  return porcento.format(fracao);
}

// Aproveitamento líquido (−1 a 1) mostrado de −100% a 100%.
export function aproveitamento(l: number): string {
  return l > 0 ? `+${porcento.format(l)}` : porcento.format(l);
}

export function data(iso: string | Date): string {
  return dataCurta.format(new Date(iso));
}

export function dataEHora(iso: string | Date): string {
  return dataHora.format(new Date(iso));
}

export function dataDaProva(aaaaMmDd: string): string {
  return new Date(`${aaaaMmDd}T12:00:00-03:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

export function duracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dois = (x: number) => String(x).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}
```

`src/lib/auth/moderacao.ts`:

```ts
import { emailPermitido } from "./rotas";

// Quem pode aprovar ou descartar itens e ver custos de IA. Sem MODERADORES_EMAILS, vale a lista de acesso.
export function ehModerador(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false;
  return emailPermitido(email, env.MODERADORES_EMAILS ?? env.AUTH_EMAILS_PERMITIDOS);
}
```

`src/lib/modos.ts`:

```ts
import type { ConfigSessao } from "@/estudo/tipos";

export function nomeDaSessao(config: ConfigSessao): string {
  switch (config.tipo) {
    case "estudar_agora":
      return "Estudar agora";
    case "topico":
      return config.canonicos.length === 1 ? "Treino de tópico" : `Treino de ${config.canonicos.length} tópicos`;
    case "revisao":
      return "Revisão de erros";
    case "completo":
      return "Simulado completo";
  }
}

export function rotaDaSessao(id: string, config: ConfigSessao): string {
  return config.tipo === "completo" ? `/simulado/${id}` : `/sessao/${id}`;
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/estudo/painel.ts src/estudo/painel.test.ts src/lib
git commit -m "feat(estudo): cálculos do painel, formatos pt-BR e regra de moderador"
```

---

### Task 7: Repositórios Supabase

**Files:**
- Create: `src/db/repositorios/estudo.ts`, `src/db/repositorios/moderacao.ts`
- Test: `src/db/repositorios/moderacao.test.ts`

**Interfaces:**
- Consumes: as funções SQL da Task 1 e os tipos da Task 2; `RepositorioEstudo` da Task 5.
- Produces:
  ```ts
  type Cliente = SupabaseClient<Database>
  carregarEstrutura(db, cargoId): Promise<EstruturaCargo>
  criarRepositorioEstudo(db): RepositorioEstudo          // memoriza a estrutura por instância
  listarCargos(db), listarSessoes(db, cargoId, { abertas?, modo?, limite? }): Promise<SessaoResumo[]>
  contarRevisoesVencidas(db, agora), contarFilaItens(db)
  itensDaSessao(db, sessaoId, podeVerCorrecao: (respondido: boolean) => boolean): Promise<ItemDaSessao[]>
  marcarSuspeito(db, itemId, motivo), resultadoGuardado(db, sessaoId), filaRevisaoItens(db, limite = 50)
  // chave secreta:
  alteracaoDeModeracao(item, decisao: "aprovar" | "descartar" | "inverter", por, agora)
  moderarItem(db, itemId, decisao, por), custoIaDoMes(db, agora), situacaoDaFila(db), inicioDoMes(agora)
  ```

Notas para quem implementa:
- `gravarResposta` usa `upsert` com `ignoreDuplicates: !substituir` e `.select("id")`: a lista volta vazia quando a resposta já existia e não foi trocada.
- `salvarRevisao(itemId, null)` apaga a linha; o RLS limita ao próprio usuário.
- `finalizar` só atualiza sessão ainda aberta (`.is("finalizado_em", null)`), então entregar duas vezes não sobrescreve o resultado.
- `moderarItem` só decide item em `revisao` ou `suspeito` e atualiza com `.eq("status", statusLido)` para não atropelar outra decisão.

- [ ] **Step 1: Escrever o teste da moderação**

`src/db/repositorios/moderacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alteracaoDeModeracao, inicioDoMes } from "./moderacao";

const AGORA = new Date("2026-10-15T12:00:00Z");
const item = {
  status: "revisao",
  formato: "certo_errado",
  gabarito: "C",
  justificativa: "do gerador",
  validacao: { concordancia: false, justificativa_validador: "do validador" },
};

describe("alteracaoDeModeracao", () => {
  it("aprova ou descarta guardando quem decidiu", () => {
    expect(alteracaoDeModeracao(item, "aprovar", "a@x.com", AGORA)).toMatchObject({
      status: "aprovado",
      validacao: { concordancia: false, moderacao: { decisao: "aprovar", por: "a@x.com", status_anterior: "revisao" } },
    });
    expect(alteracaoDeModeracao(item, "descartar", "a@x.com", AGORA)).toMatchObject({ status: "descartado" });
  });

  it("inverte o gabarito e adota a justificativa do validador", () => {
    expect(alteracaoDeModeracao(item, "inverter", "a@x.com", AGORA)).toMatchObject({
      status: "aprovado",
      gabarito: "E",
      justificativa: "do validador",
      validacao: { moderacao: { gabarito_anterior: "C" } },
    });
  });

  it("ignora itens que já saíram da fila", () => {
    expect(alteracaoDeModeracao({ ...item, status: "aprovado" }, "descartar", "a@x.com", AGORA)).toBeNull();
  });
});

describe("inicioDoMes", () => {
  it("volta ao primeiro dia do mês em UTC", () => {
    expect(inicioDoMes(AGORA).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/db/repositorios`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar**

`src/db/repositorios/estudo.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { montarEstruturaCargo, type EstruturaCargo, type LinhaCargo } from "@/estudo/estrutura";
import type { ConfigSessao, Marcacao, ModoSessao, RepositorioEstudo, ResultadoSessao } from "@/estudo/tipos";
import type { Database, Json } from "../types";

export type Cliente = SupabaseClient<Database>;

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

const candidatosSchema = z.array(
  z.object({ id: z.string(), textoBaseId: z.string().nullable(), canonicos: z.array(z.string()), visto: z.boolean() }),
);
const historicoSchema = z.array(
  z.object({
    canonico: z.string(),
    resultado: z.enum(["certo", "certo_duvida", "errado", "branco"]),
    respondidaEm: z.string(),
  }),
);
export const configSessaoSchema: z.ZodType<ConfigSessao> = z.union([
  z.object({ tipo: z.literal("estudar_agora") }),
  z.object({ tipo: z.literal("topico"), canonicos: z.array(z.string()) }),
  z.object({ tipo: z.literal("revisao") }),
  z.object({
    tipo: z.literal("completo"),
    duracaoMin: z.number(),
    provas: z.array(z.object({ slug: z.string(), itens: z.array(z.string()) })),
    disciplinaDoItem: z.record(z.string(), z.string()),
  }),
]);

const SELECT_ESTRUTURA = `id, slug, nome, duracao_min, corte_conjunto,
  concursos!inner(id, slug, nome, data_prova),
  cargo_provas(ordem, provas!inner(id, slug, nome, tipo, n_itens, regra_pontuacao, regra_corte, distribuicao,
    prova_disciplinas(ordem, disciplinas!inner(slug, nome,
      topicos(id, codigo, titulo, parent_id, ordem, topicos_canonicos(slug))))))`;

export async function carregarEstrutura(db: Cliente, cargoId: string): Promise<EstruturaCargo> {
  const { data, error } = await db.from("cargos").select(SELECT_ESTRUTURA).eq("id", cargoId).single();
  if (error) falhou(`cargo ${cargoId}`, error);
  return montarEstruturaCargo(data as unknown as LinhaCargo);
}

// Implementação com o cliente do usuário: o RLS garante que cada um só vê e grava o que é seu.
export function criarRepositorioEstudo(db: Cliente): RepositorioEstudo {
  const estruturas = new Map<string, Promise<EstruturaCargo>>();

  return {
    estrutura(cargoId) {
      if (!estruturas.has(cargoId)) estruturas.set(cargoId, carregarEstrutura(db, cargoId));
      return estruturas.get(cargoId)!;
    },

    async candidatos(cargoId) {
      const { data, error } = await db.rpc("estudo_candidatos", { p_cargo: cargoId });
      if (error) falhou("candidatos", error);
      return candidatosSchema.parse(data);
    },

    async historico(cargoId) {
      const { data, error } = await db.rpc("estudo_historico", { p_cargo: cargoId });
      if (error) falhou("histórico", error);
      return historicoSchema.parse(data).map((r) => ({ ...r, respondidaEm: new Date(r.respondidaEm) }));
    },

    async revisoesVencidas(agora) {
      const { data, error } = await db
        .from("revisao_espacada")
        .select("item_id")
        .lte("proxima_em", agora.toISOString())
        .order("proxima_em")
        .limit(500);
      if (error) falhou("revisões vencidas", error);
      return data.map((r) => r.item_id);
    },

    async criarSessao(cargoId, modo, config, itens) {
      const { data, error } = await db.rpc("simulado_criar", {
        p_cargo: cargoId,
        p_modo: modo,
        p_config: config as unknown as Json,
        p_itens: itens,
      });
      if (error) falhou("criar sessão", error);
      return data;
    },

    async pedirGeracao(concurso, canonicos) {
      const { data, error } = await db.rpc("estudo_pedir_geracao", { p_concurso: concurso, p_canonicos: canonicos });
      if (error) falhou("pedir geração", error);
      return data;
    },

    async sessao(id) {
      const { data, error } = await db
        .from("simulados")
        .select("id, cargo_id, modo, config, iniciado_em, finalizado_em, simulado_itens(item_id, ordem)")
        .eq("id", id)
        .maybeSingle();
      if (error) falhou("sessão", error);
      if (!data) return null;
      return {
        id: data.id,
        cargoId: data.cargo_id,
        modo: data.modo as ModoSessao,
        config: configSessaoSchema.parse(data.config),
        iniciadaEm: new Date(data.iniciado_em),
        finalizadaEm: data.finalizado_em ? new Date(data.finalizado_em) : null,
        itens: [...data.simulado_itens].sort((a, b) => a.ordem - b.ordem).map((i) => i.item_id),
      };
    },

    async itensCorrecao(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await db.from("itens").select("id, gabarito, justificativa, citacao, fontes(titulo)").in("id", ids);
      if (error) falhou("itens", error);
      return data.map((i) => ({
        id: i.id,
        gabarito: i.gabarito,
        justificativa: i.justificativa,
        citacao: i.citacao,
        fonte: i.fontes?.titulo ?? null,
      }));
    },

    async respostas(sessaoId) {
      const { data, error } = await db.from("respostas").select("item_id, resposta, duvida").eq("simulado_id", sessaoId);
      if (error) falhou("respostas", error);
      return data.map((r) => ({ itemId: r.item_id, resposta: r.resposta as Marcacao, duvida: r.duvida }));
    },

    async gravarResposta(sessaoId, r, substituir) {
      const { data, error } = await db
        .from("respostas")
        .upsert(
          {
            simulado_id: sessaoId,
            item_id: r.itemId,
            resposta: r.resposta,
            duvida: r.duvida,
            tempo_ms: r.tempoMs,
            respondida_em: new Date().toISOString(),
          },
          { onConflict: "simulado_id,item_id", ignoreDuplicates: !substituir },
        )
        .select("id");
      if (error) falhou("gravar resposta", error);
      return data.length > 0;
    },

    async estadosRevisao(ids) {
      if (ids.length === 0) return new Map();
      const { data, error } = await db.from("revisao_espacada").select("item_id, etapa, proxima_em").in("item_id", ids);
      if (error) falhou("revisão espaçada", error);
      return new Map(data.map((r) => [r.item_id, { etapa: r.etapa, proximaEm: new Date(r.proxima_em) }]));
    },

    async salvarRevisao(itemId, estado) {
      const { error } = estado
        ? await db
            .from("revisao_espacada")
            .upsert({ item_id: itemId, etapa: estado.etapa, proxima_em: estado.proximaEm.toISOString() }, { onConflict: "user_id,item_id" })
        : await db.from("revisao_espacada").delete().eq("item_id", itemId);
      if (error) falhou("salvar revisão", error);
    },

    async finalizar(sessaoId, resultado: ResultadoSessao, agora) {
      const { error } = await db
        .from("simulados")
        .update({ finalizado_em: agora.toISOString(), resultado: resultado as unknown as Json })
        .eq("id", sessaoId)
        .is("finalizado_em", null);
      if (error) falhou("finalizar sessão", error);
    },
  };
}

// ---- Leituras das telas ----

export async function listarCargos(db: Cliente) {
  const { data, error } = await db
    .from("cargos")
    .select("id, slug, nome, concursos!inner(slug, nome, data_prova)")
    .order("nome");
  if (error) falhou("cargos", error);
  return data.map((c) => ({
    id: c.id,
    nome: c.nome,
    concurso: c.concursos.nome,
    dataProva: c.concursos.data_prova,
  }));
}

export interface SessaoResumo {
  id: string;
  modo: ModoSessao;
  config: ConfigSessao;
  iniciadaEm: string;
  finalizadaEm: string | null;
  total: number;
  respondidos: number;
  resultado: ResultadoSessao | null;
}

export async function listarSessoes(
  db: Cliente,
  cargoId: string,
  filtro: { abertas?: boolean; modo?: ModoSessao; limite?: number } = {},
): Promise<SessaoResumo[]> {
  let q = db
    .from("simulados")
    .select("id, modo, config, iniciado_em, finalizado_em, resultado, simulado_itens(count), respostas(count)")
    .eq("cargo_id", cargoId)
    .order("iniciado_em", { ascending: false })
    .limit(filtro.limite ?? 20);
  if (filtro.abertas !== undefined) q = filtro.abertas ? q.is("finalizado_em", null) : q.not("finalizado_em", "is", null);
  if (filtro.modo) q = q.eq("modo", filtro.modo);
  const { data, error } = await q;
  if (error) falhou("sessões", error);
  return data.map((s) => ({
    id: s.id,
    modo: s.modo as ModoSessao,
    config: configSessaoSchema.parse(s.config),
    iniciadaEm: s.iniciado_em,
    finalizadaEm: s.finalizado_em,
    total: s.simulado_itens[0]?.count ?? 0,
    respondidos: s.respostas[0]?.count ?? 0,
    resultado: (s.resultado as ResultadoSessao | null) ?? null,
  }));
}

export async function contarRevisoesVencidas(db: Cliente, agora: Date): Promise<number> {
  const { count, error } = await db
    .from("revisao_espacada")
    .select("item_id", { count: "exact", head: true })
    .lte("proxima_em", agora.toISOString());
  if (error) falhou("contar revisões", error);
  return count ?? 0;
}

export interface ItemDaSessao {
  id: string;
  ordem: number;
  enunciado: string;
  textoBase: string | null;
  topicos: string[];
  resposta: { resposta: Marcacao; duvida: boolean } | null;
  // Só vem preenchida quando a pessoa já pode ver: item respondido no treino ou simulado entregue.
  correcao: { gabarito: string; justificativa: string; citacao: string | null; fonte: string | null } | null;
}

// Itens para a tela da sessão. O gabarito nunca vai ao navegador antes da hora.
export async function itensDaSessao(db: Cliente, sessaoId: string, podeVerCorrecao: (respondido: boolean) => boolean) {
  const { data, error } = await db
    .from("simulado_itens")
    .select(
      "ordem, itens!inner(id, enunciado, gabarito, justificativa, citacao, fontes(titulo), textos_base(conteudo), item_topicos(topicos_canonicos(titulo)))",
    )
    .eq("simulado_id", sessaoId)
    .order("ordem");
  if (error) falhou("itens da sessão", error);
  const { data: respostas, error: e2 } = await db
    .from("respostas")
    .select("item_id, resposta, duvida")
    .eq("simulado_id", sessaoId);
  if (e2) falhou("respostas da sessão", e2);
  const porItem = new Map(respostas.map((r) => [r.item_id, { resposta: r.resposta as Marcacao, duvida: r.duvida }]));

  return data.map<ItemDaSessao>(({ ordem, itens: i }) => {
    const resposta = porItem.get(i.id) ?? null;
    return {
      id: i.id,
      ordem,
      enunciado: i.enunciado,
      textoBase: i.textos_base?.conteudo ?? null,
      topicos: i.item_topicos.map((t) => t.topicos_canonicos.titulo),
      resposta,
      correcao: podeVerCorrecao(resposta !== null)
        ? { gabarito: i.gabarito, justificativa: i.justificativa, citacao: i.citacao, fonte: i.fontes?.titulo ?? null }
        : null,
    };
  });
}

export async function marcarSuspeito(db: Cliente, itemId: string, motivo: string): Promise<void> {
  const { error } = await db.rpc("itens_marcar_suspeito", { p_item: itemId, p_motivo: motivo });
  if (error) falhou("marcar suspeito", error);
}

export interface ItemParaRevisar {
  id: string;
  status: "revisao" | "suspeito";
  enunciado: string;
  textoBase: string | null;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
  topicos: string[];
  validacao: Json;
  criadoEm: string;
}

export async function filaRevisaoItens(db: Cliente, limite = 50): Promise<ItemParaRevisar[]> {
  const { data, error } = await db
    .from("itens")
    .select(
      "id, status, enunciado, gabarito, justificativa, citacao, validacao, criado_em, fontes(titulo), textos_base(conteudo), item_topicos(topicos_canonicos(titulo))",
    )
    .in("status", ["suspeito", "revisao"])
    .order("status", { ascending: false })
    .order("criado_em")
    .limit(limite);
  if (error) falhou("fila de revisão", error);
  return data.map((i) => ({
    id: i.id,
    status: i.status as ItemParaRevisar["status"],
    enunciado: i.enunciado,
    textoBase: i.textos_base?.conteudo ?? null,
    gabarito: i.gabarito,
    justificativa: i.justificativa,
    citacao: i.citacao,
    fonte: i.fontes?.titulo ?? null,
    topicos: i.item_topicos.map((t) => t.topicos_canonicos.titulo),
    validacao: i.validacao,
    criadoEm: i.criado_em,
  }));
}

export async function resultadoGuardado(db: Cliente, sessaoId: string): Promise<ResultadoSessao | null> {
  const { data, error } = await db.from("simulados").select("resultado").eq("id", sessaoId).maybeSingle();
  if (error) falhou("resultado", error);
  return (data?.resultado as ResultadoSessao | null) ?? null;
}

export async function contarFilaItens(db: Cliente): Promise<number> {
  const { count, error } = await db
    .from("itens")
    .select("id", { count: "exact", head: true })
    .in("status", ["suspeito", "revisao"]);
  if (error) falhou("contar fila de itens", error);
  return count ?? 0;
}
```

`src/db/repositorios/moderacao.ts`:

```ts
import type { ClienteServico } from "../supabase/servico";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export type Decisao = "aprovar" | "descartar" | "inverter";

interface ItemModeravel {
  status: string;
  formato: string;
  gabarito: string;
  justificativa: string;
  validacao: unknown;
}

// Alteração a gravar no item. "inverter" aprova trocando Certo/Errado e, se houver, adota a
// justificativa do validador. Devolve null quando o item não está na fila (já decidido).
export function alteracaoDeModeracao(item: ItemModeravel, decisao: Decisao, por: string, agora: Date) {
  if (item.status !== "revisao" && item.status !== "suspeito") return null;
  if (decisao === "inverter" && item.formato !== "certo_errado") throw new Error("Só itens Certo/Errado podem ser invertidos");
  const validacao = (item.validacao ?? {}) as Record<string, unknown>;
  const em = agora.toISOString();
  const moderacao = { decisao, por, em, status_anterior: item.status, gabarito_anterior: item.gabarito };
  const base = { validacao: { ...validacao, moderacao }, atualizado_em: em };
  if (decisao === "descartar") return { ...base, status: "descartado" };
  if (decisao === "aprovar") return { ...base, status: "aprovado" };
  const justificativaValidador = validacao.justificativa_validador;
  return {
    ...base,
    status: "aprovado",
    gabarito: item.gabarito === "C" ? "E" : "C",
    justificativa: typeof justificativaValidador === "string" && justificativaValidador ? justificativaValidador : item.justificativa,
  };
}

export async function moderarItem(db: ClienteServico, itemId: string, decisao: Decisao, por: string): Promise<void> {
  const { data: item, error: e1 } = await db
    .from("itens")
    .select("status, formato, gabarito, justificativa, validacao")
    .eq("id", itemId)
    .single();
  if (e1) falhou("item", e1);
  const alteracao = alteracaoDeModeracao(item, decisao, por, new Date());
  if (!alteracao) return;
  const { error } = await db.from("itens").update(alteracao).eq("id", itemId).eq("status", item.status);
  if (error) falhou("moderar item", error);
}

export interface CustoFinalidade {
  finalidade: string;
  chamadas: number;
  custoUsd: number;
}

export function inicioDoMes(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

export async function custoIaDoMes(db: ClienteServico, agora: Date): Promise<CustoFinalidade[]> {
  const { data, error } = await db
    .from("ai_usage")
    .select("finalidade, custo_usd")
    .gte("criado_em", inicioDoMes(agora).toISOString())
    .limit(10_000);
  if (error) falhou("custo de IA", error);
  const porFinalidade = new Map<string, CustoFinalidade>();
  for (const u of data) {
    const acc = porFinalidade.get(u.finalidade) ?? { finalidade: u.finalidade, chamadas: 0, custoUsd: 0 };
    acc.chamadas++;
    acc.custoUsd += Number(u.custo_usd);
    porFinalidade.set(u.finalidade, acc);
  }
  return [...porFinalidade.values()].sort((a, b) => b.custoUsd - a.custoUsd);
}

export async function situacaoDaFila(db: ClienteServico) {
  const [abertos, falhas] = await Promise.all([
    db.from("jobs").select("id", { count: "exact", head: true }).in("status", ["pendente", "processando"]),
    db.from("jobs").select("id, payload, erro, atualizado_em").eq("status", "falhou").order("atualizado_em", { ascending: false }).limit(5),
  ]);
  if (abertos.error) falhou("jobs abertos", abertos.error);
  if (falhas.error) falhou("jobs com falha", falhas.error);
  return {
    abertos: abertos.count ?? 0,
    falhas: falhas.data.map((j) => ({
      id: j.id,
      canonico: String((j.payload as Record<string, unknown>).canonico ?? ""),
      erro: j.erro ?? "",
      em: j.atualizado_em,
    })),
  };
}
```

- [ ] **Step 4: Rodar, checar tipos e commit**

Run: `npx vitest run src/db/repositorios && npm run typecheck`
Expected: PASS; typecheck limpo (as consultas aninhadas tipam com os tipos gerados na Task 2).

```bash
git add src/db/repositorios
git commit -m "feat(db): repositório de estudo com Supabase e moderação de itens"
```

---

### Task 8: Base da interface e tela inicial

**Files:**
- Modify: `package.json` (dependência), `src/app/globals.css`
- Delete: `src/app/page.tsx` (vira `src/app/(app)/page.tsx`)
- Create: `src/components/ui.ts`, `src/components/nav-link.tsx`, `src/components/aviso.tsx`, `src/app/(app)/contexto.ts`, `src/app/(app)/acoes.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`

**Interfaces:**
- Produces:
  ```ts
  botao.{primario,secundario,texto,contorno}, cartao, pilula.{azul,neutra,alerta,erro}, titulo.{pagina,secao}, textoApoio
  contextoDoUsuario(): { db, user, cargos, cargo | null, moderador }   // React cache, uma vez por requisição
  exigirCargo(): idem com cargo garantido (senão redireciona para /?aviso=sem-concurso)
  COOKIE_CARGO = "cargo"
  // Server Actions (formulários):
  escolherCargo(fd), estudarAgora(), treinarTopicos(fd: canonico[], total), revisarErros(), comecarSimulado(), gerarFaltantes(fd: canonico[])
  <Aviso codigo pedidos />   // sem-itens, geracao, sem-revisao, sem-concurso, escolha, faltam, encerrada
  ```

- [ ] **Step 1: Instalar os ícones**

Run: `npm install @phosphor-icons/react@2.1.10`
Expected: `package.json` com `"@phosphor-icons/react": "^2.1.10"`. Em Server Components importe de `@phosphor-icons/react/ssr`; em Client Components, de `@phosphor-icons/react`.

- [ ] **Step 2: Tokens do DESIGN.md**

`src/app/globals.css`:

```css
@import "tailwindcss";

/* Tokens do docs/design/DESIGN.md (estilo Notion): papel quente, cartões brancos com borda fina,
   um único azul para a ação principal e acentos usados como pontuação. Tema claro apenas. */
@theme inline {
  --font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  --color-papel: #f6f5f4;
  --color-tinta: #000000;
  --color-grafite: #615d59;
  --color-pedra: #757575;
  --color-azul: #0075de;
  --color-azul-escuro: #005bab;
  --color-azul-claro: #e6f3fe;
  --color-ceu: #62aef0;
  --color-marigold: #ffb110;
  --color-marigold-claro: #fff4dc;
  --color-coral: #f64932;
  --color-vermelho: #e32d14;
  --color-vermelho-claro: #fdebe8;
  --color-meia-noite: #02093a;
  --color-borda: rgba(0, 0, 0, 0.08);
  --color-borda-forte: rgba(0, 0, 0, 0.15);
}

body {
  background: var(--color-papel);
  color: var(--color-tinta);
  font-family: var(--font-sans);
  font-feature-settings: "lnum";
}

:focus-visible {
  outline: 2px solid var(--color-azul);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}
```

- [ ] **Step 3: Classes dos componentes, link do menu e avisos**

`src/components/ui.ts`:

```ts
// Classes dos componentes do DESIGN.md. Raio: cartões 12px (rounded-xl), botões e campos 8px
// (rounded-lg), etiquetas em pílula (rounded-full). Um só botão azul cheio por tela.

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-[background-color,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

export const botao = {
  primario: `${base} bg-azul text-white hover:bg-azul-escuro`,
  secundario: `${base} bg-azul-claro text-azul hover:bg-[#d6ebfd]`,
  texto: `${base} text-black/90 hover:bg-black/5`,
  contorno: `${base} border border-borda-forte bg-white text-black/90 hover:bg-black/[0.03]`,
};

export const cartao = "rounded-xl border border-borda bg-white p-6";

export const pilula = {
  azul: "inline-flex items-center gap-1 rounded-full bg-azul-claro px-3 py-1 text-xs font-medium text-azul",
  neutra: "inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/70",
  alerta: "inline-flex items-center gap-1 rounded-full bg-marigold-claro px-3 py-1 text-xs font-medium text-[#8a5a00]",
  erro: "inline-flex items-center gap-1 rounded-full bg-vermelho-claro px-3 py-1 text-xs font-medium text-vermelho",
};

export const titulo = {
  pagina: "text-[32px] font-semibold leading-tight tracking-[-0.03em] md:text-[40px]",
  secao: "text-[22px] font-bold leading-[1.27] tracking-[-0.011em]",
};

export const textoApoio = "text-[15px] leading-relaxed text-grafite";
```

`src/components/nav-link.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = usePathname();
  const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
        ativo ? "bg-black/5 text-black" : "text-black/55 hover:text-black"
      }`}
    >
      {children}
    </Link>
  );
}
```

`src/components/aviso.tsx`:

```tsx
import { Info } from "@phosphor-icons/react/ssr";

function mensagem(codigo: string, pedidos: number): string | null {
  const fila =
    pedidos > 0
      ? `Pedimos a geração de itens para ${pedidos === 1 ? "1 tópico" : `${pedidos} tópicos`}. Volte em alguns minutos.`
      : "Os tópicos já estão na fila de geração ou o limite de 3 pedidos em aberto foi atingido.";
  switch (codigo) {
    case "sem-itens":
      return `Ainda não há itens aprovados suficientes. ${fila}`;
    case "geracao":
      return fila;
    case "sem-revisao":
      return "Nenhuma revisão vencida agora. Os itens errados voltam 1, 3, 7 e 15 dias depois.";
    case "sem-concurso":
      return "Nenhum concurso foi carregado ainda.";
    case "escolha":
      return "Escolha pelo menos um tópico.";
    case "faltam":
      return "Ainda faltam itens para montar o simulado completo.";
    case "encerrada":
      return "Esta sessão já foi encerrada.";
    default:
      return null;
  }
}

export function Aviso({ codigo, pedidos }: { codigo?: string; pedidos?: string }) {
  const texto = codigo ? mensagem(codigo, Number(pedidos ?? 0)) : null;
  if (!texto) return null;
  return (
    <p role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-azul-claro px-4 py-3 text-[15px] text-[#00447f]">
      <Info size={20} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}
```

- [ ] **Step 4: Contexto, ações e layout da área logada**

`git rm src/app/page.tsx` e crie:

`src/app/(app)/contexto.ts`:

```ts
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { listarCargos } from "@/db/repositorios/estudo";
import { criarClienteServidor } from "@/db/supabase/server";
import { ehModerador } from "@/lib/auth/moderacao";

export const COOKIE_CARGO = "cargo";

// Uma vez por requisição: cliente do usuário, cargos disponíveis e o cargo escolhido (cookie).
export const contextoDoUsuario = cache(async () => {
  const db = await criarClienteServidor();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/entrar");
  const cargos = await listarCargos(db);
  const escolhido = (await cookies()).get(COOKIE_CARGO)?.value;
  const cargo = cargos.find((c) => c.id === escolhido) ?? cargos[0] ?? null;
  return { db, user, cargos, cargo, moderador: ehModerador(user.email) };
});

export async function exigirCargo() {
  const ctx = await contextoDoUsuario();
  if (!ctx.cargo) redirect("/?aviso=sem-concurso");
  return { ...ctx, cargo: ctx.cargo };
}
```

`src/app/(app)/acoes.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import {
  iniciarEstudarAgora,
  iniciarRevisao,
  iniciarSimulado,
  iniciarTreinoTopico,
  pedirGeracaoDosFaltantes,
  type InicioSessao,
} from "@/estudo/servico";
import { COOKIE_CARGO, contextoDoUsuario, exigirCargo } from "./contexto";

const QUANTIDADES = [10, 20, 30];

function irParaSessao(r: InicioSessao, voltar: string): never {
  if (r.tipo === "criada") redirect(`/sessao/${r.sessaoId}`);
  redirect(`${voltar}?aviso=sem-itens&pedidos=${r.pedidosGeracao}`);
}

export async function escolherCargo(formData: FormData) {
  const { cargos } = await contextoDoUsuario();
  const id = String(formData.get("cargo") ?? "");
  if (cargos.some((c) => c.id === id)) {
    (await cookies()).set(COOKIE_CARGO, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/");
}

export async function estudarAgora() {
  const { db, cargo } = await exigirCargo();
  irParaSessao(await iniciarEstudarAgora(criarRepositorioEstudo(db), cargo.id, new Date()), "/");
}

export async function treinarTopicos(formData: FormData) {
  const { db, cargo } = await exigirCargo();
  const canonicos = [...new Set(formData.getAll("canonico").map(String).filter(Boolean))];
  if (canonicos.length === 0) redirect("/treinar?aviso=escolha");
  const pedido = Number(formData.get("total"));
  const total = QUANTIDADES.includes(pedido) ? pedido : 10;
  irParaSessao(await iniciarTreinoTopico(criarRepositorioEstudo(db), cargo.id, canonicos, total), "/treinar");
}

export async function revisarErros() {
  const { db, cargo } = await exigirCargo();
  const r = await iniciarRevisao(criarRepositorioEstudo(db), cargo.id, new Date());
  if (r.tipo === "sem_itens") redirect("/?aviso=sem-revisao");
  redirect(`/sessao/${r.sessaoId}`);
}

export async function comecarSimulado() {
  const { db, cargo } = await exigirCargo();
  const r = await iniciarSimulado(criarRepositorioEstudo(db), cargo.id);
  if (r.tipo === "faltam_itens") redirect("/simulado?aviso=faltam");
  redirect(`/simulado/${r.sessaoId}`);
}

export async function gerarFaltantes(formData: FormData) {
  const { db, cargo } = await exigirCargo();
  const canonicos = formData.getAll("canonico").map(String).filter(Boolean);
  const novos = await pedirGeracaoDosFaltantes(criarRepositorioEstudo(db), cargo.id, canonicos);
  redirect(`/simulado?aviso=geracao&pedidos=${novos}`);
}
```

`src/app/(app)/layout.tsx`:

```tsx
import Link from "next/link";
import { NavLink } from "@/components/nav-link";
import { botao } from "@/components/ui";
import { sair } from "../actions";
import { contextoDoUsuario } from "./contexto";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, moderador } = await contextoDoUsuario();
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-borda bg-papel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Concursos
          </Link>
          <nav aria-label="Principal" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
            <NavLink href="/">Início</NavLink>
            <NavLink href="/treinar">Treinar</NavLink>
            <NavLink href="/simulado">Simulado</NavLink>
            <NavLink href="/painel">Painel</NavLink>
            {moderador && <NavLink href="/itens">Itens</NavLink>}
          </nav>
          <span className="hidden text-sm text-pedra md:inline">{user.email}</span>
          <form action={sair}>
            <button type="submit" className={botao.texto}>
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-24">{children}</main>
    </div>
  );
}
```

- [ ] **Step 5: Tela inicial**

`src/app/(app)/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { calcularPrioridades } from "@/core";
import { contarRevisoesVencidas, criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { diasAte } from "@/estudo/painel";
import { Aviso } from "@/components/aviso";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, data, dataDaProva, plural } from "@/lib/formato";
import { nomeDaSessao, rotaDaSessao } from "@/lib/modos";
import { escolherCargo, estudarAgora, revisarErros, treinarTopicos } from "./acoes";
import { contextoDoUsuario } from "./contexto";

export default async function Inicio({ searchParams }: { searchParams: Promise<{ aviso?: string; pedidos?: string }> }) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo, cargos } = await contextoDoUsuario();
  if (!cargo) {
    return (
      <>
        <Aviso codigo="sem-concurso" />
        <h1 className={titulo.pagina}>Nenhum concurso carregado</h1>
        <p className={`${textoApoio} mt-3 max-w-[60ch]`}>Carregue um edital pelo guia em docs/deploy.md.</p>
      </>
    );
  }

  const agora = new Date();
  const repo = criarRepositorioEstudo(db);
  const [estrutura, historico, abertas, recentes, vencidas] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { limite: 5 }),
    contarRevisoesVencidas(db, agora),
  ]);
  const foco = calcularPrioridades(estrutura.topicosAlvo, historico, agora).slice(0, 5);
  const aberta = abertas[0];
  const dias = diasAte(estrutura.concurso.dataProva, agora);

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className={`${cartao} flex flex-col gap-6 p-8`}>
          <div className="flex flex-col gap-3">
            <h1 className={titulo.pagina}>Estudar agora</h1>
            <p className={`${textoApoio} max-w-[52ch]`}>
              20 itens escolhidos pelos seus pontos fracos: a maior parte dos tópicos que mais precisam, mais revisões
              vencidas e alguns tópicos fortes para não esquecer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={estudarAgora}>
              <button type="submit" className={botao.primario}>
                Começar sessão
              </button>
            </form>
            {aberta && (
              <Link href={rotaDaSessao(aberta.id, aberta.config)} className={botao.secundario}>
                Retomar {nomeDaSessao(aberta.config).toLowerCase()} ({aberta.respondidos} de {aberta.total})
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-6 rounded-xl bg-meia-noite p-8 text-white">
          <div>
            <p className="text-sm text-white/70">{estrutura.concurso.nome}</p>
            <p className="mt-2 text-[56px] font-semibold leading-none tracking-[-0.035em]">{dias}</p>
            <p className="mt-2 text-white/80">
              {dias === 1 ? "dia" : "dias"} até a prova, em {dataDaProva(estrutura.concurso.dataProva)}
            </p>
          </div>
          {cargos.length > 1 && (
            <form action={escolherCargo} className="flex flex-wrap gap-2" aria-label="Cargo">
              {cargos.map((c) => (
                <button
                  key={c.id}
                  type="submit"
                  name="cargo"
                  value={c.id}
                  aria-pressed={c.id === cargo.id}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                    c.id === cargo.id ? "bg-white text-meia-noite" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </form>
          )}
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr]">
        <div className={`${cartao} flex flex-col justify-between gap-6`}>
          <div>
            <h2 className={titulo.secao}>Revisão de erros</h2>
            <p className={`${textoApoio} mt-2`}>
              {vencidas > 0
                ? `${plural(vencidas, "item errado ou em branco está", "itens errados ou em branco estão")} no dia de voltar.`
                : "Nada vencido. Os erros voltam 1, 3, 7 e 15 dias depois."}
            </p>
          </div>
          <form action={revisarErros}>
            <button type="submit" disabled={vencidas === 0} className={botao.contorno}>
              Revisar agora
            </button>
          </form>
        </div>

        <div className={cartao}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={titulo.secao}>Onde focar</h2>
            <Link href="/painel" className="text-sm font-medium text-azul hover:underline">
              Ver painel
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-borda">
            {foco.map((t) => (
              <li key={t.chave} className="flex items-center gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.titulo}</p>
                  <p className="text-sm text-pedra">
                    {estrutura.disciplinas[t.disciplina]} ·{" "}
                    {t.n === 0 ? "nunca praticado" : `${aproveitamento(t.aproveitamento)} em ${plural(t.n, "resposta", "respostas")}`}
                  </p>
                </div>
                <form action={treinarTopicos}>
                  <input type="hidden" name="canonico" value={t.canonico} />
                  <input type="hidden" name="total" value="10" />
                  <button type="submit" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    Treinar
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {recentes.length > 0 && (
        <section className="mt-12">
          <h2 className={titulo.secao}>Sessões recentes</h2>
          <ul className="mt-4 divide-y divide-borda border-t border-borda">
            {recentes.map((s) => (
              <li key={s.id}>
                <Link
                  href={rotaDaSessao(s.id, s.config)}
                  className="flex items-center gap-4 py-3 transition-colors duration-200 hover:bg-black/[0.02]"
                >
                  <span className="w-16 shrink-0 text-sm text-pedra">{data(s.iniciadaEm)}</span>
                  <span className="flex-1 font-medium">{nomeDaSessao(s.config)}</span>
                  <ResumoSessao s={s} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function ResumoSessao({ s }: { s: Awaited<ReturnType<typeof listarSessoes>>[number] }) {
  if (!s.finalizadaEm) return <span className={pilula.alerta}>{s.respondidos} de {s.total}</span>;
  if (s.resultado?.tipo === "completo")
    return <span className={s.resultado.aprovado ? pilula.azul : pilula.erro}>{s.resultado.aprovado ? "Aprovado" : "Eliminado"}</span>;
  if (s.resultado?.tipo === "treino")
    return (
      <span className="text-sm text-grafite">
        {s.resultado.certos} certos · {s.resultado.errados} errados
      </span>
    );
  return null;
}
```

- [ ] **Step 6: Verificar e commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros; a rota `/` aparece como `ƒ` (dinâmica).

```bash
git add -A package.json package-lock.json src/app src/components
git commit -m "feat(ui): tokens do DESIGN.md, menu e tela inicial com Estudar agora"
```

---

### Task 9: Sessão de treino e revisão

**Files:**
- Create: `src/app/(app)/sessao/[id]/acoes.ts`, `src/app/(app)/sessao/[id]/page.tsx`, `src/components/sessao/enunciado.tsx`, `src/components/sessao/feedback.tsx`, `src/components/sessao/marcar-suspeito.tsx`, `src/components/sessao/player-treino.tsx`, `src/components/sessao/lista-correcao.tsx`

**Interfaces:**
- Produces:
  ```ts
  type Retorno<T> = { ok: true; dados: T } | { ok: false; erro: string }
  responder({ sessaoId, itemId, resposta, duvida, tempoMs }): Promise<Retorno<Correcao>>   // Server Action
  encerrar(sessaoId): redireciona para /sessao/[id]
  marcarComoSuspeito(itemId, motivo): Promise<Retorno<null>>
  <PlayerTreino sessaoId itens />   // atalhos C, E, B, D, Enter; mapa de itens; retoma no primeiro sem resposta
  <Enunciado textoBase enunciado topicos />, <Feedback {...DadosFeedback} />, nomeGabarito(g)
  <ListaCorrecao itens />            // itens corrigidos em <details>
  ```

Comportamento:
- A página só passa a correção dos itens já respondidos (`itensDaSessao(db, id, (respondido) => encerrada || respondido)`).
- Sessão de simulado completo em `/sessao/[id]` redireciona para `/simulado/[id]`.
- Ao responder o último item, o servidor encerra a sessão com o resumo; o botão vira "Ver resumo" e chama `router.refresh()`, e a página passa a mostrar o resumo e a lista de correção.
- "Item com problema?" abre um campo de motivo e chama `itens_marcar_suspeito`; o item sai das próximas sessões.

- [ ] **Step 1: Ações do servidor**

`src/app/(app)/sessao/[id]/acoes.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { criarRepositorioEstudo, marcarSuspeito } from "@/db/repositorios/estudo";
import { encerrarTreino, ErroEstudo, responderItem, type Correcao } from "@/estudo/servico";
import type { Marcacao } from "@/estudo/tipos";
import { contextoDoUsuario } from "../../contexto";

export type Retorno<T> = { ok: true; dados: T } | { ok: false; erro: string };

const MARCACOES: Marcacao[] = ["C", "E", "branco"];

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroEstudo) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function responder(p: {
  sessaoId: string;
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
  tempoMs: number | null;
}): Promise<Retorno<Correcao>> {
  if (!MARCACOES.includes(p.resposta)) return { ok: false, erro: "Resposta inválida." };
  const { db } = await contextoDoUsuario();
  try {
    const tempoMs = p.tempoMs === null ? null : Math.max(0, Math.min(Math.round(p.tempoMs), 3_600_000));
    const dados = await responderItem(criarRepositorioEstudo(db), { ...p, duvida: Boolean(p.duvida), tempoMs, agora: new Date() });
    return { ok: true, dados };
  } catch (e) {
    return falha(e);
  }
}

export async function encerrar(sessaoId: string) {
  const { db } = await contextoDoUsuario();
  try {
    await encerrarTreino(criarRepositorioEstudo(db), sessaoId, new Date());
  } catch (e) {
    if (!(e instanceof ErroEstudo)) throw e;
  }
  redirect(`/sessao/${sessaoId}`);
}

export async function marcarComoSuspeito(itemId: string, motivo: string): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await marcarSuspeito(db, itemId, motivo.trim().slice(0, 500));
    return { ok: true, dados: null };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: "Não foi possível marcar o item." };
  }
}
```

- [ ] **Step 2: Componentes**

`src/components/sessao/enunciado.tsx`:

```tsx
// Texto-base (quando há) e enunciado do item. Sem estado: serve à tela de treino, ao simulado e às listas de correção.
export function Enunciado({ textoBase, enunciado, topicos }: { textoBase: string | null; enunciado: string; topicos: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {topicos.length > 0 && (
        <p className="flex flex-wrap gap-2">
          {topicos.map((t) => (
            <span key={t} className="rounded-full bg-black/5 px-3 py-1 text-xs font-medium text-black/70">
              {t}
            </span>
          ))}
        </p>
      )}
      {textoBase && (
        <div className="max-h-[50dvh] overflow-y-auto rounded-lg border border-borda bg-papel px-5 py-4 text-[15px] leading-relaxed whitespace-pre-line text-black/80">
          {textoBase}
        </div>
      )}
      <p className="max-w-[70ch] text-lg leading-relaxed whitespace-pre-line">{enunciado}</p>
    </div>
  );
}
```

`src/components/sessao/feedback.tsx`:

```tsx
import { CheckCircle, MinusCircle, XCircle } from "@phosphor-icons/react/ssr";
import type { ResultadoResposta } from "@/core";

const ESTILO: Record<ResultadoResposta, { caixa: string; titulo: string }> = {
  certo: { caixa: "bg-azul-claro text-[#00447f]", titulo: "Você acertou" },
  certo_duvida: { caixa: "bg-azul-claro text-[#00447f]", titulo: "Você acertou, com dúvida" },
  errado: { caixa: "bg-vermelho-claro text-[#8f1c0c]", titulo: "Você errou" },
  branco: { caixa: "bg-black/5 text-black/80", titulo: "Em branco" },
};

export interface DadosFeedback {
  resultado: ResultadoResposta;
  gabarito: string;
  justificativa: string;
  citacao: string | null;
  fonte: string | null;
}

export function nomeGabarito(g: string): string {
  return g === "C" ? "Certo" : g === "E" ? "Errado" : g;
}

// Correção de um item: resultado, gabarito, justificativa e o trecho da fonte.
export function Feedback({ resultado, gabarito, justificativa, citacao, fonte }: DadosFeedback) {
  const e = ESTILO[resultado];
  const Icone = resultado === "errado" ? XCircle : resultado === "branco" ? MinusCircle : CheckCircle;
  return (
    <div className="flex flex-col gap-4">
      <p className={`flex items-center gap-2 rounded-lg px-4 py-3 font-medium ${e.caixa}`}>
        <Icone size={20} weight="fill" aria-hidden />
        {e.titulo}. Gabarito: {nomeGabarito(gabarito)}.
      </p>
      {justificativa && <p className="max-w-[70ch] leading-relaxed text-grafite">{justificativa}</p>}
      {citacao && (
        <blockquote className="max-w-[70ch] border-l-2 border-borda-forte pl-4 text-[15px] leading-relaxed text-black/70">
          {citacao}
          {fonte && <span className="mt-1 block text-sm text-pedra">{fonte}</span>}
        </blockquote>
      )}
    </div>
  );
}
```

`src/components/sessao/marcar-suspeito.tsx`:

```tsx
"use client";

import { Flag } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { marcarComoSuspeito } from "@/app/(app)/sessao/[id]/acoes";
import { botao } from "@/components/ui";

// Denuncia um item com problema (gabarito, ambiguidade, lei desatualizada). Ele sai das sessões até ser revisado.
export function MarcarSuspeito({ itemId }: { itemId: string }) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState<"livre" | "feito" | string>("livre");
  const [pendente, iniciar] = useTransition();

  if (estado === "feito") {
    return <p className="text-sm text-grafite">Item marcado como suspeito. Ele sai das sessões até ser revisado.</p>;
  }
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={`${botao.texto} -ml-4 self-start text-pedra`}>
        <Flag size={16} aria-hidden />
        Item com problema?
      </button>
    );
  }
  return (
    <form
      className="flex max-w-[70ch] flex-col gap-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        iniciar(async () => {
          const r = await marcarComoSuspeito(itemId, motivo);
          setEstado(r.ok ? "feito" : r.erro);
        });
      }}
    >
      <label htmlFor={`motivo-${itemId}`} className="text-sm font-medium">
        O que está errado?
      </label>
      <textarea
        id={`motivo-${itemId}`}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={500}
        required
        placeholder="Ex.: o gabarito contradiz o art. 5º da lei."
        className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-[15px] placeholder:text-pedra"
      />
      {estado !== "livre" && <p className="text-sm text-vermelho">{estado}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente || !motivo.trim()} className={botao.contorno}>
          Marcar como suspeito
        </button>
        <button type="button" onClick={() => setAberto(false)} className={botao.texto}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
```

`src/components/sessao/player-treino.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { responder } from "@/app/(app)/sessao/[id]/acoes";
import { botao } from "@/components/ui";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import { resultadoDe } from "@/estudo/resultado";
import type { Marcacao } from "@/estudo/tipos";
import { Enunciado } from "./enunciado";
import { Feedback, type DadosFeedback } from "./feedback";
import { MarcarSuspeito } from "./marcar-suspeito";

type Corrigido = DadosFeedback & { resposta: Marcacao; duvida: boolean };

function corrigidosIniciais(itens: ItemDaSessao[]): Record<string, Corrigido> {
  const r: Record<string, Corrigido> = {};
  for (const i of itens) {
    if (!i.resposta || !i.correcao) continue;
    r[i.id] = {
      ...i.correcao,
      ...i.resposta,
      resultado: resultadoDe(i.resposta.resposta, i.resposta.duvida, i.correcao.gabarito),
    };
  }
  return r;
}

const COR_MAPA: Record<string, string> = {
  certo: "bg-azul-claro text-azul border-transparent",
  certo_duvida: "bg-azul-claro text-azul border-transparent",
  errado: "bg-vermelho-claro text-vermelho border-transparent",
  branco: "bg-black/5 text-black/60 border-transparent",
};

// Treino e revisão: uma pergunta por vez, correção logo após a resposta. Atalhos: C, E, B, D e Enter.
export function PlayerTreino({ sessaoId, itens }: { sessaoId: string; itens: ItemDaSessao[] }) {
  const router = useRouter();
  const [corrigidos, setCorrigidos] = useState(() => corrigidosIniciais(itens));
  const [indice, setIndice] = useState(() => Math.max(0, itens.findIndex((i) => !i.resposta)));
  const [duvida, setDuvida] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const inicioItem = useRef(0);

  const item = itens[indice];
  const corrigido = corrigidos[item.id];
  const respondidos = Object.keys(corrigidos).length;
  const terminou = respondidos === itens.length;

  useEffect(() => {
    inicioItem.current = Date.now();
  }, [indice]);

  function irPara(n: number) {
    setIndice(n);
    setDuvida(false);
    setErro(null);
  }

  const marcar = useCallback(
    (resposta: Marcacao) => {
      if (corrigido || pendente) return;
      const tempoMs = Date.now() - inicioItem.current;
      iniciar(async () => {
        const r = await responder({ sessaoId, itemId: item.id, resposta, duvida, tempoMs });
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        const { gabarito, justificativa, citacao, fonte, resultado } = r.dados;
        setCorrigidos((c) => ({
          ...c,
          [item.id]: { gabarito, justificativa, citacao, fonte, resultado, resposta: r.dados.resposta, duvida: r.dados.duvida },
        }));
      });
    },
    [corrigido, pendente, sessaoId, item.id, duvida],
  );

  const avancar = useCallback(() => {
    if (terminou) {
      router.refresh();
      return;
    }
    const proximo = itens.findIndex((i, n) => n > indice && !corrigidos[i.id]);
    irPara(proximo >= 0 ? proximo : itens.findIndex((i) => !corrigidos[i.id]));
  }, [terminou, router, itens, indice, corrigidos]);

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      const alvo = ev.target as HTMLElement;
      if (ev.metaKey || ev.ctrlKey || ev.altKey || alvo.closest("textarea, input, select")) return;
      const k = ev.key.toLowerCase();
      if (!corrigido) {
        if (k === "c") marcar("C");
        else if (k === "e") marcar("E");
        else if (k === "b") marcar("branco");
        else if (k === "d") setDuvida((d) => !d);
      } else if (k === "enter" || k === "arrowright") {
        avancar();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [corrigido, marcar, avancar]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_220px]">
      <article className="flex min-w-0 flex-col gap-8" aria-live="polite">
        <p className="text-sm text-pedra">
          Item {indice + 1} de {itens.length}
        </p>
        <Enunciado textoBase={item.textoBase} enunciado={item.enunciado} topicos={item.topicos} />

        {corrigido ? (
          <div className="flex flex-col gap-6">
            <p className="text-sm text-pedra">
              Sua resposta: {corrigido.resposta === "branco" ? "em branco" : corrigido.resposta === "C" ? "Certo" : "Errado"}
              {corrigido.duvida ? ", com dúvida" : ""}
            </p>
            <Feedback {...corrigido} />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={avancar} className={botao.primario}>
                {terminou ? "Ver resumo" : "Próximo item"}
              </button>
            </div>
            <MarcarSuspeito key={item.id} itemId={item.id} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={pendente} onClick={() => marcar("C")} className={`${botao.contorno} h-12 min-w-32 text-base`}>
                Certo
              </button>
              <button type="button" disabled={pendente} onClick={() => marcar("E")} className={`${botao.contorno} h-12 min-w-32 text-base`}>
                Errado
              </button>
              <button
                type="button"
                aria-pressed={duvida}
                onClick={() => setDuvida((d) => !d)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  duvida ? "border-transparent bg-marigold-claro text-[#8a5a00]" : "border-borda-forte text-black/70 hover:bg-black/[0.03]"
                }`}
              >
                Tenho dúvida
              </button>
              <button type="button" disabled={pendente} onClick={() => marcar("branco")} className={botao.texto}>
                Deixar em branco
              </button>
            </div>
            {erro && (
              <p role="alert" className="text-sm text-vermelho">
                {erro}
              </p>
            )}
            <p className="hidden text-xs text-pedra md:block">Atalhos: C certo, E errado, B em branco, D dúvida, Enter próximo.</p>
          </div>
        )}
      </article>

      <aside className="order-first lg:order-none">
        <p className="mb-3 text-sm font-medium">
          {respondidos} de {itens.length} respondidos
        </p>
        <ol className="grid grid-cols-10 gap-1.5 lg:grid-cols-5" aria-label="Itens da sessão">
          {itens.map((i, n) => {
            const c = corrigidos[i.id];
            return (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => irPara(n)}
                  aria-label={`Item ${n + 1}`}
                  aria-current={n === indice ? "step" : undefined}
                  className={`flex aspect-square w-full items-center justify-center rounded-md border text-xs font-medium transition-colors duration-200 ${
                    c ? COR_MAPA[c.resultado] : "border-borda-forte bg-white text-black/60"
                  } ${n === indice ? "ring-2 ring-azul ring-offset-1" : ""}`}
                >
                  {n + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
  );
}
```

`src/components/sessao/lista-correcao.tsx`:

```tsx
import { resultadoDe } from "@/estudo/resultado";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import { Enunciado } from "./enunciado";
import { Feedback } from "./feedback";

const ROTULO = { certo: "Certo", certo_duvida: "Certo com dúvida", errado: "Errado", branco: "Em branco" } as const;
const COR = {
  certo: "text-azul",
  certo_duvida: "text-azul",
  errado: "text-vermelho",
  branco: "text-pedra",
} as const;

// Itens já corrigidos, recolhidos: abre um por vez para rever a justificativa.
export function ListaCorrecao({ itens }: { itens: ItemDaSessao[] }) {
  return (
    <ol className="divide-y divide-borda border-y border-borda">
      {itens.map((i, n) => {
        if (!i.correcao) return null;
        const resposta = i.resposta ?? { resposta: "branco" as const, duvida: false };
        const resultado = resultadoDe(resposta.resposta, resposta.duvida, i.correcao.gabarito);
        return (
          <li key={i.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-3 hover:bg-black/[0.02]">
                <span className="w-8 shrink-0 text-sm text-pedra">{n + 1}</span>
                <span className="line-clamp-1 flex-1 text-[15px]">{i.enunciado}</span>
                <span className={`shrink-0 text-sm font-medium ${COR[resultado]}`}>{ROTULO[resultado]}</span>
              </summary>
              <div className="flex flex-col gap-6 pt-2 pb-6 pl-12">
                <Enunciado textoBase={i.textoBase} enunciado={i.enunciado} topicos={i.topicos} />
                <Feedback resultado={resultado} {...i.correcao} />
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Página**

`src/app/(app)/sessao/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao } from "@/db/repositorios/estudo";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { PlayerTreino } from "@/components/sessao/player-treino";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import { nomeDaSessao } from "@/lib/modos";
import { estudarAgora } from "../../acoes";
import { contextoDoUsuario } from "../../contexto";
import { encerrar } from "./acoes";

export default async function PaginaSessao({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await contextoDoUsuario();
  const sessao = await criarRepositorioEstudo(db).sessao(id);
  if (!sessao) notFound();
  if (sessao.config.tipo === "completo") redirect(`/simulado/${id}`);

  const encerrada = sessao.finalizadaEm !== null;
  const itens = await itensDaSessao(db, id, (respondido) => encerrada || respondido);

  if (!encerrada) {
    return (
      <>
        <div className="mb-8 flex items-center justify-between gap-4">
          <h1 className={titulo.secao}>{nomeDaSessao(sessao.config)}</h1>
          <form action={encerrar.bind(null, id)}>
            <button type="submit" className={botao.texto}>
              Encerrar sessão
            </button>
          </form>
        </div>
        <PlayerTreino sessaoId={id} itens={itens} />
      </>
    );
  }

  const respondidos = itens.filter((i) => i.resposta);
  const certos = respondidos.filter((i) => i.resposta!.resposta === i.correcao?.gabarito).length;
  const brancos = respondidos.filter((i) => i.resposta!.resposta === "branco").length;
  const errados = respondidos.length - certos - brancos;
  return (
    <>
      <section className={`${cartao} flex flex-col gap-6 p-8 md:flex-row md:items-end md:justify-between`}>
        <div>
          <p className="text-sm text-pedra">{nomeDaSessao(sessao.config)} encerrada</p>
          <h1 className={`${titulo.pagina} mt-2`}>
            {certos} de {respondidos.length} certos
          </h1>
          <p className={`${textoApoio} mt-2`}>
            {errados} errados e {brancos} em branco. Os erros e brancos voltam na revisão de amanhã.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={estudarAgora}>
            <button type="submit" className={botao.primario}>
              Nova sessão
            </button>
          </form>
          <Link href="/" className={botao.texto}>
            Voltar ao início
          </Link>
        </div>
      </section>
      <h2 className={`${titulo.secao} mt-12 mb-4`}>Itens da sessão</h2>
      <ListaCorrecao itens={itens.filter((i) => i.resposta)} />
    </>
  );
}
```

- [ ] **Step 4: Verificar e commit**

Run: `npm run typecheck && npm run lint`
Expected: sem erros (o lint do React Compiler proíbe `setState` dentro de efeito e reatribuir variável depois do render; o player reseta o estado em `irPara`).

```bash
git add src/app/\(app\)/sessao src/components/sessao
git commit -m "feat(ui): sessão de treino com correção imediata, mapa de itens e denúncia de item"
```

---

### Task 10: Treino por tópico

**Files:**
- Create: `src/app/(app)/treinar/page.tsx`

Lista as disciplinas do cargo na ordem do edital (`<details>`), cada tópico folha com aproveitamento, número de respostas e itens novos disponíveis; quantidade 10, 20 ou 30; envia para `treinarTopicos`.

- [ ] **Step 1: Página**

`src/app/(app)/treinar/page.tsx`:

```tsx
import { calcularPrioridades } from "@/core";
import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { tabelaDesempenho } from "@/estudo/painel";
import { Aviso } from "@/components/aviso";
import { botao, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, plural } from "@/lib/formato";
import { treinarTopicos } from "../acoes";
import { exigirCargo } from "../contexto";

export default async function Treinar({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; pedidos?: string }>;
}) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const agora = new Date();
  const [estrutura, candidatos, historico] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.candidatos(cargo.id),
    repo.historico(cargo.id),
  ]);
  const tabela = tabelaDesempenho(estrutura.topicosAlvo, calcularPrioridades(estrutura.topicosAlvo, historico, agora), historico, agora);
  const naoVistos = new Map<string, number>();
  for (const i of candidatos) {
    if (i.visto) continue;
    for (const c of i.canonicos) naoVistos.set(c, (naoVistos.get(c) ?? 0) + 1);
  }

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <h1 className={titulo.pagina}>Treinar por tópico</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Escolha os tópicos do edital. Os itens que você ainda não viu vêm primeiro; quando faltam, pedimos mais à IA.
      </p>

      <form action={treinarTopicos} className="mt-8 flex flex-col gap-6">
        <div className="divide-y divide-borda rounded-xl border border-borda bg-white">
          {tabela.map((d) => (
            <details key={d.disciplina} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-4">
                <span className="flex-1 font-semibold">{estrutura.disciplinas[d.disciplina]}</span>
                <span className="text-sm text-pedra">{plural(d.topicos.length, "tópico", "tópicos")}</span>
              </summary>
              <ul className="flex flex-col pb-4">
                {d.topicos.map((t) => (
                  <li key={`${t.disciplina}:${t.codigo}`}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-black/[0.03]">
                      <input type="checkbox" name="canonico" value={t.canonico} className="mt-1 size-4 accent-azul" />
                      <span className="flex-1">
                        <span className="text-pedra">{t.codigo}</span> {t.titulo}
                        <span className="block text-sm text-pedra">
                          {t.n === 0 ? "nunca praticado" : `${aproveitamento(t.aproveitamento)} em ${plural(t.n, "resposta", "respostas")}`}
                          {" · "}
                          {plural(naoVistos.get(t.canonico) ?? 0, "item novo", "itens novos")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="sticky bottom-4 flex flex-wrap items-center gap-4 self-start rounded-xl border border-borda bg-white px-4 py-3">
          <label htmlFor="total" className="text-sm font-medium">
            Quantidade
          </label>
          <select id="total" name="total" defaultValue="10" className="rounded-lg border border-borda-forte bg-white px-3 py-2 text-sm">
            <option value="10">10 itens</option>
            <option value="20">20 itens</option>
            <option value="30">30 itens</option>
          </select>
          <button type="submit" className={botao.primario}>
            Começar treino
          </button>
        </div>
      </form>
    </>
  );
}
```

- [ ] **Step 2: Verificar e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/app/\(app\)/treinar
git commit -m "feat(ui): treino por tópico do edital"
```

---

### Task 11: Simulado completo

**Files:**
- Create: `src/app/(app)/simulado/page.tsx`, `src/app/(app)/simulado/[id]/acoes.ts`, `src/app/(app)/simulado/[id]/page.tsx`, `src/app/(app)/simulado/[id]/resultado/page.tsx`, `src/components/simulado/cronometro.tsx`, `src/components/simulado/player-simulado.tsx`

**Interfaces:**
- Produces:
  ```ts
  marcar({ sessaoId, itemId, resposta, duvida }): Promise<Retorno<null>>   // Server Action, salva a cada clique
  entregar(sessaoId): Promise<Retorno<null>>
  <Cronometro prazo aoTerminar />     // prazo vem do servidor; ao zerar, entrega
  <PlayerSimulado sessaoId itens provas prazo />
  ```

Comportamento:
- `/simulado`: prévia com `previaSimulado`. Sem faltantes, "Começar simulado"; com faltantes, a lista por disciplina e "Pedir itens à IA" (os canônicos das disciplinas que faltam, os com menos itens primeiro). Simulado aberto vira "Continuar". Tabela dos entregues com nota/corte por prova, total e situação.
- `/simulado/[id]`: sem correção. Marcação otimista; se o servidor recusar, volta ao estado anterior e mostra o erro. "Entregar simulado" pede confirmação com o número de brancos. Recarregar a página mantém o cronômetro (prazo calculado de `iniciado_em`).
- `/simulado/[id]/resultado`: situação (aprovado nos cortes ou eliminado e por quê), nota e corte por prova e do conjunto, certos/errados/brancos, tabela por disciplina, análise de dúvida com a recomendação (só com 10 ou mais itens com dúvida), correção item a item e "Revisar erros".

- [ ] **Step 1: Ações e cronômetro**

`src/app/(app)/simulado/[id]/acoes.ts`:

```ts
"use server";

import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { entregarSimulado, ErroEstudo, marcarNoSimulado } from "@/estudo/servico";
import type { Marcacao } from "@/estudo/tipos";
import { contextoDoUsuario } from "../../contexto";
import type { Retorno } from "../../sessao/[id]/acoes";

const MARCACOES: Marcacao[] = ["C", "E", "branco"];

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroEstudo) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function marcar(p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean }): Promise<Retorno<null>> {
  if (!MARCACOES.includes(p.resposta)) return { ok: false, erro: "Resposta inválida." };
  const { db } = await contextoDoUsuario();
  try {
    await marcarNoSimulado(criarRepositorioEstudo(db), { ...p, duvida: Boolean(p.duvida), agora: new Date() });
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

export async function entregar(sessaoId: string): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await entregarSimulado(criarRepositorioEstudo(db), sessaoId, new Date());
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}
```

`src/components/simulado/cronometro.tsx`:

```tsx
"use client";

import { Timer } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { duracao } from "@/lib/formato";

// Conta a partir do prazo calculado no servidor (iniciado_em + duração), então sobrevive a recarregar a página.
export function Cronometro({ prazo, aoTerminar }: { prazo: string; aoTerminar: () => void }) {
  const fim = new Date(prazo).getTime();
  const [agora, setAgora] = useState(() => Date.now());
  const restante = fim - agora;
  const acabou = restante <= 0;

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (acabou) aoTerminar();
  }, [acabou, aoTerminar]);

  const fimProximo = restante < 15 * 60_000;
  return (
    <p
      className={`flex items-center gap-2 text-2xl font-semibold tabular-nums tracking-tight ${fimProximo ? "text-vermelho" : ""}`}
      aria-label="Tempo restante"
    >
      <Timer size={22} aria-hidden />
      {duracao(restante)}
    </p>
  );
}
```

- [ ] **Step 2: Player do simulado**

`src/components/simulado/player-simulado.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { entregar, marcar } from "@/app/(app)/simulado/[id]/acoes";
import { Enunciado } from "@/components/sessao/enunciado";
import { botao } from "@/components/ui";
import type { ItemDaSessao } from "@/db/repositorios/estudo";
import type { Marcacao } from "@/estudo/tipos";
import { Cronometro } from "./cronometro";

interface Marcada {
  resposta: Marcacao;
  duvida: boolean;
}

export interface ProvaNoSimulado {
  slug: string;
  nome: string;
  inicio: number;
  fim: number;
}

// Simulado completo: sem correção até a entrega; cada marcação é salva na hora e pode ser trocada.
export function PlayerSimulado({
  sessaoId,
  itens,
  provas,
  prazo,
}: {
  sessaoId: string;
  itens: ItemDaSessao[];
  provas: ProvaNoSimulado[];
  prazo: string;
}) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState<Record<string, Marcada>>(() =>
    Object.fromEntries(itens.filter((i) => i.resposta).map((i) => [i.id, i.resposta!])),
  );
  const [indice, setIndice] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [entregando, iniciarEntrega] = useTransition();
  const entregue = useRef(false);

  const item = itens[indice];
  const atual = marcadas[item.id];
  const prova = provas.find((p) => indice >= p.inicio && indice < p.fim);
  const brancos = itens.filter((i) => !marcadas[i.id] || marcadas[i.id].resposta === "branco").length;

  function gravar(itemId: string, nova: Marcada) {
    const anterior = marcadas[itemId];
    setMarcadas((m) => ({ ...m, [itemId]: nova }));
    setErro(null);
    marcar({ sessaoId, itemId, ...nova }).then((r) => {
      if (r.ok) return;
      setErro(r.erro);
      setMarcadas((m) => {
        const copia = { ...m };
        if (anterior) copia[itemId] = anterior;
        else delete copia[itemId];
        return copia;
      });
    });
  }

  const finalizar = useCallback(() => {
    if (entregue.current) return;
    entregue.current = true;
    iniciarEntrega(async () => {
      const r = await entregar(sessaoId);
      if (r.ok) router.push(`/simulado/${sessaoId}/resultado`);
      else {
        entregue.current = false;
        setErro(r.erro);
      }
    });
  }, [sessaoId, router]);

  const escolha = (resposta: Marcacao) =>
    `${botao.contorno} h-12 min-w-32 text-base ${atual?.resposta === resposta ? "!border-azul !bg-azul-claro !text-azul" : ""}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <article className="flex min-w-0 flex-col gap-8">
        <p className="text-sm text-pedra">
          {prova?.nome} · item {indice + 1} de {itens.length}
        </p>
        <Enunciado textoBase={item.textoBase} enunciado={item.enunciado} topicos={[]} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-pressed={atual?.resposta === "C"} onClick={() => gravar(item.id, { resposta: "C", duvida: atual?.duvida ?? false })} className={escolha("C")}>
            Certo
          </button>
          <button type="button" aria-pressed={atual?.resposta === "E"} onClick={() => gravar(item.id, { resposta: "E", duvida: atual?.duvida ?? false })} className={escolha("E")}>
            Errado
          </button>
          <button
            type="button"
            aria-pressed={atual?.duvida ?? false}
            onClick={() => gravar(item.id, { resposta: atual?.resposta ?? "branco", duvida: !(atual?.duvida ?? false) })}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              atual?.duvida ? "border-transparent bg-marigold-claro text-[#8a5a00]" : "border-borda-forte text-black/70 hover:bg-black/[0.03]"
            }`}
          >
            Tenho dúvida
          </button>
          {atual && atual.resposta !== "branco" && (
            <button type="button" onClick={() => gravar(item.id, { resposta: "branco", duvida: atual.duvida })} className={botao.texto}>
              Deixar em branco
            </button>
          )}
        </div>
        {erro && (
          <p role="alert" className="text-sm text-vermelho">
            {erro}
          </p>
        )}
        <div className="flex gap-2 border-t border-borda pt-6">
          <button type="button" disabled={indice === 0} onClick={() => setIndice(indice - 1)} className={botao.texto}>
            Anterior
          </button>
          <button type="button" disabled={indice === itens.length - 1} onClick={() => setIndice(indice + 1)} className={botao.contorno}>
            Próximo
          </button>
        </div>
      </article>

      <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
        <Cronometro prazo={prazo} aoTerminar={finalizar} />
        {provas.map((p) => (
          <div key={p.slug}>
            <p className="mb-2 text-sm font-medium">{p.nome}</p>
            <ol className="grid grid-cols-10 gap-1">
              {itens.slice(p.inicio, p.fim).map((i, k) => {
                const n = p.inicio + k;
                const m = marcadas[i.id];
                const marcado = m && m.resposta !== "branco";
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setIndice(n)}
                      aria-label={`Item ${n + 1}${marcado ? ", marcado" : ""}${m?.duvida ? ", com dúvida" : ""}`}
                      aria-current={n === indice ? "step" : undefined}
                      className={`flex aspect-square w-full items-center justify-center rounded text-[10px] font-medium transition-colors duration-200 ${
                        marcado ? "bg-azul-claro text-azul" : "bg-white text-black/50 ring-1 ring-borda-forte ring-inset"
                      } ${m?.duvida ? "!bg-marigold-claro !text-[#8a5a00]" : ""} ${n === indice ? "outline-2 outline-offset-1 outline-azul" : ""}`}
                    >
                      {n + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        {confirmando ? (
          <div className="flex flex-col gap-3 rounded-xl border border-borda bg-white p-4">
            <p className="text-sm">
              Entregar agora? {brancos > 0 ? `${brancos} ${brancos === 1 ? "item está" : "itens estão"} em branco.` : "Todos os itens foram marcados."}
            </p>
            <div className="flex gap-2">
              <button type="button" disabled={entregando} onClick={finalizar} className={botao.primario}>
                Entregar
              </button>
              <button type="button" onClick={() => setConfirmando(false)} className={botao.texto}>
                Voltar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmando(true)} className={`${botao.contorno} self-start`}>
            Entregar simulado
          </button>
        )}
      </aside>
    </div>
  );
}
```

- [ ] **Step 3: Páginas**

`src/app/(app)/simulado/page.tsx`:

```tsx
import Link from "next/link";
import { criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { previaSimulado } from "@/estudo/servico";
import { Aviso } from "@/components/aviso";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota, plural } from "@/lib/formato";
import { comecarSimulado, gerarFaltantes } from "../acoes";
import { exigirCargo } from "../contexto";

export default async function Simulado({ searchParams }: { searchParams: Promise<{ aviso?: string; pedidos?: string }> }) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const [estrutura, previa, abertos, entregues] = await Promise.all([
    repo.estrutura(cargo.id),
    previaSimulado(repo, cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 20 }),
  ]);
  const total = estrutura.provas.reduce((s, p) => s + p.nItens, 0);
  const aberto = abertos[0];
  const horas = `${Math.floor(previa.config.duracaoMin / 60)}h${String(previa.config.duracaoMin % 60).padStart(2, "0")}`;

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className={`${cartao} flex flex-col gap-6 p-8`}>
          <div>
            <h1 className={titulo.pagina}>Simulado completo</h1>
            <p className={`${textoApoio} mt-3 max-w-[56ch]`}>
              {total} itens de {estrutura.provas.map((p) => p.nome).join(" e ")}, na distribuição do edital, em {horas}. A
              correção sai só no final, com as regras e os cortes da banca. A discursiva entra com o corretor de redação.
            </p>
          </div>
          {aberto ? (
            <Link href={`/simulado/${aberto.id}`} className={`${botao.primario} self-start`}>
              Continuar simulado ({aberto.respondidos} de {aberto.total})
            </Link>
          ) : previa.faltantes.length === 0 ? (
            <form action={comecarSimulado}>
              <button type="submit" className={botao.primario}>
                Começar simulado
              </button>
            </form>
          ) : (
            <p className="text-sm text-pedra">Ainda faltam itens para montar a prova inteira.</p>
          )}
        </div>

        {previa.faltantes.length > 0 && !aberto && (
          <div className={cartao}>
            <h2 className={titulo.secao}>Itens que faltam</h2>
            <ul className="mt-4 flex flex-col gap-2">
              {previa.faltantes.map((f) => (
                <li key={`${f.prova}:${f.disciplina}`} className="flex justify-between gap-4 text-[15px]">
                  <span>{f.nome}</span>
                  <span className="text-pedra">{plural(f.faltam, "item", "itens")}</span>
                </li>
              ))}
            </ul>
            <form action={gerarFaltantes} className="mt-6">
              {[...new Set(previa.faltantes.flatMap((f) => f.canonicos))].map((c) => (
                <input key={c} type="hidden" name="canonico" value={c} />
              ))}
              <button type="submit" className={botao.secundario}>
                Pedir itens à IA
              </button>
            </form>
            <p className="mt-3 text-sm text-pedra">Até 3 pedidos em aberto por vez; cada pedido gera 5 itens.</p>
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className={titulo.secao}>Simulados entregues</h2>
        {entregues.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhum ainda. O primeiro vira a sua linha de base.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead className="text-sm text-pedra">
                <tr className="border-b border-borda">
                  <th className="py-2 font-medium">Data</th>
                  {estrutura.provas.map((p) => (
                    <th key={p.slug} className="py-2 font-medium">
                      {p.nome.split(" ")[0]}
                    </th>
                  ))}
                  <th className="py-2 font-medium">Total</th>
                  <th className="py-2 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {entregues.map((s) =>
                  s.resultado?.tipo === "completo" ? (
                    <tr key={s.id} className="border-b border-borda">
                      <td className="py-3">
                        <Link href={`/simulado/${s.id}/resultado`} className="text-azul hover:underline">
                          {dataEHora(s.finalizadaEm!)}
                        </Link>
                      </td>
                      {estrutura.provas.map((p) => {
                        const r = s.resultado?.tipo === "completo" ? s.resultado.provas.find((x) => x.slug === p.slug) : undefined;
                        return (
                          <td key={p.slug} className={`py-3 tabular-nums ${r && !r.aprovada ? "text-vermelho" : ""}`}>
                            {r ? `${nota(r.nota)} / ${r.corte ?? "-"}` : "-"}
                          </td>
                        );
                      })}
                      <td className="py-3 tabular-nums">
                        {nota(s.resultado.total)}
                        {s.resultado.corteConjunto !== null ? ` / ${s.resultado.corteConjunto}` : ""}
                      </td>
                      <td className="py-3">
                        <span className={s.resultado.aprovado ? pilula.azul : pilula.erro}>
                          {s.resultado.aprovado ? "Aprovado" : "Eliminado"}
                        </span>
                      </td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
```

`src/app/(app)/simulado/[id]/page.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao } from "@/db/repositorios/estudo";
import { prazoDoSimulado } from "@/estudo/servico";
import { PlayerSimulado, type ProvaNoSimulado } from "@/components/simulado/player-simulado";
import { exigirCargo } from "../../contexto";

export default async function PaginaSimulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const sessao = await repo.sessao(id);
  if (!sessao) notFound();
  if (sessao.config.tipo !== "completo") redirect(`/sessao/${id}`);
  if (sessao.finalizadaEm) redirect(`/simulado/${id}/resultado`);

  const [estrutura, itens] = await Promise.all([repo.estrutura(sessao.cargoId), itensDaSessao(db, id, () => false)]);
  const provas = sessao.config.provas.reduce<ProvaNoSimulado[]>((acc, p) => {
    const inicio = acc.at(-1)?.fim ?? 0;
    const nome = estrutura.provas.find((x) => x.slug === p.slug)?.nome ?? p.slug;
    return [...acc, { slug: p.slug, nome, inicio, fim: inicio + p.itens.length }];
  }, []);

  return <PlayerSimulado sessaoId={id} itens={itens} provas={provas} prazo={prazoDoSimulado(sessao)!.toISOString()} />;
}
```

`src/app/(app)/simulado/[id]/resultado/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao, resultadoGuardado } from "@/db/repositorios/estudo";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota } from "@/lib/formato";
import { revisarErros } from "../../../acoes";
import { exigirCargo } from "../../../contexto";

const RECOMENDACAO = {
  arriscar_mais: "Seus chutes com dúvida mais acertam do que erram: vale arriscar mais nesta disciplina.",
  deixar_mais_em_branco: "Com dúvida você mais erra do que acerta: deixe mais itens em branco nesta disciplina.",
  neutro: "Acertos e erros com dúvida se anulam: tanto faz arriscar ou deixar em branco.",
  dados_insuficientes: "Menos de 10 itens com dúvida: ainda não dá para recomendar.",
} as const;

export default async function Resultado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await exigirCargo();
  const sessao = await criarRepositorioEstudo(db).sessao(id);
  if (!sessao || sessao.config.tipo !== "completo") notFound();
  if (!sessao.finalizadaEm) redirect(`/simulado/${id}`);
  const [r, itens] = await Promise.all([resultadoGuardado(db, id), itensDaSessao(db, id, () => true)]);
  if (!r || r.tipo !== "completo") notFound();

  return (
    <>
      <section className={`${cartao} flex flex-col gap-6 p-8`}>
        <div className="flex flex-wrap items-center gap-3">
          <span className={r.aprovado ? pilula.azul : pilula.erro}>{r.aprovado ? "Aprovado nos cortes" : "Eliminado"}</span>
          <span className="text-sm text-pedra">Entregue em {dataEHora(sessao.finalizadaEm)}</span>
        </div>
        <div>
          <h1 className={titulo.pagina}>
            {nota(r.total)} pontos
            {r.corteConjunto !== null && <span className="text-black/40"> / corte {r.corteConjunto}</span>}
          </h1>
          {r.motivos.length > 0 && (
            <ul className={`${textoApoio} mt-3 list-disc pl-5`}>
              {r.motivos.map((m) => (
                <li key={m}>{m.replace(/^([^:]+):/, (_, slug: string) => `${r.provas.find((p) => p.slug === slug)?.nome ?? "Conjunto"}:`)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {r.provas.map((p) => (
            <div key={p.slug} className="rounded-lg border border-borda p-4">
              <p className="text-sm text-pedra">{p.nome}</p>
              <p className={`mt-1 text-[28px] font-semibold tabular-nums tracking-tight ${p.aprovada ? "" : "text-vermelho"}`}>
                {nota(p.nota)}
                {p.corte !== null && <span className="text-base font-normal text-pedra"> / corte {p.corte}</span>}
              </p>
              <p className="mt-1 text-sm text-grafite">
                {p.certos} certos · {p.errados} errados · {p.brancos} em branco
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={revisarErros}>
            <button type="submit" className={botao.primario}>
              Revisar erros
            </button>
          </form>
          <Link href="/simulado" className={botao.texto}>
            Voltar aos simulados
          </Link>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        <div className={cartao}>
          <h2 className={titulo.secao}>Por disciplina</h2>
          <table className="mt-4 w-full text-left text-[15px]">
            <thead className="text-sm text-pedra">
              <tr>
                <th className="pb-2 font-medium">Disciplina</th>
                <th className="pb-2 text-right font-medium">Certos</th>
                <th className="pb-2 text-right font-medium">Errados</th>
                <th className="pb-2 text-right font-medium">Brancos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {r.porDisciplina.map((d) => (
                <tr key={d.disciplina}>
                  <td className="py-2">{d.nome}</td>
                  <td className="py-2 text-right tabular-nums">{d.certos}</td>
                  <td className="py-2 text-right tabular-nums">{d.errados}</td>
                  <td className="py-2 text-right tabular-nums">{d.brancos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={cartao}>
          <h2 className={titulo.secao}>Análise de dúvida</h2>
          {r.duvidas.length === 0 ? (
            <p className={`${textoApoio} mt-3`}>Você não marcou nenhum item com dúvida.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-4">
              {r.duvidas.map((d) => (
                <li key={d.disciplina}>
                  <p className="flex justify-between gap-4 font-medium">
                    <span>{d.nome}</span>
                    <span className="tabular-nums">
                      saldo {d.saldo > 0 ? `+${d.saldo}` : d.saldo} em {d.itens}
                    </span>
                  </p>
                  <p className="text-sm text-grafite">{RECOMENDACAO[d.recomendacao]}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <h2 className={`${titulo.secao} mt-12 mb-4`}>Correção item a item</h2>
      <ListaCorrecao itens={itens} />
    </>
  );
}
```

- [ ] **Step 4: Verificar e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/app/\(app\)/simulado src/components/simulado
git commit -m "feat(ui): simulado completo cronometrado com resultado e análise de dúvida"
```

---

### Task 12: Painel

**Files:**
- Create: `src/components/painel/evolucao.tsx`, `src/components/painel/tendencia.tsx`, `src/app/(app)/painel/page.tsx`

Conteúdo: dias até a prova; evolução das notas de cada prova nos simulados entregues com a linha do corte (barras simples, coral abaixo do corte); 10 tópicos prioritários com "treinar"; desempenho por disciplina (`<details>`) e tópico com aproveitamento, brancos, respostas, tendência de 4 semanas e prioridade. Para moderadores: custo de IA do mês por finalidade, pedidos de geração em aberto, últimas falhas da fila e o link para a revisão de itens com a contagem. Se a chave secreta faltar, o bloco de custo mostra "Indisponível" em vez de quebrar a página.

- [ ] **Step 1: Componentes**

`src/components/painel/evolucao.tsx`:

```tsx
import { nota } from "@/lib/formato";

export interface PontoEvolucao {
  id: string;
  rotulo: string;
  nota: number;
}

// Notas de uma prova nos simulados entregues, com a linha do corte. Barras simples, sem trilho de fundo.
export function Evolucao({ nome, maximo, corte, pontos }: { nome: string; maximo: number; corte: number | null; pontos: PontoEvolucao[] }) {
  const altura = (v: number) => `${Math.max(2, (Math.max(0, v) / maximo) * 100)}%`;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex justify-between gap-4 text-sm">
        <span className="font-medium">{nome}</span>
        {corte !== null && <span className="text-pedra">corte {corte}</span>}
      </figcaption>
      <div className="relative flex h-32 items-end gap-2 border-b border-borda-forte">
        {corte !== null && (
          <div className="absolute inset-x-0 border-t border-dashed border-coral" style={{ bottom: altura(corte) }} aria-hidden />
        )}
        {pontos.map((p) => (
          <div key={p.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs tabular-nums text-grafite">{nota(p.nota)}</span>
            <div
              className={`w-full max-w-10 rounded-t ${corte !== null && p.nota < corte ? "bg-coral/70" : "bg-azul"}`}
              style={{ height: altura(p.nota) }}
              title={`${p.rotulo}: ${nota(p.nota)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {pontos.map((p) => (
          <span key={p.id} className="flex-1 text-center text-xs text-pedra">
            {p.rotulo}
          </span>
        ))}
      </div>
    </figure>
  );
}
```

`src/components/painel/tendencia.tsx`:

```tsx
import { aproveitamento } from "@/lib/formato";

// Quatro semanas de aproveitamento líquido (−1 a 1) em barrinhas a partir de uma linha de base.
export function Tendencia({ valores }: { valores: (number | null)[] }) {
  const descricao = valores.map((v, i) => `semana ${i + 1}: ${v === null ? "sem respostas" : aproveitamento(v)}`).join("; ");
  return (
    <span className="inline-flex h-7 items-center gap-1" role="img" aria-label={descricao}>
      {valores.map((v, i) => (
        <span key={i} className="relative flex h-full w-2.5 flex-col justify-center">
          {v === null ? (
            <span className="h-px w-2.5 bg-black/20" />
          ) : (
            <span
              className={`absolute left-0 w-2.5 rounded-[2px] ${v >= 0 ? "bottom-1/2 bg-azul" : "top-1/2 bg-coral"}`}
              style={{ height: `${Math.max(6, Math.abs(v) * 50)}%` }}
            />
          )}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 2: Página**

`src/app/(app)/painel/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { calcularPrioridades } from "@/core";
import { contarFilaItens, criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { custoIaDoMes, situacaoDaFila } from "@/db/repositorios/moderacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { diasAte, tabelaDesempenho } from "@/estudo/painel";
import { Evolucao } from "@/components/painel/evolucao";
import { Tendencia } from "@/components/painel/tendencia";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, data, dataDaProva, dataEHora, nota, percentual, plural } from "@/lib/formato";
import { treinarTopicos } from "../acoes";
import { exigirCargo } from "../contexto";

async function dadosDoModerador(agora: Date) {
  try {
    const db = criarClienteServico();
    const [custos, fila] = await Promise.all([custoIaDoMes(db, agora), situacaoDaFila(db)]);
    return { custos, fila, erro: null };
  } catch (e) {
    return { custos: [], fila: null, erro: e instanceof Error ? e.message : String(e) };
  }
}

export default async function Painel() {
  const { db, cargo, moderador } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const agora = new Date();
  const [estrutura, historico, simulados] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 10 }),
  ]);
  const prioridades = calcularPrioridades(estrutura.topicosAlvo, historico, agora);
  const tabela = tabelaDesempenho(estrutura.topicosAlvo, prioridades, historico, agora);
  const entregues = simulados
    .flatMap((s) => (s.resultado?.tipo === "completo" ? [{ id: s.id, em: s.finalizadaEm!, r: s.resultado }] : []))
    .reverse();
  const mod = moderador ? await dadosDoModerador(agora) : null;
  const filaItens = moderador ? await contarFilaItens(db) : 0;
  const dias = diasAte(estrutura.concurso.dataProva, agora);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className={titulo.pagina}>Painel</h1>
        <p className={textoApoio}>
          {estrutura.concurso.nome}, {estrutura.cargo.nome}. Faltam {plural(dias, "dia", "dias")} para a prova, em{" "}
          {dataDaProva(estrutura.concurso.dataProva)}.
        </p>
      </div>

      <section className={`${cartao} mt-8`}>
        <h2 className={titulo.secao}>Simulados</h2>
        {entregues.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>
            Entregue um <Link href="/simulado" className="text-azul hover:underline">simulado completo</Link> para ver a
            evolução em relação aos cortes.
          </p>
        ) : (
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            {estrutura.provas.map((p) => (
              <Evolucao
                key={p.slug}
                nome={p.nome}
                maximo={p.nItens}
                corte={entregues.at(-1)!.r.provas.find((x) => x.slug === p.slug)?.corte ?? null}
                pontos={entregues.map((e) => ({
                  id: e.id,
                  rotulo: data(e.em),
                  nota: e.r.provas.find((x) => x.slug === p.slug)?.nota ?? 0,
                }))}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className={cartao}>
          <h2 className={titulo.secao}>10 tópicos prioritários</h2>
          <ol className="mt-4 flex flex-col">
            {prioridades.slice(0, 10).map((t, i) => (
              <li key={t.chave} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-sm tabular-nums text-pedra">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t.titulo}</span>
                  <span className="block text-sm text-pedra">
                    {estrutura.disciplinas[t.disciplina]} · {t.n === 0 ? "nunca praticado" : aproveitamento(t.aproveitamento)}
                  </span>
                </span>
                <form action={treinarTopicos}>
                  <input type="hidden" name="canonico" value={t.canonico} />
                  <input type="hidden" name="total" value="10" />
                  <button type="submit" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ol>
        </div>

        <div className={cartao}>
          <h2 className={titulo.secao}>Desempenho por disciplina</h2>
          <div className="mt-4 divide-y divide-borda">
            {tabela.map((d) => (
              <details key={d.disciplina}>
                <summary className="flex cursor-pointer list-none items-center gap-4 py-3">
                  <span className="flex-1 font-medium">{estrutura.disciplinas[d.disciplina]}</span>
                  <span className="text-sm tabular-nums text-grafite">
                    {d.n === 0 ? "sem respostas" : `${aproveitamento(d.aproveitamento)} · ${plural(d.n, "resposta", "respostas")}`}
                  </span>
                </summary>
                <div className="overflow-x-auto pb-4">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="text-pedra">
                      <tr>
                        <th className="py-1 font-medium">Tópico</th>
                        <th className="py-1 text-right font-medium">Aproveit.</th>
                        <th className="py-1 text-right font-medium">Brancos</th>
                        <th className="py-1 text-right font-medium">Resp.</th>
                        <th className="py-1 pl-4 font-medium">4 semanas</th>
                        <th className="py-1 text-right font-medium">Prioridade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topicos.map((t) => (
                        <tr key={`${t.disciplina}:${t.codigo}`}>
                          <td className="max-w-[260px] truncate py-1.5" title={t.titulo}>
                            <span className="text-pedra">{t.codigo}</span> {t.titulo}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{t.n ? aproveitamento(t.aproveitamento) : "-"}</td>
                          <td className="py-1.5 text-right tabular-nums">{t.n ? percentual(t.taxaBrancos) : "-"}</td>
                          <td className="py-1.5 text-right tabular-nums">{t.n}</td>
                          <td className="py-1.5 pl-4">
                            <Tendencia valores={t.tendencia} />
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{nota(t.prioridade)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {mod && (
        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className={cartao}>
            <h2 className={titulo.secao}>Custo de IA no mês</h2>
            {mod.erro ? (
              <p className="mt-3 text-sm text-vermelho">Indisponível: {mod.erro}</p>
            ) : mod.custos.length === 0 ? (
              <p className={`${textoApoio} mt-3`}>Nenhuma chamada neste mês.</p>
            ) : (
              <table className="mt-4 w-full text-left text-[15px]">
                <tbody className="divide-y divide-borda">
                  {mod.custos.map((c) => (
                    <tr key={c.finalidade}>
                      <td className="py-2">{c.finalidade}</td>
                      <td className="py-2 text-right text-pedra">{plural(c.chamadas, "chamada", "chamadas")}</td>
                      <td className="py-2 text-right tabular-nums">US$ {c.custoUsd.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-medium">Total</td>
                    <td />
                    <td className="py-2 text-right font-medium tabular-nums">
                      US$ {mod.custos.reduce((s, c) => s + c.custoUsd, 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
          <div className={`${cartao} flex flex-col gap-4`}>
            <h2 className={titulo.secao}>Geração e revisão</h2>
            {mod.fila && (
              <p className={textoApoio}>
                {plural(mod.fila.abertos, "pedido de geração em aberto", "pedidos de geração em aberto")}.
              </p>
            )}
            {mod.fila && mod.fila.falhas.length > 0 && (
              <ul className="flex flex-col gap-2 text-sm">
                {mod.fila.falhas.map((f) => (
                  <li key={f.id} className="rounded-lg bg-vermelho-claro px-3 py-2 text-[#8f1c0c]">
                    {f.canonico} falhou em {dataEHora(f.em)}: {f.erro}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/itens" className={`${botao.secundario} self-start`}>
              Revisar itens ({filaItens})
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verificar e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/app/\(app\)/painel src/components/painel
git commit -m "feat(ui): painel de desempenho com evolução, prioridades e custos"
```

---

### Task 13: Fila de revisão de itens e documentação

**Files:**
- Create: `src/app/(app)/itens/acoes.ts`, `src/app/(app)/itens/page.tsx`
- Modify: `.env.example`, `docs/deploy.md`

A página só existe para moderadores (`notFound()` para os demais). Mostra suspeitos primeiro, depois discordâncias; gabarito e justificativa do gerador lado a lado com os do validador; citação; denúncias. Decisões: "Aprovar como está", "Aprovar com gabarito Certo/Errado" (inverte e adota a justificativa do validador) e "Descartar".

- [ ] **Step 1: Ação e página**

`src/app/(app)/itens/acoes.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { moderarItem, type Decisao } from "@/db/repositorios/moderacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { contextoDoUsuario } from "../contexto";

const DECISOES: Decisao[] = ["aprovar", "descartar", "inverter"];

export async function decidir(formData: FormData) {
  const { user, moderador } = await contextoDoUsuario();
  if (!moderador) throw new Error("Apenas moderadores podem decidir itens.");
  const itemId = String(formData.get("item") ?? "");
  const decisao = String(formData.get("decisao") ?? "") as Decisao;
  if (!itemId || !DECISOES.includes(decisao)) throw new Error("Decisão inválida.");
  await moderarItem(criarClienteServico(), itemId, decisao, user.email ?? user.id);
  revalidatePath("/itens");
}
```

`src/app/(app)/itens/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { filaRevisaoItens } from "@/db/repositorios/estudo";
import { Enunciado } from "@/components/sessao/enunciado";
import { nomeGabarito } from "@/components/sessao/feedback";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora } from "@/lib/formato";
import { contextoDoUsuario } from "../contexto";
import { decidir } from "./acoes";

interface Validacao {
  gabarito_validador?: string | null;
  justificativa_validador?: string | null;
  mesmo_provedor?: boolean;
  gerador?: { provedor?: string };
  validador?: { provedor?: string };
  denuncias?: { motivo?: string; em?: string }[];
}

export default async function FilaDeItens() {
  const { db, moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const itens = await filaRevisaoItens(db);

  return (
    <>
      <h1 className={titulo.pagina}>Revisão de itens</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens em que as duas IAs discordaram e itens marcados como suspeitos. Nenhum deles aparece nas sessões até a sua decisão.
      </p>

      {itens.length === 0 ? (
        <p className={`${cartao} mt-8 text-grafite`}>Fila vazia. Bom sinal.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {itens.map((i) => {
            const v = (i.validacao ?? {}) as Validacao;
            return (
              <li key={i.id} className={`${cartao} flex flex-col gap-6`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={i.status === "suspeito" ? pilula.erro : pilula.alerta}>
                    {i.status === "suspeito" ? "Suspeito" : v.mesmo_provedor ? "Validado pelo mesmo provedor" : "IAs discordaram"}
                  </span>
                  <span className="text-sm text-pedra">{dataEHora(i.criadoEm)}</span>
                </div>
                <Enunciado textoBase={i.textoBase} enunciado={i.enunciado} topicos={i.topicos} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-papel p-4">
                    <p className="text-sm font-medium">
                      Gerador{v.gerador?.provedor ? ` (${v.gerador.provedor})` : ""}: {nomeGabarito(i.gabarito)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-grafite">{i.justificativa}</p>
                  </div>
                  <div className="rounded-lg bg-papel p-4">
                    <p className="text-sm font-medium">
                      Validador{v.validador?.provedor ? ` (${v.validador.provedor})` : ""}:{" "}
                      {v.gabarito_validador ? nomeGabarito(v.gabarito_validador) : "sem julgamento"}
                    </p>
                    {v.justificativa_validador && (
                      <p className="mt-2 text-sm leading-relaxed text-grafite">{v.justificativa_validador}</p>
                    )}
                  </div>
                </div>
                {i.citacao && (
                  <blockquote className="border-l-2 border-borda-forte pl-4 text-sm leading-relaxed text-black/70">
                    {i.citacao}
                    {i.fonte && <span className="mt-1 block text-pedra">{i.fonte}</span>}
                  </blockquote>
                )}
                {v.denuncias && v.denuncias.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {v.denuncias.map((d, k) => (
                      <li key={k} className="text-[#8f1c0c]">
                        Denúncia{d.em ? ` em ${dataEHora(d.em)}` : ""}: {d.motivo || "sem motivo"}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={decidir} className="flex flex-wrap gap-2">
                  <input type="hidden" name="item" value={i.id} />
                  <button type="submit" name="decisao" value="aprovar" className={botao.contorno}>
                    Aprovar como está
                  </button>
                  <button type="submit" name="decisao" value="inverter" className={botao.contorno}>
                    Aprovar com gabarito {i.gabarito === "C" ? "Errado" : "Certo"}
                  </button>
                  <button type="submit" name="decisao" value="descartar" className={`${botao.texto} text-vermelho`}>
                    Descartar
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
```

- [ ] **Step 2: Documentação**

Acrescente ao fim de `.env.example`:

```
# Quem revisa itens e vê custos de IA (separados por vírgula). Vazio: todos de AUTH_EMAILS_PERMITIDOS.
MODERADORES_EMAILS=
```

Acrescente ao fim de `docs/deploy.md`:

````markdown
## Telas de estudo

- **Início:** "Estudar agora" monta 20 itens pelo motor de foco (70% pontos fracos, 20% revisão, 10% manutenção). Se algum dos 10 tópicos prioritários tiver menos de 10 itens novos, a sessão pede geração (até 3 pedidos em aberto por pessoa, 5 itens cada). Os pedidos só andam com o worker agendado e as chaves de IA configuradas.
- **Treinar:** escolha tópicos do edital e a quantidade (10, 20 ou 30).
- **Simulado:** só as provas objetivas, na distribuição do edital, com 1h a menos que a duração total (a discursiva entra com o corretor de redação). A correção sai na entrega; erros e brancos vão para a revisão espaçada.
- **Painel:** contagem regressiva, evolução nos simulados contra os cortes, desempenho por disciplina e tópico, 10 tópicos prioritários. Moderadores veem também o custo de IA do mês, a fila de geração e o link para a revisão de itens.
- **Itens:** fila de itens em que as IAs discordaram ou que alguém marcou como suspeito. Aprovar, aprovar com o gabarito invertido ou descartar. Usa `SUPABASE_SECRET_KEY`.

Variável opcional: `MODERADORES_EMAILS` (Vercel, produção e preview). Sem ela, todos os e-mails de `AUTH_EMAILS_PERMITIDOS` moderam.
````

- [ ] **Step 3: Verificar e commit**

Run: `npm run typecheck && npm run lint`

```bash
git add src/app/\(app\)/itens .env.example docs/deploy.md
git commit -m "feat(ui): fila de revisão de itens para moderadores e guia das telas"
```

---

### Task 14: Verificação final

- [ ] **Step 1: Tudo verde**

Run: `npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`
Expected: typecheck e lint limpos; 155 testes unitários e 31 de banco passando; build com as rotas `/`, `/treinar`, `/simulado`, `/simulado/[id]`, `/simulado/[id]/resultado`, `/sessao/[id]`, `/painel`, `/itens`.

- [ ] **Step 2: Roteiro manual no preview da Vercel (controlador, com itens gerados)**

1. Início mostra a contagem regressiva e "Onde focar"; trocar de cargo pelas pílulas.
2. "Começar sessão" → responder com C/E/B/D pelo teclado; errar um item e conferir a justificativa; recarregar no meio e ver a sessão retomar no primeiro item sem resposta; terminar e ver o resumo.
3. "Item com problema?" → marcar; o item aparece em `/itens`; decidir.
4. Treinar → escolher 2 tópicos, 10 itens.
5. Simulado → com itens suficientes, começar, marcar alguns, recarregar (cronômetro continua), entregar, conferir notas, cortes e análise de dúvida; os errados aparecem em "Revisão de erros" no dia seguinte.
6. Painel → evolução com o simulado entregue, tabela por disciplina, custos (moderador).

Fica para um plano seguinte: testes E2E com Playwright (exigem sessão de teste no Supabase Auth) e modo escuro.

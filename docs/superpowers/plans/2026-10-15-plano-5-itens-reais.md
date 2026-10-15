# Plano 5 — Importação de itens reais — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a entrega 8 da spec: a tela `/importar`, em que o moderador cola o texto de uma prova anterior da banca e o gabarito oficial, confere a leitura, confirma os tópicos canônicos sugeridos pela IA e grava os itens como `origem = real`, `status = aprovado`; e a flag de modo produto que tira os itens reais das sessões sem tirá-los da referência de estilo do gerador.

**Architecture:** `src/importacao/` concentra a lógica, sem I/O: `prova.ts` e `gabarito.ts` leem o texto colado, `previa.ts` cruza os dois (roda no navegador, sem ida ao servidor), `topicos.ts` pede a sugestão de tópicos a um `ProvedorIa` (testado com o provedor falso) e `gravacao.ts` valida o envio da tela e monta o lote com o mesmo hash normalizado do pipeline. A migração `0008_itens_reais.sql` cria `itens_importar_reais(jsonb)`, que grava textos-base, itens e tópicos numa transação, deduplicando pelo hash; ela só executa como `service_role`, e a Server Action confere o moderador antes de usar a chave secreta (o mesmo modelo da moderação do Plano 4). A mesma migração faz `estudo_candidatos` devolver a origem de cada item; o repositório de estudo filtra os reais quando `ITENS_REAIS_VISIVEIS=false`. A tela é um Client Component em quatro etapas que chama duas Server Actions (`sugerir` e `gravar`).

**Tech Stack:** Next.js 16.4 (App Router, Server Actions, `maxDuration` na página), React 19.3, Tailwind v4 (tokens do Plano 4), `@phosphor-icons/react` 2.1.10, Supabase (`@supabase/ssr` e cliente de serviço), Zod (`zod/v4` nos schemas novos e de IA), SDK da Anthropic via `criarProvedores`, Vitest, Postgres local para testes de banco.

**Especificação:** `docs/superpowers/specs/2026-10-14-nucleo-simulador-design.md` (§5.3 e §9 item 8). **UI:** `docs/design/DESIGN.md`.

## Global Constraints

- Leia `AGENTS.md`: o Next.js 16 tem APIs novas; consulte `node_modules/next/dist/docs/01-app/` (em especial `01-getting-started/07-mutating-data.md` e `03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`) antes de escrever código Next.
- Spec §5.3, literal: "Tela de importação: colar texto-base e itens com gabarito oficial e informar a prova de origem. A IA sugere tópicos canônicos e o usuário confirma. Os itens entram como `origem=real`, `aprovado`. Em modo produto (flag de configuração), itens reais deixam de ser exibidos a usuários e servem apenas como referência de estilo."
- Banca do piloto: Cebraspe, itens Certo/Errado. Itens anulados (X) nunca são gravados.
- A sugestão de tópicos é restrita aos canônicos do concurso; o moderador confirma ou troca antes de gravar; todo item gravado tem ao menos um tópico.
- Testes automatizados nunca chamam IA real (spec §8). A sugestão é testada com `criarProvedorFalso`.
- Deduplicação pelo `hash_normalizado` de `src/pipeline/hash.ts` (o mesmo do gerador): um item real igual a um já gravado não se repete.
- Funções SQL: sem `DROP`, sem `DELETE ... USING`, pequenas, `search_path = ''`. `itens_importar_reais` tem `EXECUTE` só para `service_role`; quem chama é uma Server Action que confere `ehModerador`.
- `ITENS_REAIS_VISIVEIS` vazia ou `true`: itens reais nas sessões (uso pessoal, padrão). `false`, `0`, `nao`, `não` ou `off`: modo produto.
- UI do Plano 4: um só botão azul cheio por tela (por etapa), cartões sem sombra, `rounded-xl`/`rounded-lg`, foco visível, erros com `role="alert"`, cor nunca é o único sinal, português direto e sem travessão como enfeite.
- Nada de segredo no repositório. `SUPABASE_SECRET_KEY` e as chaves de IA só em Server Actions de moderador.
- Agentes não fazem push, não mexem em `.env.local`, não aplicam migrações no Supabase remoto, não chamam IA real e não editam `src/db/types.ts` à mão (a Task 2 é do controlador).
- Mensagens de commit terminam com as linhas de atribuição da sessão.

## Decisões de design

- **Onde a flag vale:** na camada TS, em `criarRepositorioEstudo` (`filtrarCandidatos`). `estudo_candidatos` passa a devolver `origem` (mesma assinatura, `create or replace`), e o repositório tira os reais quando a flag está desligada. Todas as sessões (Estudar agora, treino por tópico, revisão de erros, simulado completo) e a contagem de "itens novos" do `/treinar` partem de `candidatos`, então um ponto só cobre tudo. O gerador continua a ler os reais por `exemplosReais` (cliente de serviço), sem mudança. Uma alternativa em SQL exigiria um parâmetro novo em `estudo_candidatos`, o que cria uma segunda função sobrecarregada (não dá para trocar a assinatura sem `DROP`), e a env da Vercel não chega ao banco.
- **Limite conhecido da flag:** as tabelas de conteúdo têm leitura liberada para autenticados (RLS da 0003), então em modo produto alguém com a API ainda conseguiria ler os itens reais diretamente. Fechar isso exige mudar a política de `itens` e de `textos_base` e fica para quando houver modo produto de fato (multiusuário).
- **Permissão da gravação:** `itens_importar_reais` é `security invoker` com `EXECUTE` só para `service_role`. A lista de moderadores vive na env (`MODERADORES_EMAILS`), que o banco não conhece; por isso a checagem fica na Server Action, como em `moderarItem`.
- **Leitura no navegador:** `prova.ts`, `gabarito.ts` e `previa.ts` são puros e não importam `node:crypto`; a prévia é instantânea. O hash é calculado só no servidor (`gravacao.ts`), que revalida tudo o que a tela envia.
- **Sugestão em paralelo:** lotes de até 25 itens, sem separar item do texto-base, chamados em paralelo (`Promise.all`) para caber no `maxDuration = 300` da página. A lista de tópicos vai no `sistema`, que o provedor Claude marca com `cache_control`.
- **Leitura da prova:** a numeração de linhas dos textos do Cebraspe (1, 4, 7...) e números no começo de linhas quebradas confundiriam um parser ingênuo. `analisarProva` escolhe a sequência crescente de números de maior pontuação (+1 por item, −0,5 por número que falta), o que aceita saltos reais e ignora a numeração de linhas.

## Estrutura de arquivos

```
supabase/migrations/0008_itens_reais.sql   # itens_importar_reais + estudo_candidatos com origem
src/db/itens-reais.dbtest.ts
src/db/estudo.dbtest.ts                    # expectativa de estudo_candidatos com origem
src/importacao/prova.ts                    # texto colado → grupos (texto-base + itens numerados)
src/importacao/gabarito.ts                 # gabarito oficial → número → C/E/X
src/importacao/previa.ts                   # cruzamento, inconsistências, faixas de números
src/importacao/gravacao.ts                 # schemas do envio da tela, lote da função SQL com hash
src/importacao/topicos.ts                  # opções do concurso, prompts, sugestão por IA
src/lib/itens-reais.ts                     # flag ITENS_REAIS_VISIVEIS
src/db/repositorios/estudo.ts              # filtrarCandidatos e opção itensReais
src/db/repositorios/importacao.ts          # dados do concurso, gravação (chave secreta), uso de IA
src/app/(app)/importar/{acoes.ts,page.tsx}
src/components/importar/{assistente,previa-prova,escolha-topicos}.tsx
src/app/(app)/layout.tsx                   # link "Importar" para moderadores
.env.example, docs/deploy.md
```

---

### Task 1: Migração da importação

**Files:**
- Create: `supabase/migrations/0008_itens_reais.sql`
- Test: `src/db/itens-reais.dbtest.ts`
- Modify: `src/db/estudo.dbtest.ts` (expectativa de `estudo_candidatos`)

**Interfaces:**
- Produces (SQL):
  ```
  itens_importar_reais(p_prova jsonb) returns jsonb
    -- entrada: { banca, prova_origem, importado_por,
    --            grupos: [{ texto_base, itens: [{ numero, enunciado, gabarito, hash, canonicos[] }] }] }
    -- saída:   { "gravados": n, "duplicados": [numeros] }
  estudo_candidatos(p_cargo uuid) returns jsonb   -- agora [{ id, textoBaseId, canonicos[], visto, origem }]
  ```

- [ ] **Step 1: Subir o Postgres de teste**

Run: `npm run db:test:start`
Expected: `Postgres de teste: postgresql://postgres@127.0.0.1:54329/postgres`

- [ ] **Step 2: Escrever o teste da importação**

`src/db/itens-reais.dbtest.ts`:

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";

let client: Client;
let destruir: () => Promise<void>;

async function valor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

const item = (numero: number, hash: string, canonicos = ["portugues/crase"], gabarito = "C") => ({
  numero,
  enunciado: `Item ${numero}`,
  gabarito,
  hash,
  canonicos,
});

const prova = (grupos: { texto_base: string | null; itens: ReturnType<typeof item>[] }[]) => ({
  banca: "cebraspe",
  prova_origem: "CBM-AL 2021 Soldado",
  importado_por: "ana@x.com",
  grupos,
});

const importar = (p: unknown) => valor<{ gravados: number; duplicados: number[] }>("select public.itens_importar_reais($1)", [p]);

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência');
  `);
});

afterAll(async () => {
  await destruir();
});

beforeEach(async () => {
  await client.query("delete from public.item_topicos; delete from public.itens; delete from public.textos_base;");
});

describe("itens_importar_reais", () => {
  it("grava texto-base e itens como reais aprovados, com prova de origem, gabarito e tópicos", async () => {
    const r = await importar(
      prova([
        { texto_base: "Texto CB1A1\nJulgue os itens.", itens: [item(1, "h1"), item(2, "h2", ["portugues/crase", "portugues/regencia"], "E")] },
        { texto_base: null, itens: [item(3, "h3", ["portugues/regencia"])] },
      ]),
    );
    expect(r).toEqual({ gravados: 3, duplicados: [] });

    const itens = await client.query(
      `select i.enunciado, i.gabarito, i.origem, i.status, i.prova_origem, i.formato, t.conteudo, t.origem as origem_texto,
              i.validacao->'importacao'->>'numero' as numero, i.validacao->'importacao'->>'por' as por
       from public.itens i left join public.textos_base t on t.id = i.texto_base_id order by i.enunciado`,
    );
    expect(itens.rows).toEqual([
      { enunciado: "Item 1", gabarito: "C", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: "Texto CB1A1\nJulgue os itens.", origem_texto: "real", numero: "1", por: "ana@x.com" },
      { enunciado: "Item 2", gabarito: "E", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: "Texto CB1A1\nJulgue os itens.", origem_texto: "real", numero: "2", por: "ana@x.com" },
      { enunciado: "Item 3", gabarito: "C", origem: "real", status: "aprovado", prova_origem: "CBM-AL 2021 Soldado", formato: "certo_errado",
        conteudo: null, origem_texto: null, numero: "3", por: "ana@x.com" },
    ]);
    expect(await valor<number>("select count(*)::int from public.item_topicos")).toBe(4);
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(1);
  });

  it("conta duplicados pelo hash e não grava texto-base de grupo sem item novo", async () => {
    await importar(prova([{ texto_base: "Texto A", itens: [item(1, "h1"), item(2, "h2")] }]));
    const r = await importar(
      prova([
        { texto_base: "Texto A", itens: [item(1, "h1"), item(2, "h2")] },
        { texto_base: "Texto B", itens: [item(3, "h2"), item(4, "h4")] },
      ]),
    );
    expect(r).toEqual({ gravados: 1, duplicados: [1, 2, 3] });
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(2);
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(3);
  });

  it("não grava nada quando um tópico é desconhecido", async () => {
    await expect(importar(prova([{ texto_base: "Texto", itens: [item(1, "h1"), item(2, "h2", ["portugues/inexistente"])] }]))).rejects.toThrow(
      /tópico canônico desconhecido: portugues\/inexistente/,
    );
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(0);
    expect(await valor<number>("select count(*)::int from public.textos_base")).toBe(0);
  });

  it("exige banca conhecida, prova de origem e gabarito Certo/Errado", async () => {
    await expect(importar({ ...prova([]), banca: "x" })).rejects.toThrow(/banca desconhecida: x/);
    await expect(importar({ ...prova([]), prova_origem: "  " })).rejects.toThrow(/prova de origem obrigatória/);
    await expect(importar(prova([{ texto_base: null, itens: [item(1, "h1", ["portugues/crase"], "X")] }]))).rejects.toThrow(
      /itens_gabarito_formato/,
    );
  });

  it("usuários da API não executam a importação", async () => {
    await expect(
      comoUsuario(client, "00000000-0000-0000-0000-00000000000a", () => importar(prova([]))),
    ).rejects.toThrow(/permission denied for function itens_importar_reais/);
  });
});
```

- [ ] **Step 3: Acrescentar a origem à expectativa de `estudo_candidatos`**

Em `src/db/estudo.dbtest.ts`, no teste `"lista só itens aprovados de tópicos do cargo, com os canônicos e se a pessoa já viu"`, troque as duas linhas do `toEqual` por:

```ts
      { id: item.crase, textoBaseId: null, canonicos: ["portugues/crase"], visto: true, origem: "ia" },
      { id: item.regencia, textoBaseId: null, canonicos: ["portugues/crase", "portugues/regencia"], visto: false, origem: "ia" },
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `npm run test:db -- src/db/itens-reais.dbtest.ts src/db/estudo.dbtest.ts`
Expected: FAIL com `function public.itens_importar_reais(unknown) does not exist` e, em `estudo_candidatos`, `expected [ { …(4) }, { …(4) } ] to deeply equal [ { …(5) }, { …(5) } ]`.

- [ ] **Step 5: Escrever a migração**

`supabase/migrations/0008_itens_reais.sql`:

```sql
-- Importação de itens reais (provas anteriores da banca) e origem dos candidatos das sessões.
-- Sem DROP e sem DELETE: o MCP do Supabase pede confirmação manual para SQL que julga destrutivo.

-- Grava uma prova importada: { banca, prova_origem, importado_por,
--   grupos: [{ texto_base, itens: [{ numero, enunciado, gabarito, hash, canonicos[] }] }] }.
-- Itens entram como origem 'real' e status 'aprovado'. Hash já existente conta como duplicado; o
-- texto-base só é gravado quando algum item do grupo é novo. Tópico desconhecido aborta tudo.
-- Devolve { "gravados": n, "duplicados": [numeros] }.
create or replace function public.itens_importar_reais(p_prova jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_origem text := nullif(trim(p_prova->>'prova_origem'), '');
  v_texto uuid;
  v_item uuid;
  v_gravados integer := 0;
  v_duplicados integer[] := '{}';
  v_desconhecido text;
  g jsonb;
  i jsonb;
begin
  select id into v_banca from public.bancas where slug = p_prova->>'banca';
  if v_banca is null then
    raise exception 'banca desconhecida: %', p_prova->>'banca';
  end if;
  if v_origem is null then
    raise exception 'prova de origem obrigatória';
  end if;

  select c into v_desconhecido
  from jsonb_array_elements(p_prova->'grupos') grupo,
       jsonb_array_elements(grupo->'itens') item,
       jsonb_array_elements_text(item->'canonicos') c
  where not exists (select 1 from public.topicos_canonicos tc where tc.slug = c)
  limit 1;
  if v_desconhecido is not null then
    raise exception 'tópico canônico desconhecido: %', v_desconhecido;
  end if;

  for g in select value from jsonb_array_elements(p_prova->'grupos') loop
    v_texto := null;
    if nullif(g->>'texto_base', '') is not null and exists (
      select 1 from jsonb_array_elements(g->'itens') x
      where not exists (select 1 from public.itens where hash_normalizado = x->>'hash')
    ) then
      insert into public.textos_base (conteudo, origem) values (g->>'texto_base', 'real')
      returning id into v_texto;
    end if;

    for i in select value from jsonb_array_elements(g->'itens') loop
      v_item := null;
      insert into public.itens (banca_id, formato, texto_base_id, enunciado, gabarito, origem, prova_origem,
                                status, hash_normalizado, validacao)
      values (
        v_banca, 'certo_errado', v_texto, i->>'enunciado', i->>'gabarito', 'real', v_origem, 'aprovado', i->>'hash',
        jsonb_build_object('importacao', jsonb_build_object(
          'numero', (i->>'numero')::integer, 'por', p_prova->>'importado_por', 'em', now()
        ))
      )
      on conflict (hash_normalizado) do nothing
      returning id into v_item;

      if v_item is null then
        v_duplicados := v_duplicados || (i->>'numero')::integer;
      else
        v_gravados := v_gravados + 1;
        insert into public.item_topicos (item_id, topico_canonico_id)
        select v_item, tc.id from public.topicos_canonicos tc
        where tc.slug in (select jsonb_array_elements_text(i->'canonicos'));
      end if;
    end loop;
  end loop;

  return jsonb_build_object('gravados', v_gravados, 'duplicados', to_jsonb(v_duplicados));
end
$$;

revoke all on function public.itens_importar_reais(jsonb) from public, anon, authenticated;
grant execute on function public.itens_importar_reais(jsonb) to service_role;

-- Igual à da 0007, agora com a origem de cada item: o app esconde os reais em modo produto
-- (ITENS_REAIS_VISIVEIS=false) sem deixar de usá-los como referência de estilo na geração.
create or replace function public.estudo_candidatos(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', x.id, 'textoBaseId', x.texto_base_id, 'canonicos', x.canonicos, 'visto', x.visto, 'origem', x.origem
  ) order by x.criado_em, x.id), '[]'::jsonb)
  from (
    select i.id, i.texto_base_id, i.criado_em, i.origem,
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
```

- [ ] **Step 6: Rodar todos os testes de banco**

Run: `npm run test:db`
Expected: PASS (36 testes; os de migração, seed, pipeline e estudo continuam verdes).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0008_itens_reais.sql src/db/itens-reais.dbtest.ts src/db/estudo.dbtest.ts
git commit -m "feat(db): importação de itens reais e origem dos candidatos"
```

---

### Task 2: Aplicar a migração no Supabase e atualizar os tipos (controlador)

Esta task é do controlador, não de um agente: mexe no banco remoto e em `src/db/types.ts`.

- [ ] **Step 1: Aplicar pelo MCP do Supabase**

`apply_migration` com `name: "0008_itens_reais"` e o conteúdo do arquivo. Se o MCP travar pedindo confirmação, aplicar as duas funções separadamente (cada `create or replace function` com o seu `revoke`/`grant`) via `execute_sql` e registrar a versão em `supabase_migrations.schema_migrations`, como nos Planos 3 e 4.

- [ ] **Step 2: Conferir**

`execute_sql`:

```sql
select proname, has_function_privilege('authenticated', oid, 'execute') as autenticado,
       has_function_privilege('service_role', oid, 'execute') as servico
from pg_proc where proname in ('itens_importar_reais', 'estudo_candidatos') order by 1;
```

Expected: `estudo_candidatos | true | true` e `itens_importar_reais | false | true`. E `select public.estudo_candidatos(id) -> 0 ? 'origem' from public.cargos limit 1;` devolve `true` (ou `null` se ainda não houver item aprovado).

- [ ] **Step 3: Regenerar os tipos**

`generate_typescript_types` e gravar em `src/db/types.ts` (removendo, se aparecerem, as funções `_teste_mcp*`). A entrada nova em `Functions` deve ser:

```ts
      itens_importar_reais: { Args: { p_prova: Json }; Returns: Json }
```

- [ ] **Step 4: Typecheck e commit**

Run: `npm run typecheck`
Expected: sem erros.

```bash
git add src/db/types.ts
git commit -m "chore(db): tipos com a importação de itens reais"
```

---

### Task 3: Leitura do texto da prova

**Files:**
- Create: `src/importacao/prova.ts`
- Test: `src/importacao/prova.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface ItemLido { numero: number; enunciado: string }
  interface GrupoLido { textoBase: string | null; itens: ItemLido[] }
  interface ProvaLida { grupos: GrupoLido[]; avisos: string[] }
  analisarProva(texto: string): ProvaLida   // puro, sem node:crypto (roda no navegador)
  ```

Regras:
- Início de item: `12 Texto`, `12. Texto`, `12) Texto`, `12 – Texto` ou o número sozinho na linha; números de 1 a 3 dígitos. Entre as linhas candidatas vale a sequência crescente de maior pontuação (+1 por item, −0,5 por número que falta), com empate para o antecessor mais próximo e a sequência que termina primeiro. Isso ignora a numeração de linhas dos textos (1, 4, 7...) e números no começo de linhas quebradas ("1988 assegura...").
- Linhas quebradas do item são juntadas com espaço. O item termina numa linha em branco ou quando a linha seguinte abre um comando ou título (`Texto`, `Julgue`, `Considerando`, `Com base`...) e o item já terminou em pontuação final. A regra é sensível à caixa: "do\ntexto CB1A1-I" continua o item.
- Tudo o que vem entre itens é o texto-base do grupo seguinte: parágrafos separados por `\n\n`; títulos curtos ("Texto CB1A1-I") e comandos ficam em parágrafo próprio. Itens seguidos sem texto entre eles ficam no mesmo grupo.
- Avisos: nenhum item, texto que sobrou depois do último item, saltos na numeração, item numerado sem texto.

- [ ] **Step 1: Escrever o teste**

`src/importacao/prova.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analisarProva } from "./prova";

const PORTUGUES = `Texto CB1A1-I

O Corpo de Bombeiros Militar tem por missão a proteção da vida,
do patrimônio e do meio ambiente.
Suas atividades incluem a prevenção e o combate a incêndios.

Internet: <www.exemplo.gov.br> (com adaptações).

Julgue os itens a seguir, relativos às ideias e aos aspectos linguísticos do texto CB1A1-I.

1 Infere-se do texto que a proteção do meio ambiente é uma das missões
do Corpo de Bombeiros Militar.
2 O emprego da vírgula após "vida" é obrigatório.
3 A forma verbal "incluem" concorda com "Suas atividades".

Julgue os itens subsequentes, a respeito de noções de informática.

4 No Windows 10, o atalho Ctrl + C copia o item selecionado.
5 O protocolo HTTPS dispensa o uso de certificados digitais.`;

describe("analisarProva", () => {
  it("separa textos-base e comandos dos itens numerados, juntando linhas quebradas", () => {
    const r = analisarProva(PORTUGUES);
    expect(r.avisos).toEqual([]);
    expect(r.grupos).toHaveLength(2);
    expect(r.grupos[0].textoBase).toBe(
      "Texto CB1A1-I\n\n" +
        "O Corpo de Bombeiros Militar tem por missão a proteção da vida, do patrimônio e do meio ambiente. Suas atividades incluem a prevenção e o combate a incêndios.\n\n" +
        "Internet: <www.exemplo.gov.br> (com adaptações).\n\n" +
        "Julgue os itens a seguir, relativos às ideias e aos aspectos linguísticos do texto CB1A1-I.",
    );
    expect(r.grupos[0].itens).toEqual([
      { numero: 1, enunciado: "Infere-se do texto que a proteção do meio ambiente é uma das missões do Corpo de Bombeiros Militar." },
      { numero: 2, enunciado: 'O emprego da vírgula após "vida" é obrigatório.' },
      { numero: 3, enunciado: 'A forma verbal "incluem" concorda com "Suas atividades".' },
    ]);
    expect(r.grupos[1]).toEqual({
      textoBase: "Julgue os itens subsequentes, a respeito de noções de informática.",
      itens: [
        { numero: 4, enunciado: "No Windows 10, o atalho Ctrl + C copia o item selecionado." },
        { numero: 5, enunciado: "O protocolo HTTPS dispensa o uso de certificados digitais." },
      ],
    });
  });

  it("aceita número com ponto, parêntese ou travessão e número sozinho na linha", () => {
    const r = analisarProva(`Julgue os itens.
31. Primeiro item.
32) Segundo item.
33 – Terceiro item.
34
Quarto item, com o número na linha de cima.`);
    expect(r.grupos[0].itens.map((i) => `${i.numero}:${i.enunciado}`)).toEqual([
      "31:Primeiro item.",
      "32:Segundo item.",
      "33:Terceiro item.",
      "34:Quarto item, com o número na linha de cima.",
    ]);
  });

  it("ignora a numeração de linhas do texto-base (1, 4, 7...)", () => {
    const r = analisarProva(`Texto CB2A1
1 A prevenção de incêndios começa
pela educação da população, que precisa
conhecer os riscos domésticos.
4 Extintores devem estar sinalizados
e desobstruídos.
Julgue os itens seguintes, relativos ao texto CB2A1.
1 O texto defende a educação preventiva.
2 Segundo o texto, extintores podem ficar obstruídos.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].textoBase).toContain("1 A prevenção de incêndios começa");
    expect(r.grupos[0].textoBase).toContain("4 Extintores devem estar sinalizados");
    expect(r.grupos[0].itens.map((i) => i.numero)).toEqual([1, 2]);
  });

  it("não confunde número no meio do enunciado ou ano no começo da linha com item", () => {
    const r = analisarProva(`Julgue os itens.
10 A Constituição Federal de
1988 assegura o direito de petição.
11 São necessários
3 servidores para compor a comissão, segundo a lei.`);
    expect(r.grupos[0].itens).toEqual([
      { numero: 10, enunciado: "A Constituição Federal de 1988 assegura o direito de petição." },
      { numero: 11, enunciado: "São necessários 3 servidores para compor a comissão, segundo a lei." },
    ]);
  });

  it("começa novo texto-base quando a linha abre um comando, mesmo sem linha em branco", () => {
    const r = analisarProva(`Julgue os itens a seguir.
1 Item de português.
Considerando a Lei n.º 5.346/1992, julgue os itens.
2 Item de legislação.`);
    expect(r.grupos.map((g) => g.textoBase)).toEqual(["Julgue os itens a seguir.", "Considerando a Lei n.º 5.346/1992, julgue os itens."]);
    expect(r.grupos[1].itens).toEqual([{ numero: 2, enunciado: "Item de legislação." }]);
  });

  it("continua o item quando a linha quebrada começa com palavra de comando em minúscula ou sem ponto antes", () => {
    const r = analisarProva(`Julgue os itens.
1 Infere-se do
texto CB1A1-I que a brigada chegou cedo.
2 Os dados constam da
Tabela 2 do relatório.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].itens.map((i) => i.enunciado)).toEqual([
      "Infere-se do texto CB1A1-I que a brigada chegou cedo.",
      "Os dados constam da Tabela 2 do relatório.",
    ]);
  });

  it("aceita itens sem texto-base e avisa os saltos na numeração", () => {
    const r = analisarProva(`1 Primeiro.
2 Segundo.
3 Terceiro.

6 Sexto.
7 Sétimo.
8 Oitavo.
10 Décimo.`);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0].textoBase).toBeNull();
    expect(r.grupos[0].itens.map((i) => i.numero)).toEqual([1, 2, 3, 6, 7, 8, 10]);
    expect(r.avisos).toEqual(["Faltam os itens 4 a 5 na sequência.", "Falta o item 9 na sequência."]);
  });

  it("normaliza quebras do Windows, espaços duros e espaços repetidos", () => {
    const r = analisarProva("Julgue os itens.\r\n1\u00a0Item   com\tespaços.\r\n2 Outro item.\r\n");
    expect(r.grupos[0].itens.map((i) => i.enunciado)).toEqual(["Item com espaços.", "Outro item."]);
  });

  it("avisa quando sobra texto depois do último item e quando não há itens", () => {
    const r = analisarProva(`1 Único item.

CEBRASPE – CBM-AL – Aplicação: 2021`);
    expect(r.grupos[0].itens).toHaveLength(1);
    expect(r.avisos).toEqual(['Texto depois do último item foi ignorado: "CEBRASPE – CBM-AL – Aplicação: 2021"']);
    expect(analisarProva("Só um texto, sem itens.")).toEqual({ grupos: [], avisos: ["Nenhum item numerado encontrado."] });
  });

  it("avisa item numerado sem texto", () => {
    const r = analisarProva("1 Primeiro.\n2");
    expect(r.grupos[0].itens).toEqual([
      { numero: 1, enunciado: "Primeiro." },
      { numero: 2, enunciado: "" },
    ]);
    expect(r.avisos).toEqual(["O item 2 está sem texto."]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/importacao/prova.test.ts`
Expected: FAIL (módulo `./prova` não existe).

- [ ] **Step 3: Implementar**

`src/importacao/prova.ts`:

```ts
// Leitura do texto de uma prova Certo/Errado colado do PDF (formato Cebraspe): textos-base e comandos
// ("Julgue os itens a seguir...") seguidos de itens numerados. Puro: roda no navegador e no servidor.

export interface ItemLido {
  numero: number;
  enunciado: string;
}

export interface GrupoLido {
  textoBase: string | null;
  itens: ItemLido[];
}

export interface ProvaLida {
  grupos: GrupoLido[];
  avisos: string[];
}

// "12 Texto", "12. Texto", "12) Texto", "12 – Texto" ou o número sozinho na linha.
const INICIO_ITEM = /^(\d{1,3})(?:\s*[.)\-–—:]\s*|\s+|$)(.*)$/;

// Linhas que abrem um novo texto-base mesmo sem linha em branco antes, quando o item anterior já
// terminou numa pontuação final. Sensível à caixa: "do\ntexto CB1A1" continua o item.
const INICIO_TEXTO =
  /^(Texto|Julgue|Considerando|Considere|Com base|Com rela[çc][ãa]o|Acerca|A respeito|No que se refere|No que concerne|Em rela[çc][ãa]o|Tendo como refer[êe]ncia|Tendo em vista|Nos itens|Cada um dos itens|Figura|Tabela|Quadro)\b/;
const FIM_DE_FRASE = /[.?!:)"”]$/;

// Título curto de texto-base, como "Texto CB1A1-I" ou "Figura 2".
const TITULO = /^(Texto|Figura|Tabela|Quadro)\b.{0,24}$/;

// Quanto cada item que falta numa sequência tira da pontuação. Com 0,5, pular um item ainda soma
// (+0,5) e a numeração de linhas dos textos (1, 4, 7...) não soma nada.
const PENALIDADE_POR_FALTANTE = 0.5;

interface Candidata {
  linha: number;
  numero: number;
  resto: string;
}

function normalizar(texto: string): string[] {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00a0\u2007\u202f\t]/g, " ")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((l) => l.replace(/ {2,}/g, " ").trim());
}

// Escolhe, entre as linhas que parecem início de item, a sequência crescente de maior pontuação:
// +1 por item, menos a penalidade dos números que faltam entre um e outro. Em empate, prefere o
// antecessor mais próximo e a sequência que termina primeiro.
function sequenciaDeItens(candidatas: Candidata[]): Candidata[] {
  const melhor: number[] = [];
  const anterior: number[] = [];
  for (let i = 0; i < candidatas.length; i++) {
    melhor[i] = 1;
    anterior[i] = -1;
    for (let j = 0; j < i; j++) {
      if (candidatas[j].numero >= candidatas[i].numero) continue;
      const faltantes = candidatas[i].numero - candidatas[j].numero - 1;
      const passo = 1 - PENALIDADE_POR_FALTANTE * faltantes;
      if (melhor[j] + passo >= melhor[i]) {
        melhor[i] = melhor[j] + passo;
        anterior[i] = j;
      }
    }
  }
  let fim = -1;
  for (let i = 0; i < candidatas.length; i++) if (fim < 0 || melhor[i] > melhor[fim]) fim = i;
  const cadeia: Candidata[] = [];
  for (let i = fim; i >= 0; i = anterior[i]) cadeia.unshift(candidatas[i]);
  return cadeia;
}

function juntarLinhas(linhas: string[]): string {
  return linhas.join(" ").replace(/ {2,}/g, " ").trim();
}

function juntarParagrafos(paragrafos: string[][]): string | null {
  const texto = paragrafos
    .map(juntarLinhas)
    .filter(Boolean)
    .join("\n\n");
  return texto || null;
}

export function analisarProva(texto: string): ProvaLida {
  const linhas = normalizar(texto);
  const candidatas: Candidata[] = [];
  linhas.forEach((l, linha) => {
    const m = INICIO_ITEM.exec(l);
    if (m && Number(m[1]) > 0) candidatas.push({ linha, numero: Number(m[1]), resto: m[2].trim() });
  });
  const inicios = new Map(sequenciaDeItens(candidatas).map((c) => [c.linha, c]));
  if (inicios.size === 0) return { grupos: [], avisos: ["Nenhum item numerado encontrado."] };

  const grupos: GrupoLido[] = [];
  let paragrafos: string[][] = [[]];
  let grupo: GrupoLido | null = null;
  let item: { numero: number; linhas: string[] } | null = null;

  const fecharItem = () => {
    if (!item) return;
    grupo!.itens.push({ numero: item.numero, enunciado: juntarLinhas(item.linhas) });
    item = null;
  };

  linhas.forEach((l, i) => {
    const inicio = inicios.get(i);
    if (inicio) {
      fecharItem();
      const textoBase = juntarParagrafos(paragrafos);
      if (!grupo || textoBase) {
        grupo = { textoBase, itens: [] };
        grupos.push(grupo);
      }
      paragrafos = [[]];
      item = { numero: inicio.numero, linhas: inicio.resto ? [inicio.resto] : [] };
      return;
    }
    if (l === "") {
      if (item && item.linhas.length > 0) fecharItem();
      if (!item && paragrafos[paragrafos.length - 1].length > 0) paragrafos.push([]);
      return;
    }
    if (item && !(INICIO_TEXTO.test(l) && FIM_DE_FRASE.test(item.linhas[item.linhas.length - 1] ?? ""))) {
      item.linhas.push(l);
      return;
    }
    fecharItem();
    // Comandos e títulos ("Texto CB1A1-I") ficam em parágrafo próprio.
    if (INICIO_TEXTO.test(l) && paragrafos[paragrafos.length - 1].length > 0) paragrafos.push([]);
    paragrafos[paragrafos.length - 1].push(l);
    if (TITULO.test(l)) paragrafos.push([]);
  });
  fecharItem();

  const avisos: string[] = [];
  const sobra = juntarParagrafos(paragrafos);
  if (sobra) avisos.push(`Texto depois do último item foi ignorado: "${sobra.slice(0, 80)}${sobra.length > 80 ? "..." : ""}"`);
  const numeros = grupos.flatMap((g) => g.itens.map((it) => it.numero));
  for (let k = 1; k < numeros.length; k++) {
    if (numeros[k] > numeros[k - 1] + 1) {
      const de = numeros[k - 1] + 1;
      const ate = numeros[k] - 1;
      avisos.push(de === ate ? `Falta o item ${de} na sequência.` : `Faltam os itens ${de} a ${ate} na sequência.`);
    }
  }
  for (const g of grupos) {
    for (const it of g.itens) if (!it.enunciado) avisos.push(`O item ${it.numero} está sem texto.`);
  }
  return { grupos, avisos };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/importacao/prova.test.ts`
Expected: PASS (10 testes).

```bash
git add src/importacao/prova.ts src/importacao/prova.test.ts
git commit -m "feat(importacao): leitura do texto colado da prova em textos-base e itens"
```

---

### Task 4: Leitura do gabarito oficial

**Files:**
- Create: `src/importacao/gabarito.ts`
- Test: `src/importacao/gabarito.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type RespostaOficial = "C" | "E" | "X"
  interface GabaritoLido { respostas: Map<number, RespostaOficial>; problemas: string[] }
  lerGabarito(texto: string): GabaritoLido   // puro
  ```

Regras: o texto vira tokens (números de 1 a 999 e respostas; o resto é ignorado). Letras sozinhas só valem em maiúscula (`C`, `E`, `X`); `CERTO`, `ERRADO`, `ANULADO`/`ANULADA`/`ANUL`/`NULO`/`NULA` e `*` em qualquer caixa. Uma sequência de números seguida de uma de respostas forma um bloco: pares `1 C 2 E` são blocos de tamanho 1 e a tabela do Cebraspe ("Item 1 2 ... 10 / Gabarito C E ... E") são blocos maiores. Números a mais no começo de um bloco (ex.: "Cargo 1") são descartados com aviso; respostas a mais também. Número com respostas diferentes sai do gabarito.

- [ ] **Step 1: Escrever o teste**

`src/importacao/gabarito.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lerGabarito } from "./gabarito";

const lista = (texto: string) => Object.fromEntries(lerGabarito(texto).respostas);

describe("lerGabarito", () => {
  it("lê pares número e resposta numa linha só", () => {
    expect(lista("1 C 2 E 3 X 4 C")).toEqual({ 1: "C", 2: "E", 3: "X", 4: "C" });
    expect(lerGabarito("1 C 2 E 3 X 4 C").problemas).toEqual([]);
  });

  it("lê uma resposta por linha com hífen, travessão, ponto ou dois-pontos", () => {
    expect(lista("01 - C\n02 – E\n03. C\n04: ANULADO\n05 E")).toEqual({ 1: "C", 2: "E", 3: "C", 4: "X", 5: "E" });
  });

  it("lê a tabela do Cebraspe com linha de itens e linha de gabarito", () => {
    const texto = `Item 1 2 3 4 5 6 7 8 9 10
Gabarito C E E C X E C C E E
Item 11 12 13 14 15 16 17 18 19 20
Gabarito E C C E C E E C X C`;
    const r = lerGabarito(texto);
    expect(r.problemas).toEqual([]);
    expect(r.respostas.size).toBe(20);
    expect(r.respostas.get(5)).toBe("X");
    expect(r.respostas.get(10)).toBe("E");
    expect(r.respostas.get(19)).toBe("X");
    expect(r.respostas.get(20)).toBe("C");
  });

  it("aceita CERTO, ERRADO, asterisco e anulado em qualquer caixa", () => {
    expect(lista("1 Certo 2 errado 3 * 4 Anulada")).toEqual({ 1: "C", 2: "E", 3: "X", 4: "X" });
  });

  it("ignora palavras do cabeçalho e o 'e' minúsculo", () => {
    expect(lista("Gabarito definitivo de português e matemática\n1 C\n2 E")).toEqual({ 1: "C", 2: "E" });
  });

  it("descarta números soltos antes da tabela e avisa", () => {
    const r = lerGabarito("CEBRASPE 2021 Cargo 1 SOLDADO\nItem 1 2 3\nGabarito C E C");
    expect(Object.fromEntries(r.respostas)).toEqual({ 1: "C", 2: "E", 3: "C" });
    expect(r.problemas).toEqual(["Números sem resposta ignorados no gabarito: 1."]);
  });

  it("avisa respostas sem número e números no fim sem resposta", () => {
    expect(lerGabarito("C E 1 C").problemas).toEqual(["Há 2 resposta(s) sem número no começo."]);
    expect(lerGabarito("1 C 2 E 3 4").problemas).toEqual(["Números sem resposta ignorados no gabarito: 3, 4."]);
    expect(lerGabarito("1 2 3 C E C E E").problemas).toEqual(["Há 2 resposta(s) sem número depois do item 3."]);
    expect(lista("1 2 3 C E C E E")).toEqual({ 1: "C", 2: "E", 3: "C" });
  });

  it("deixa de fora item com respostas conflitantes e aceita repetição igual", () => {
    const r = lerGabarito("1 C 2 E 1 E 2 E");
    expect(Object.fromEntries(r.respostas)).toEqual({ 2: "E" });
    expect(r.problemas).toEqual(["O item 1 aparece com respostas diferentes no gabarito e foi deixado de fora."]);
  });

  it("avisa gabarito vazio", () => {
    expect(lerGabarito("   ")).toEqual({ respostas: new Map(), problemas: ["Nenhuma resposta encontrada no gabarito."] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/importacao/gabarito.test.ts`
Expected: FAIL (módulo `./gabarito` não existe).

- [ ] **Step 3: Implementar**

`src/importacao/gabarito.ts`:

```ts
// Leitura do gabarito oficial colado: pares "1 C 2 E 3 X", uma resposta por linha ("1 - C"), ou a
// tabela do Cebraspe com uma linha de números e outra de respostas. X, ANULADO ou * marcam item anulado.
// Puro: roda no navegador e no servidor.

export type RespostaOficial = "C" | "E" | "X";

export interface GabaritoLido {
  respostas: Map<number, RespostaOficial>;
  problemas: string[];
}

type Token = { tipo: "numero"; valor: number } | { tipo: "resposta"; valor: RespostaOficial };

// Letras sozinhas só em maiúscula: um "e" minúsculo é a conjunção, não "Errado".
function classificar(palavra: string): Token | null {
  if (/^\d+$/.test(palavra)) {
    const n = Number(palavra);
    return n >= 1 && n <= 999 ? { tipo: "numero", valor: n } : null;
  }
  if (palavra === "C" || palavra === "E" || palavra === "X") return { tipo: "resposta", valor: palavra };
  if (palavra === "*") return { tipo: "resposta", valor: "X" };
  const p = palavra.toUpperCase();
  if (p === "CERTO") return { tipo: "resposta", valor: "C" };
  if (p === "ERRADO") return { tipo: "resposta", valor: "E" };
  if (p === "ANULADO" || p === "ANULADA" || p === "ANUL" || p === "NULO" || p === "NULA") return { tipo: "resposta", valor: "X" };
  return null;
}

export function lerGabarito(texto: string): GabaritoLido {
  const tokens = (texto.match(/\d+|\*|[A-Za-zÀ-ÿ]+/g) ?? []).map(classificar).filter((t): t is Token => t !== null);

  // Blocos alternados: uma sequência de números seguida de uma de respostas. Pares "1 C 2 E" viram
  // blocos de tamanho 1; a tabela do Cebraspe vira blocos de 10 a 25.
  const blocos: { numeros: number[]; respostas: RespostaOficial[] }[] = [];
  for (const t of tokens) {
    const ultimo = blocos[blocos.length - 1];
    if (t.tipo === "numero") {
      if (!ultimo || ultimo.respostas.length > 0) blocos.push({ numeros: [t.valor], respostas: [] });
      else ultimo.numeros.push(t.valor);
    } else if (ultimo) {
      ultimo.respostas.push(t.valor);
    } else {
      blocos.push({ numeros: [], respostas: [t.valor] });
    }
  }

  const respostas = new Map<number, RespostaOficial>();
  const conflitos = new Set<number>();
  const problemas: string[] = [];

  for (const b of blocos) {
    let { numeros, respostas: rs } = b;
    if (numeros.length > rs.length && rs.length > 0) {
      // Números soltos antes da tabela (ex.: "Cargo 1") ficam de fora.
      const sobra = numeros.slice(0, numeros.length - rs.length);
      problemas.push(`Números sem resposta ignorados no gabarito: ${sobra.join(", ")}.`);
      numeros = numeros.slice(sobra.length);
    } else if (rs.length > numeros.length) {
      const perto = numeros.length ? ` depois do item ${numeros[numeros.length - 1]}` : " no começo";
      problemas.push(`Há ${rs.length - numeros.length} resposta(s) sem número${perto}.`);
      rs = rs.slice(0, numeros.length);
    } else if (rs.length === 0) {
      problemas.push(`Números sem resposta ignorados no gabarito: ${numeros.join(", ")}.`);
      continue;
    }
    numeros.forEach((n, k) => {
      const anterior = respostas.get(n);
      if (anterior !== undefined && anterior !== rs[k]) conflitos.add(n);
      respostas.set(n, rs[k]);
    });
  }

  for (const n of [...conflitos].sort((a, b) => a - b)) {
    respostas.delete(n);
    problemas.push(`O item ${n} aparece com respostas diferentes no gabarito e foi deixado de fora.`);
  }
  if (respostas.size === 0 && problemas.length === 0) problemas.push("Nenhuma resposta encontrada no gabarito.");
  return { respostas: new Map([...respostas].sort((a, b) => a[0] - b[0])), problemas };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/importacao/gabarito.test.ts`
Expected: PASS (9 testes).

```bash
git add src/importacao/gabarito.ts src/importacao/gabarito.test.ts
git commit -m "feat(importacao): leitura do gabarito oficial em pares, linhas ou tabela"
```

---

### Task 5: Prévia da importação

**Files:**
- Create: `src/importacao/previa.ts`
- Test: `src/importacao/previa.test.ts`

**Interfaces:**
- Consumes: `analisarProva` (Task 3), `lerGabarito` (Task 4).
- Produces:
  ```ts
  interface ItemPrevia { numero: number; enunciado: string; gabarito: "C" | "E" }
  interface GrupoPrevia { textoBase: string | null; itens: ItemPrevia[] }
  interface PreviaImportacao { grupos: GrupoPrevia[]; total: number; anulados: number[]; semGabarito: number[];
    gabaritoSemItem: number[]; avisos: string[] }
  montarPrevia(textoProva: string, textoGabarito: string): PreviaImportacao   // puro
  faixas(numeros: number[]): string   // [1, 2, 3, 7, 9, 10] → "1 a 3, 7, 9 e 10"
  ```

Anulados, itens sem gabarito e itens sem texto ficam de fora; grupo sem item restante some. Os avisos juntam os da prova e os do gabarito.

- [ ] **Step 1: Escrever o teste**

`src/importacao/previa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { faixas, montarPrevia } from "./previa";

const PROVA = `Texto CB1A1-I
A brigada chegou ao local em dez minutos.
Julgue os itens a seguir, relativos ao texto CB1A1-I.
1 O texto informa o tempo de chegada da brigada.
2 A palavra "local" é um adjetivo no texto.
3 O texto menciona vítimas.

Julgue os itens seguintes.
4 Item de informática.
5 Item de matemática.
6 Item sem gabarito.`;

describe("montarPrevia", () => {
  it("cruza itens e gabarito, descarta anulados e lista as inconsistências", () => {
    const r = montarPrevia(PROVA, "1 C 2 E 3 X 4 E 5 C 7 E");
    expect(r.grupos).toEqual([
      {
        textoBase: "Texto CB1A1-I\n\nA brigada chegou ao local em dez minutos.\n\nJulgue os itens a seguir, relativos ao texto CB1A1-I.",
        itens: [
          { numero: 1, enunciado: "O texto informa o tempo de chegada da brigada.", gabarito: "C" },
          { numero: 2, enunciado: 'A palavra "local" é um adjetivo no texto.', gabarito: "E" },
        ],
      },
      {
        textoBase: "Julgue os itens seguintes.",
        itens: [
          { numero: 4, enunciado: "Item de informática.", gabarito: "E" },
          { numero: 5, enunciado: "Item de matemática.", gabarito: "C" },
        ],
      },
    ]);
    expect(r.total).toBe(4);
    expect(r.anulados).toEqual([3]);
    expect(r.semGabarito).toEqual([6]);
    expect(r.gabaritoSemItem).toEqual([7]);
    expect(r.avisos).toEqual([]);
  });

  it("some com o grupo cujos itens foram todos anulados e junta os avisos da prova e do gabarito", () => {
    const r = montarPrevia("Julgue.\n1 Único item.\n2", "1 X 2 C 3");
    expect(r.grupos).toEqual([]);
    expect(r.total).toBe(0);
    expect(r.anulados).toEqual([1]);
    expect(r.avisos).toEqual(["O item 2 está sem texto.", "Números sem resposta ignorados no gabarito: 3."]);
  });
});

describe("faixas", () => {
  it("resume listas de números", () => {
    expect(faixas([])).toBe("");
    expect(faixas([7])).toBe("7");
    expect(faixas([10, 9])).toBe("9 e 10");
    expect(faixas([1, 2, 3, 7, 9, 10])).toBe("1 a 3, 7, 9 e 10");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/importacao/previa.test.ts`
Expected: FAIL (módulo `./previa` não existe).

- [ ] **Step 3: Implementar**

`src/importacao/previa.ts`:

```ts
import { lerGabarito } from "./gabarito";
import { analisarProva } from "./prova";

export interface ItemPrevia {
  numero: number;
  enunciado: string;
  gabarito: "C" | "E";
}

export interface GrupoPrevia {
  textoBase: string | null;
  itens: ItemPrevia[];
}

// O que será gravado e o que ficou de fora. Puro: a tela calcula no navegador, sem ida ao servidor.
export interface PreviaImportacao {
  grupos: GrupoPrevia[];
  total: number;
  anulados: number[];
  semGabarito: number[];
  gabaritoSemItem: number[];
  avisos: string[];
}

// [1, 2, 3, 7, 9, 10] → "1 a 3, 7, 9 e 10"
export function faixas(numeros: number[]): string {
  const ordenados = [...new Set(numeros)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ordenados.length; ) {
    let j = i;
    while (j + 1 < ordenados.length && ordenados[j + 1] === ordenados[j] + 1) j++;
    const [a, b] = [ordenados[i], ordenados[j]];
    if (a === b) partes.push(String(a));
    else if (b === a + 1) partes.push(String(a), String(b));
    else partes.push(`${a} a ${b}`);
    i = j + 1;
  }
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

// Cruza os itens lidos com o gabarito oficial: anulados (X) e itens sem gabarito ou sem texto ficam de fora.
export function montarPrevia(textoProva: string, textoGabarito: string): PreviaImportacao {
  const prova = analisarProva(textoProva);
  const gabarito = lerGabarito(textoGabarito);
  const anulados: number[] = [];
  const semGabarito: number[] = [];
  const lidos = new Set<number>();

  const grupos: GrupoPrevia[] = [];
  for (const g of prova.grupos) {
    const itens: ItemPrevia[] = [];
    for (const it of g.itens) {
      lidos.add(it.numero);
      const resposta = gabarito.respostas.get(it.numero);
      if (resposta === undefined) semGabarito.push(it.numero);
      else if (resposta === "X") anulados.push(it.numero);
      else if (it.enunciado) itens.push({ numero: it.numero, enunciado: it.enunciado, gabarito: resposta });
    }
    if (itens.length > 0) grupos.push({ textoBase: g.textoBase, itens });
  }

  const gabaritoSemItem = [...gabarito.respostas.keys()].filter((n) => !lidos.has(n));
  return {
    grupos,
    total: grupos.reduce((s, g) => s + g.itens.length, 0),
    anulados,
    semGabarito,
    gabaritoSemItem,
    avisos: [...prova.avisos, ...gabarito.problemas],
  };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/importacao`
Expected: PASS (22 testes).

```bash
git add src/importacao/previa.ts src/importacao/previa.test.ts
git commit -m "feat(importacao): prévia que cruza itens e gabarito e lista inconsistências"
```

---

### Task 6: Validação do envio e lote da gravação

**Files:**
- Create: `src/importacao/gravacao.ts`
- Test: `src/importacao/gravacao.test.ts`

**Interfaces:**
- Consumes: `hashNormalizado(enunciado, textoBase)` de `src/pipeline/hash.ts`; formato de `itens_importar_reais` (Task 1).
- Produces:
  ```ts
  previaSchema      // zod/v4: GrupoPrevia[] (1 a 300 grupos), entrada de sugerir
  importacaoSchema  // zod/v4: { provaOrigem (3 a 120), grupos: [{ textoBase, itens: [{ numero, enunciado, gabarito: "C"|"E", canonicos (até 3) }] }] }
  type Importacao = z.infer<typeof importacaoSchema>
  interface LoteReal { banca; prova_origem; importado_por; grupos: { texto_base; itens: { numero; enunciado; gabarito; hash; canonicos }[] }[] }
  class ErroImportacao extends Error
  montarLoteReal({ banca, importadoPor, importacao, canonicosPermitidos: Set<string> }): LoteReal   // lança ErroImportacao
  ```

Este módulo importa `node:crypto` (via `hash.ts`): use só no servidor. A tela importa dele apenas tipos.

- [ ] **Step 1: Escrever o teste**

`src/importacao/gravacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashNormalizado } from "../pipeline/hash";
import { ErroImportacao, importacaoSchema, montarLoteReal, previaSchema, type Importacao } from "./gravacao";

const importacao: Importacao = {
  provaOrigem: " CBM-AL 2021 Soldado ",
  grupos: [
    {
      textoBase: "Texto CB1A1-I\n\nJulgue os itens.",
      itens: [
        { numero: 1, enunciado: "Primeiro item.", gabarito: "C", canonicos: ["portugues/crase"] },
        { numero: 2, enunciado: "Segundo item.", gabarito: "E", canonicos: ["portugues/crase", "portugues/crase"] },
      ],
    },
    { textoBase: "  ", itens: [{ numero: 3, enunciado: "Terceiro item.", gabarito: "C", canonicos: ["portugues/regencia"] }] },
  ],
};
const permitidos = new Set(["portugues/crase", "portugues/regencia"]);

describe("montarLoteReal", () => {
  it("monta o lote da função SQL com o hash normalizado do pipeline", () => {
    const lote = montarLoteReal({ banca: "cebraspe", importadoPor: "ana@x.com", importacao, canonicosPermitidos: permitidos });
    expect(lote).toEqual({
      banca: "cebraspe",
      prova_origem: "CBM-AL 2021 Soldado",
      importado_por: "ana@x.com",
      grupos: [
        {
          texto_base: "Texto CB1A1-I\n\nJulgue os itens.",
          itens: [
            { numero: 1, enunciado: "Primeiro item.", gabarito: "C", hash: hashNormalizado("Primeiro item.", "Texto CB1A1-I\n\nJulgue os itens."), canonicos: ["portugues/crase"] },
            { numero: 2, enunciado: "Segundo item.", gabarito: "E", hash: hashNormalizado("Segundo item.", "Texto CB1A1-I\n\nJulgue os itens."), canonicos: ["portugues/crase"] },
          ],
        },
        {
          texto_base: null,
          itens: [{ numero: 3, enunciado: "Terceiro item.", gabarito: "C", hash: hashNormalizado("Terceiro item.", null), canonicos: ["portugues/regencia"] }],
        },
      ],
    });
  });

  it("recusa item sem tópico e tópico fora do concurso", () => {
    const semTopico = structuredClone(importacao);
    semTopico.grupos[0].itens[1].canonicos = [];
    expect(() => montarLoteReal({ banca: "cebraspe", importadoPor: "a", importacao: semTopico, canonicosPermitidos: permitidos })).toThrow(
      new ErroImportacao("Escolha ao menos um tópico para os itens 2."),
    );
    expect(() =>
      montarLoteReal({ banca: "cebraspe", importadoPor: "a", importacao, canonicosPermitidos: new Set(["portugues/crase"]) }),
    ).toThrow("Tópicos fora do edital: portugues/regencia.");
  });
});

describe("importacaoSchema", () => {
  it("aceita a importação da tela e recusa prova de origem curta ou gabarito anulado", () => {
    expect(importacaoSchema.safeParse(importacao).success).toBe(true);
    expect(importacaoSchema.safeParse({ ...importacao, provaOrigem: "x" }).success).toBe(false);
    const anulado = structuredClone(importacao) as unknown as { grupos: { itens: { gabarito: string }[] }[] };
    anulado.grupos[0].itens[0].gabarito = "X";
    expect(importacaoSchema.safeParse(anulado).success).toBe(false);
  });
});

describe("previaSchema", () => {
  it("aceita os grupos da prévia sem tópicos e recusa grupo vazio", () => {
    const grupos = importacao.grupos.map((g) => ({ ...g, itens: g.itens.map(({ numero, enunciado, gabarito }) => ({ numero, enunciado, gabarito })) }));
    expect(previaSchema.safeParse(grupos).success).toBe(true);
    expect(previaSchema.safeParse([{ textoBase: null, itens: [] }]).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/importacao/gravacao.test.ts`
Expected: FAIL (módulo `./gravacao` não existe).

- [ ] **Step 3: Implementar**

`src/importacao/gravacao.ts`:

```ts
import { z } from "zod/v4";
import { hashNormalizado } from "../pipeline/hash";

const itemSchema = z.object({
  numero: z.number().int().min(1).max(999),
  enunciado: z.string().trim().min(1).max(4_000),
  gabarito: z.enum(["C", "E"]),
});
const textoBaseSchema = z.string().max(20_000).nullable();

// Grupos da prévia, enviados para a sugestão de tópicos. Validado no servidor.
export const previaSchema = z
  .array(z.object({ textoBase: textoBaseSchema, itens: z.array(itemSchema).min(1) }))
  .min(1)
  .max(300);

// O que a tela envia para gravar, depois de o moderador confirmar os tópicos. Validado no servidor.
export const importacaoSchema = z.object({
  provaOrigem: z.string().trim().min(3).max(120),
  grupos: z
    .array(
      z.object({
        textoBase: textoBaseSchema,
        itens: z.array(itemSchema.extend({ canonicos: z.array(z.string().min(1)).max(3) })).min(1),
      }),
    )
    .min(1)
    .max(300),
});

export type Importacao = z.infer<typeof importacaoSchema>;

// Formato de public.itens_importar_reais (migração 0008).
export interface LoteReal {
  banca: string;
  prova_origem: string;
  importado_por: string;
  grupos: {
    texto_base: string | null;
    itens: { numero: number; enunciado: string; gabarito: "C" | "E"; hash: string; canonicos: string[] }[];
  }[];
}

export class ErroImportacao extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroImportacao";
  }
}

// Confere os tópicos (ao menos um por item, todos do concurso) e calcula o hash de deduplicação
// com a mesma normalização do pipeline de geração.
export function montarLoteReal(p: {
  banca: string;
  importadoPor: string;
  importacao: Importacao;
  canonicosPermitidos: Set<string>;
}): LoteReal {
  const itens = p.importacao.grupos.flatMap((g) => g.itens);
  const semTopico = itens.filter((i) => i.canonicos.length === 0).map((i) => i.numero);
  if (semTopico.length > 0) throw new ErroImportacao(`Escolha ao menos um tópico para os itens ${semTopico.join(", ")}.`);
  const fora = [...new Set(itens.flatMap((i) => i.canonicos))].filter((c) => !p.canonicosPermitidos.has(c));
  if (fora.length > 0) throw new ErroImportacao(`Tópicos fora do edital: ${fora.join(", ")}.`);
  if (itens.length > 300) throw new ErroImportacao("No máximo 300 itens por importação.");

  return {
    banca: p.banca,
    prova_origem: p.importacao.provaOrigem.trim(),
    importado_por: p.importadoPor,
    grupos: p.importacao.grupos.map((g) => {
      const textoBase = g.textoBase?.trim() || null;
      return {
        texto_base: textoBase,
        itens: g.itens.map((i) => ({
          numero: i.numero,
          enunciado: i.enunciado.trim(),
          gabarito: i.gabarito,
          hash: hashNormalizado(i.enunciado, textoBase),
          canonicos: [...new Set(i.canonicos)],
        })),
      };
    }),
  };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/importacao`
Expected: PASS (26 testes).

```bash
git add src/importacao/gravacao.ts src/importacao/gravacao.test.ts
git commit -m "feat(importacao): validação do envio e lote com hash normalizado"
```

---

### Task 7: Sugestão de tópicos por IA

**Files:**
- Create: `src/importacao/topicos.ts`
- Test: `src/importacao/topicos.test.ts`

**Interfaces:**
- Consumes: `ProvedorIa`, `ErroIa`, `UsoIa` de `src/ai/tipos.ts`; `criarProvedorFalso` de `src/ai/falso.ts` (só no teste); `GrupoPrevia` (Task 5).
- Produces:
  ```ts
  interface OpcaoTopico { canonico: string; titulo: string; disciplina: string }
  opcoesDeTopicos(linhas: OpcaoTopico[]): OpcaoTopico[]   // um por canônico, ordenado por disciplina e título
  sugestoesSchema   // zod/v4: { sugestoes: [{ numero, canonicos: string[] }] }
  sistemaTopicos(opcoes): string; promptTopicos(grupos): string; lotesDeSugestao(grupos): GrupoPrevia[][]
  interface DepsSugestao { provedor: ProvedorIa; registrarUso(uso: UsoIa): Promise<void> }
  sugerirTopicos(deps, { grupos, opcoes }): Promise<{ porItem: Record<number, string[]>; custoUsd: number }>
  ITENS_POR_CHAMADA = 25; MAX_TOPICOS_POR_ITEM = 2; PROMPT_TOPICOS_VERSAO
  ```

A saída da IA passa pelo schema (o provedor rejeita o que não bate) e depois é restrita à lista: canônicos fora dela, números fora do lote e repetições somem; no máximo 2 por item. O uso de cada chamada é registrado, inclusive o de uma chamada cobrada que falhou.

- [ ] **Step 1: Escrever o teste**

`src/importacao/topicos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../ai/falso";
import { ErroIa, type UsoIa } from "../ai/tipos";
import type { GrupoPrevia } from "./previa";
import { ITENS_POR_CHAMADA, lotesDeSugestao, opcoesDeTopicos, promptTopicos, sistemaTopicos, sugerirTopicos } from "./topicos";

const opcoes = opcoesDeTopicos([
  { canonico: "portugues/crase", titulo: "Crase", disciplina: "Língua Portuguesa" },
  { canonico: "informatica/windows", titulo: "Windows 10", disciplina: "Informática" },
  { canonico: "portugues/crase", titulo: "Crase (P2)", disciplina: "Português" },
  { canonico: "portugues/concordancia", titulo: "Concordância", disciplina: "Língua Portuguesa" },
]);

const grupos: GrupoPrevia[] = [
  {
    textoBase: "Texto CB1A1-I\n\nO incêndio começou às 3 h.",
    itens: [
      { numero: 1, enunciado: "O acento grave em \"às 3 h\" é obrigatório.", gabarito: "C" },
      { numero: 2, enunciado: "A forma verbal \"começou\" concorda com \"incêndio\".", gabarito: "C" },
    ],
  },
  { textoBase: null, itens: [{ numero: 3, enunciado: "No Windows 10, Ctrl + Z desfaz a última ação.", gabarito: "C" }] },
];

function registro() {
  const usos: UsoIa[] = [];
  return { usos, registrarUso: async (u: UsoIa) => void usos.push(u) };
}

describe("opcoesDeTopicos", () => {
  it("deixa um canônico por linha, na primeira disciplina, ordenado por disciplina e título", () => {
    expect(opcoes).toEqual([
      { canonico: "informatica/windows", titulo: "Windows 10", disciplina: "Informática" },
      { canonico: "portugues/concordancia", titulo: "Concordância", disciplina: "Língua Portuguesa" },
      { canonico: "portugues/crase", titulo: "Crase", disciplina: "Língua Portuguesa" },
    ]);
  });
});

describe("prompts", () => {
  it("lista os canônicos no sistema e manda itens com o texto-base", () => {
    expect(sistemaTopicos(opcoes)).toContain("portugues/crase | Língua Portuguesa | Crase");
    const p = promptTopicos(grupos);
    expect(p).toContain("<texto_base>\nTexto CB1A1-I\n\nO incêndio começou às 3 h.\n</texto_base>\n1. O acento grave");
    expect(p).toContain("3. No Windows 10");
  });

  it("corta textos-base longos", () => {
    const p = promptTopicos([{ textoBase: "a".repeat(2_000), itens: [{ numero: 1, enunciado: "x", gabarito: "C" }] }]);
    expect(p).toContain(`${"a".repeat(1_500)}...`);
    expect(p).not.toContain("a".repeat(1_501));
  });
});

describe("lotesDeSugestao", () => {
  it("agrupa até o limite por chamada sem separar item do texto-base", () => {
    const item = (numero: number) => ({ numero, enunciado: `Item ${numero}`, gabarito: "C" as const });
    const grande: GrupoPrevia = { textoBase: "T", itens: Array.from({ length: 30 }, (_, k) => item(k + 1)) };
    const pequeno: GrupoPrevia = { textoBase: "U", itens: [item(31), item(32)] };
    const lotes = lotesDeSugestao([grande, pequeno]);
    expect(lotes.map((l) => l.map((g) => `${g.textoBase}:${g.itens.length}`))).toEqual([["T:25"], ["T:5", "U:2"]]);
    expect(lotes.flat().every((g) => g.itens.length <= ITENS_POR_CHAMADA)).toBe(true);
  });
});

describe("sugerirTopicos", () => {
  it("devolve os tópicos por item, filtrando os que não estão na lista, e registra o uso", async () => {
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [
      {
        sugestoes: [
          { numero: 1, canonicos: ["portugues/crase", "portugues/crase", "historia/inventado"] },
          { numero: 2, canonicos: ["portugues/concordancia", "portugues/crase", "informatica/windows"] },
          { numero: 99, canonicos: ["portugues/crase"] },
        ],
      },
    ]);
    const r = registro();
    const resultado = await sugerirTopicos({ provedor, registrarUso: r.registrarUso }, { grupos, opcoes });
    expect(resultado.porItem).toEqual({
      1: ["portugues/crase"],
      2: ["portugues/concordancia", "portugues/crase"],
      3: [],
    });
    expect(resultado.custoUsd).toBeCloseTo(0.01);
    expect(r.usos).toHaveLength(1);
    expect(pedidos[0]).toMatchObject({ finalidade: "sugerir_topicos", nomeSchema: "sugestoes_topicos" });
  });

  it("faz uma chamada por lote", async () => {
    const muitos: GrupoPrevia[] = [
      { textoBase: null, itens: Array.from({ length: 30 }, (_, k) => ({ numero: k + 1, enunciado: `Item ${k + 1}`, gabarito: "E" as const })) },
    ];
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [
      { sugestoes: [{ numero: 1, canonicos: ["portugues/crase"] }] },
      { sugestoes: [{ numero: 30, canonicos: ["informatica/windows"] }] },
    ]);
    const r = await sugerirTopicos({ provedor, registrarUso: registro().registrarUso }, { grupos: muitos, opcoes });
    expect(pedidos).toHaveLength(2);
    expect(r.porItem[1]).toEqual(["portugues/crase"]);
    expect(r.porItem[30]).toEqual(["informatica/windows"]);
    expect(r.porItem[15]).toEqual([]);
  });

  it("registra o uso cobrado de uma chamada que falhou e repassa o erro", async () => {
    const uso: UsoIa = { provedor: "anthropic", modelo: "m", tokensEntrada: 1, tokensSaida: 1, custoUsd: 0.02 };
    const { provedor } = criarProvedorFalso("anthropic", [new ErroIa("anthropic", "recusa", "recusou", uso)]);
    const r = registro();
    await expect(sugerirTopicos({ provedor, registrarUso: r.registrarUso }, { grupos, opcoes })).rejects.toThrow("recusou");
    expect(r.usos).toEqual([uso]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/importacao/topicos.test.ts`
Expected: FAIL (módulo `./topicos` não existe).

- [ ] **Step 3: Implementar**

`src/importacao/topicos.ts`:

```ts
import { z } from "zod/v4";
import { ErroIa, type ProvedorIa, type UsoIa } from "../ai/tipos";
import type { GrupoPrevia } from "./previa";

export const PROMPT_TOPICOS_VERSAO = "2026-10-15.1";
export const ITENS_POR_CHAMADA = 25;
export const MAX_TOPICOS_POR_ITEM = 2;
const LIMITE_TEXTO_BASE = 1_500;

// Um tópico canônico do concurso, como aparece para o moderador e para a IA.
export interface OpcaoTopico {
  canonico: string;
  titulo: string;
  disciplina: string;
}

export const sugestoesSchema = z.object({
  sugestoes: z.array(z.object({ numero: z.number(), canonicos: z.array(z.string()) })),
});

export interface DepsSugestao {
  provedor: ProvedorIa;
  registrarUso(uso: UsoIa): Promise<void>;
}

export interface ResultadoSugestao {
  porItem: Record<number, string[]>;
  custoUsd: number;
}

// Uma linha de tópico canônico por linha do banco (topicos do edital com canônico), sem repetir o
// canônico; fica na disciplina em que aparece primeiro. Ordena por disciplina e título.
export function opcoesDeTopicos(linhas: { canonico: string; titulo: string; disciplina: string }[]): OpcaoTopico[] {
  const porCanonico = new Map<string, OpcaoTopico>();
  for (const l of linhas) if (!porCanonico.has(l.canonico)) porCanonico.set(l.canonico, { ...l });
  return [...porCanonico.values()].sort(
    (a, b) => a.disciplina.localeCompare(b.disciplina, "pt-BR") || a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
}

export function sistemaTopicos(opcoes: OpcaoTopico[]): string {
  const lista = opcoes.map((o) => `${o.canonico} | ${o.disciplina} | ${o.titulo}`).join("\n");
  return `Você classifica itens de provas de concursos públicos brasileiros nos tópicos do edital.
Para cada item, escolha 1 tópico (no máximo ${MAX_TOPICOS_POR_ITEM}, só se o item cobrar dois assuntos de fato) da lista abaixo, usando o identificador exato da primeira coluna.
Classifique pelo conhecimento que o item cobra, não pelas palavras do texto-base: um item de interpretação sobre um texto que fala de incêndios é de língua portuguesa.
Se nenhum tópico servir, devolva a lista vazia para o item.
Responda somente no formato estruturado pedido.

<topicos>
${lista}
</topicos>`;
}

export function promptTopicos(grupos: GrupoPrevia[]): string {
  const blocos = grupos.map((g) => {
    const texto = g.textoBase
      ? `<texto_base>\n${g.textoBase.length > LIMITE_TEXTO_BASE ? `${g.textoBase.slice(0, LIMITE_TEXTO_BASE)}...` : g.textoBase}\n</texto_base>\n`
      : "";
    return `${texto}${g.itens.map((i) => `${i.numero}. ${i.enunciado}`).join("\n")}`;
  });
  return `Classifique os itens abaixo. Devolva uma sugestão por item, com o mesmo \`numero\`.

${blocos.join("\n\n")}`;
}

// Divide em chamadas de até ITENS_POR_CHAMADA itens, sem separar um item do seu texto-base.
export function lotesDeSugestao(grupos: GrupoPrevia[]): GrupoPrevia[][] {
  const lotes: GrupoPrevia[][] = [];
  let atual: GrupoPrevia[] = [];
  let n = 0;
  for (const g of grupos) {
    for (let k = 0; k < g.itens.length; k += ITENS_POR_CHAMADA) {
      const parte = { textoBase: g.textoBase, itens: g.itens.slice(k, k + ITENS_POR_CHAMADA) };
      if (n > 0 && n + parte.itens.length > ITENS_POR_CHAMADA) {
        lotes.push(atual);
        atual = [];
        n = 0;
      }
      atual.push(parte);
      n += parte.itens.length;
    }
  }
  if (atual.length > 0) lotes.push(atual);
  return lotes;
}

// Pede à IA os tópicos de cada item, com os lotes em paralelo para caber no tempo de uma Server
// Action. A saída é restrita à lista do concurso: identificadores fora dela e números que não
// estavam no lote são ignorados; itens sem sugestão ficam com lista vazia.
export async function sugerirTopicos(
  deps: DepsSugestao,
  entrada: { grupos: GrupoPrevia[]; opcoes: OpcaoTopico[] },
): Promise<ResultadoSugestao> {
  const permitidos = new Set(entrada.opcoes.map((o) => o.canonico));
  const sistema = sistemaTopicos(entrada.opcoes);

  const chamar = async (lote: GrupoPrevia[]) => {
    try {
      const r = await deps.provedor.gerarJson({
        finalidade: "sugerir_topicos",
        sistema,
        prompt: promptTopicos(lote),
        schema: sugestoesSchema,
        nomeSchema: "sugestoes_topicos",
      });
      await deps.registrarUso(r.uso);
      return r;
    } catch (e) {
      if (e instanceof ErroIa && e.uso) await deps.registrarUso(e.uso);
      throw e;
    }
  };

  const lotes = lotesDeSugestao(entrada.grupos);
  const respostas = await Promise.all(lotes.map(chamar));

  const porItem: Record<number, string[]> = {};
  let custoUsd = 0;
  lotes.forEach((lote, k) => {
    const numeros = new Set(lote.flatMap((g) => g.itens.map((i) => i.numero)));
    for (const n of numeros) porItem[n] = [];
    custoUsd += respostas[k].uso.custoUsd;
    for (const s of respostas[k].dados.sugestoes) {
      if (!numeros.has(s.numero)) continue;
      porItem[s.numero] = [...new Set(s.canonicos.filter((c) => permitidos.has(c)))].slice(0, MAX_TOPICOS_POR_ITEM);
    }
  });
  return { porItem, custoUsd };
}
```

- [ ] **Step 4: Rodar e ver passar; commit**

Run: `npx vitest run src/importacao && npm run typecheck`
Expected: PASS (33 testes em `src/importacao`); typecheck limpo.

```bash
git add src/importacao/topicos.ts src/importacao/topicos.test.ts
git commit -m "feat(importacao): sugestão de tópicos canônicos por IA, restrita ao edital"
```

---

### Task 8: Modo produto

**Files:**
- Create: `src/lib/itens-reais.ts`
- Modify: `src/db/repositorios/estudo.ts`
- Test: `src/lib/itens-reais.test.ts`, `src/db/repositorios/estudo.test.ts`

**Interfaces:**
- Consumes: `origem` em `estudo_candidatos` (Task 1).
- Produces:
  ```ts
  itensReaisVisiveis(env = process.env): boolean
  filtrarCandidatos(linhas: { id; textoBaseId; canonicos; visto; origem: "real" | "ia" }[], itensReais: boolean): ItemCandidato[]
  criarRepositorioEstudo(db, opcoes?: { itensReais?: boolean }): RepositorioEstudo   // padrão: itensReaisVisiveis()
  ```

- [ ] **Step 1: Escrever os testes**

`src/lib/itens-reais.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { itensReaisVisiveis } from "./itens-reais";

describe("itensReaisVisiveis", () => {
  it("é verdadeiro por padrão e com valores afirmativos", () => {
    expect(itensReaisVisiveis({})).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "" })).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "true" })).toBe(true);
    expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: "1" })).toBe(true);
  });

  it("desliga com false, 0, não ou off, em qualquer caixa", () => {
    for (const v of ["false", "FALSE", " 0 ", "nao", "Não", "off"]) {
      expect(itensReaisVisiveis({ ITENS_REAIS_VISIVEIS: v })).toBe(false);
    }
  });
});
```

`src/db/repositorios/estudo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filtrarCandidatos } from "./estudo";

const linhas = [
  { id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false, origem: "ia" as const },
  { id: "b", textoBaseId: "t1", canonicos: ["portugues/crase"], visto: true, origem: "real" as const },
];

describe("filtrarCandidatos", () => {
  it("mantém os itens reais no uso pessoal, sem expor a origem", () => {
    expect(filtrarCandidatos(linhas, true)).toEqual([
      { id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false },
      { id: "b", textoBaseId: "t1", canonicos: ["portugues/crase"], visto: true },
    ]);
  });

  it("tira os itens reais das sessões em modo produto", () => {
    expect(filtrarCandidatos(linhas, false)).toEqual([{ id: "a", textoBaseId: null, canonicos: ["portugues/crase"], visto: false }]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/itens-reais.test.ts src/db/repositorios/estudo.test.ts`
Expected: FAIL (`./itens-reais` não existe; `filtrarCandidatos` não é exportada).

- [ ] **Step 3: Implementar a flag**

`src/lib/itens-reais.ts`:

```ts
// Modo produto (spec §5.3): com ITENS_REAIS_VISIVEIS=false, itens reais de provas anteriores não
// entram nas sessões e servem só como referência de estilo do gerador. Padrão: visíveis (uso pessoal).
export function itensReaisVisiveis(env: Record<string, string | undefined> = process.env): boolean {
  const valor = env.ITENS_REAIS_VISIVEIS?.trim().toLowerCase();
  return !["false", "0", "nao", "não", "off"].includes(valor ?? "");
}
```

- [ ] **Step 4: Filtrar os candidatos no repositório de estudo**

Em `src/db/repositorios/estudo.ts`:

1. Imports (o de `@/core` depois de `zod`; o de `@/lib/itens-reais` depois de `@/estudo/tipos`):

```ts
import type { ItemCandidato } from "@/core";
```

```ts
import { itensReaisVisiveis } from "@/lib/itens-reais";
```

2. Troque `candidatosSchema` por:

```ts
const candidatosSchema = z.array(
  z.object({
    id: z.string(),
    textoBaseId: z.string().nullable(),
    canonicos: z.array(z.string()),
    visto: z.boolean(),
    origem: z.enum(["real", "ia"]),
  }),
);
```

3. Troque o comentário e a assinatura de `criarRepositorioEstudo`:

```ts
// Em modo produto (itensReais = false) os itens reais saem das sessões: sem candidato, eles também
// não entram em treino, simulado nem revisão. O gerador continua a usá-los como referência de estilo.
export function filtrarCandidatos(linhas: z.infer<typeof candidatosSchema>, itensReais: boolean): ItemCandidato[] {
  return linhas
    .filter((l) => itensReais || l.origem !== "real")
    .map(({ id, textoBaseId, canonicos, visto }) => ({ id, textoBaseId, canonicos, visto }));
}

// Implementação com o cliente do usuário: o RLS garante que cada um só vê e grava o que é seu.
export function criarRepositorioEstudo(db: Cliente, opcoes: { itensReais?: boolean } = {}): RepositorioEstudo {
  const itensReais = opcoes.itensReais ?? itensReaisVisiveis();
```

4. Em `candidatos(cargoId)`, troque `return candidatosSchema.parse(data);` por:

```ts
      return filtrarCandidatos(candidatosSchema.parse(data), itensReais);
```

- [ ] **Step 5: Rodar e ver passar; commit**

Run: `npx vitest run src/lib src/db && npm run typecheck && npm run lint`
Expected: PASS; typecheck e lint limpos.

```bash
git add src/lib/itens-reais.ts src/lib/itens-reais.test.ts src/db/repositorios/estudo.ts src/db/repositorios/estudo.test.ts
git commit -m "feat(estudo): modo produto tira itens reais das sessões (ITENS_REAIS_VISIVEIS)"
```

---

### Task 9: Repositório da importação

**Files:**
- Create: `src/db/repositorios/importacao.ts`

**Interfaces:**
- Consumes: `itens_importar_reais` e os tipos da Task 2; `LoteReal` (Task 6); `opcoesDeTopicos`, `OpcaoTopico` (Task 7); `criarRepositorioPipeline(db).registrarUso` (Plano 3); `Cliente` de `./estudo`; `ClienteServico`.
- Produces:
  ```ts
  interface DadosImportacao { concurso: { id; nome }; banca: string; opcoes: OpcaoTopico[] }
  dadosDaImportacao(db: Cliente, cargoId): Promise<DadosImportacao>   // cliente do usuário
  type ResultadoImportacao = { gravados: number; duplicados: number[] }
  importarItensReais(db: ClienteServico, lote: LoteReal): Promise<ResultadoImportacao>
  registrarUsoSugestao(db: ClienteServico): (uso: UsoIa) => Promise<void>   // finalidade "sugerir_topicos"
  ```

Os tópicos são os de **todas** as disciplinas do concurso do cargo escolhido (a P1 é compartilhada e uma prova antiga pode cobrir outro cargo). O CBM-AL tem 457 tópicos com canônico, abaixo do limite de linhas da API.

- [ ] **Step 1: Implementar**

`src/db/repositorios/importacao.ts`:

```ts
import { z } from "zod/v4";
import type { UsoIa } from "../../ai/tipos";
import type { LoteReal } from "../../importacao/gravacao";
import { opcoesDeTopicos, type OpcaoTopico } from "../../importacao/topicos";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";
import type { Cliente } from "./estudo";
import { criarRepositorioPipeline } from "./pipeline";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export interface DadosImportacao {
  concurso: { id: string; nome: string };
  banca: string;
  opcoes: OpcaoTopico[];
}

// Concurso do cargo escolhido, a banca dele e os tópicos canônicos de todas as disciplinas do
// concurso (a P1 é compartilhada e uma prova antiga pode cobrir qualquer cargo). Leitura com o
// cliente do usuário: as tabelas do edital são públicas para autenticados.
export async function dadosDaImportacao(db: Cliente, cargoId: string): Promise<DadosImportacao> {
  const { data: cargo, error: e1 } = await db
    .from("cargos")
    .select("concursos!inner(id, nome, bancas!inner(slug))")
    .eq("id", cargoId)
    .single();
  if (e1) falhou(`cargo ${cargoId}`, e1);
  const concurso = cargo.concursos;

  const { data: topicos, error: e2 } = await db
    .from("topicos")
    .select("titulo, disciplinas!inner(nome, concurso_id), topicos_canonicos!inner(slug, titulo)")
    .eq("disciplinas.concurso_id", concurso.id)
    .limit(5_000);
  if (e2) falhou("tópicos do concurso", e2);

  return {
    concurso: { id: concurso.id, nome: concurso.nome },
    banca: concurso.bancas.slug,
    opcoes: opcoesDeTopicos(
      topicos.map((t) => ({
        canonico: t.topicos_canonicos.slug,
        titulo: t.topicos_canonicos.titulo,
        disciplina: t.disciplinas.nome,
      })),
    ),
  };
}

const resultadoSchema = z.object({ gravados: z.number(), duplicados: z.array(z.number()) });
export type ResultadoImportacao = z.infer<typeof resultadoSchema>;

// Chave secreta: a função SQL só executa como service_role. Quem chama confere o moderador.
export async function importarItensReais(db: ClienteServico, lote: LoteReal): Promise<ResultadoImportacao> {
  const { data, error } = await db.rpc("itens_importar_reais", { p_prova: lote as unknown as Json });
  if (error) falhou("importar itens reais", error);
  return resultadoSchema.parse(data);
}

export function registrarUsoSugestao(db: ClienteServico) {
  const repo = criarRepositorioPipeline(db);
  return (uso: UsoIa) => repo.registrarUso(uso, "sugerir_topicos", null);
}
```

- [ ] **Step 2: Checar tipos e commit**

Run: `npm run typecheck && npm run lint`
Expected: sem erros (as consultas aninhadas `concursos!inner(..., bancas!inner(slug))` e `disciplinas!inner`/`topicos_canonicos!inner` tipam com os tipos gerados).

```bash
git add src/db/repositorios/importacao.ts
git commit -m "feat(db): repositório da importação com tópicos do concurso e gravação"
```

---

### Task 10: Tela de importação

**Files:**
- Create: `src/app/(app)/importar/acoes.ts`, `src/app/(app)/importar/page.tsx`, `src/components/importar/previa-prova.tsx`, `src/components/importar/escolha-topicos.tsx`, `src/components/importar/assistente.tsx`
- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `contextoDoUsuario`, `exigirCargo` (Plano 4); `Retorno<T>` de `src/app/(app)/sessao/[id]/acoes.ts`; `criarProvedores` de `src/pipeline/config.ts`; Tasks 5 a 9.
- Produces:
  ```ts
  sugerir(grupos: unknown): Promise<Retorno<Record<number, string[]>>>      // Server Action
  gravar(importacao: unknown): Promise<Retorno<ResultadoImportacao>>        // Server Action
  <AssistenteImportacao concurso opcoes reaisNasSessoes />
  <PreviaProva grupos />, <EscolhaTopicos grupos opcoes topicos sugeridos aoMudar />, <TextoBase texto />, <LinhaItem item />, <GabaritoOficial gabarito />
  ```

Comportamento:
- `/importar` só existe para moderadores (`notFound()` para os demais) e usa o concurso do cargo escolhido. `maxDuration = 300` vale para as Server Actions da página.
- Etapas, com indicador `aria-current="step"`: **Colar a prova** (prova de origem, texto, gabarito; CTA "Analisar prova", desabilitado até os três campos terem conteúdo) → **Conferir** (quantos itens entram, inconsistências em caixa marigold com `role="status"`, grupos com texto-base recolhido e gabarito em pílula; CTA "Sugerir tópicos com IA", secundário "Escolher tópicos sem IA", terciário "Voltar e corrigir o texto") → **Tópicos** (etiquetas removíveis por item, marcadas "IA" quando vieram da sugestão, seletor com `optgroup` por disciplina, contagem dos itens sem tópico em `aria-live`; CTA "Gravar N itens", desabilitado enquanto faltar tópico) → **Pronto** (novos, já existentes com os números, se entram ou não nas sessões; CTA "Importar outra prova").
- A leitura é feita no navegador (`montarPrevia`). As Server Actions conferem o moderador fora do `try` (o `redirect` de `contextoDoUsuario` não pode ser engolido), validam a entrada com `previaSchema`/`importacaoSchema` e devolvem erro legível; falha da IA não trava a tela.

- [ ] **Step 1: Server Actions**

`src/app/(app)/importar/acoes.ts`:

```ts
"use server";

import { ErroIa } from "@/ai/tipos";
import { dadosDaImportacao, importarItensReais, registrarUsoSugestao, type ResultadoImportacao } from "@/db/repositorios/importacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { ErroImportacao, importacaoSchema, montarLoteReal, previaSchema } from "@/importacao/gravacao";
import { sugerirTopicos } from "@/importacao/topicos";
import { criarProvedores } from "@/pipeline/config";
import type { Retorno } from "../sessao/[id]/acoes";
import { contextoDoUsuario, exigirCargo } from "../contexto";

const SO_MODERADOR = { ok: false, erro: "Apenas moderadores importam itens." } as const;

// Fora do try: contextoDoUsuario e exigirCargo redirecionam, e o redirect não pode ser engolido.
async function moderador() {
  const { moderador } = await contextoDoUsuario();
  return moderador ? exigirCargo() : null;
}

function falha(e: unknown, padrao: string): { ok: false; erro: string } {
  if (e instanceof ErroImportacao) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: padrao };
}

// Sugestão de tópicos canônicos por IA (Claude, o primeiro de criarProvedores). Melhor-esforço:
// se falhar, a tela segue com a escolha manual.
export async function sugerir(grupos: unknown): Promise<Retorno<Record<number, string[]>>> {
  const ctx = await moderador();
  if (!ctx) return SO_MODERADOR;
  const lidos = previaSchema.safeParse(grupos);
  if (!lidos.success) return { ok: false, erro: "Prévia inválida. Volte e analise a prova de novo." };
  try {
    const { opcoes } = await dadosDaImportacao(ctx.db, ctx.cargo.id);
    const [claude] = criarProvedores();
    const registrarUso = registrarUsoSugestao(criarClienteServico());
    const r = await sugerirTopicos({ provedor: claude, registrarUso }, { grupos: lidos.data, opcoes });
    return { ok: true, dados: r.porItem };
  } catch (e) {
    if (e instanceof ErroIa) {
      console.error(e);
      return { ok: false, erro: "A IA não respondeu agora. Escolha os tópicos à mão ou tente de novo." };
    }
    return falha(e, "Não foi possível sugerir tópicos. Escolha à mão ou tente de novo.");
  }
}

export async function gravar(importacao: unknown): Promise<Retorno<ResultadoImportacao>> {
  const ctx = await moderador();
  if (!ctx) return SO_MODERADOR;
  const lida = importacaoSchema.safeParse(importacao);
  if (!lida.success) return { ok: false, erro: "Dados incompletos. Confira a prova de origem e os itens." };
  try {
    const { banca, opcoes } = await dadosDaImportacao(ctx.db, ctx.cargo.id);
    const lote = montarLoteReal({
      banca,
      importadoPor: ctx.user.email ?? ctx.user.id,
      importacao: lida.data,
      canonicosPermitidos: new Set(opcoes.map((o) => o.canonico)),
    });
    return { ok: true, dados: await importarItensReais(criarClienteServico(), lote) };
  } catch (e) {
    return falha(e, "Não foi possível gravar. Nada foi importado; tente de novo.");
  }
}
```

- [ ] **Step 2: Componentes**

`src/components/importar/previa-prova.tsx`:

```tsx
import { pilula } from "@/components/ui";
import type { GrupoPrevia, ItemPrevia } from "@/importacao/previa";

export function GabaritoOficial({ gabarito }: { gabarito: "C" | "E" }) {
  return <span className={gabarito === "C" ? pilula.azul : pilula.neutra}>{gabarito === "C" ? "Certo" : "Errado"}</span>;
}

// Texto-base recolhido: abre para conferir sem empurrar os itens para baixo.
export function TextoBase({ texto }: { texto: string }) {
  return (
    <details className="group rounded-lg border border-borda bg-papel">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-grafite">
        <span className="line-clamp-1">Texto-base: {texto.split("\n")[0]}</span>
      </summary>
      <div className="max-h-[40dvh] overflow-y-auto border-t border-borda px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-black/80">
        {texto}
      </div>
    </details>
  );
}

export function LinhaItem({ item, children }: { item: ItemPrevia; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start gap-3">
        <span className="w-8 shrink-0 pt-0.5 text-sm font-medium text-pedra tabular-nums">{item.numero}</span>
        <p className="flex-1 leading-relaxed">{item.enunciado}</p>
        <GabaritoOficial gabarito={item.gabarito} />
      </div>
      {children && <div className="pl-11">{children}</div>}
    </li>
  );
}

// Grupos lidos da prova: texto-base e itens com o gabarito oficial.
export function PreviaProva({ grupos }: { grupos: GrupoPrevia[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {grupos.map((g) => (
        <li key={g.itens[0].numero} className="rounded-xl border border-borda bg-white px-6 pt-5 pb-1">
          {g.textoBase ? <TextoBase texto={g.textoBase} /> : <p className="text-sm text-pedra">Itens sem texto-base</p>}
          <ul className="divide-y divide-borda">
            {g.itens.map((i) => (
              <LinhaItem key={i.numero} item={i} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
```

`src/components/importar/escolha-topicos.tsx`:

```tsx
"use client";

import { X } from "@phosphor-icons/react";
import type { GrupoPrevia } from "@/importacao/previa";
import type { OpcaoTopico } from "@/importacao/topicos";
import { LinhaItem, TextoBase } from "./previa-prova";

// Tópicos de cada item: os escolhidos viram etiquetas removíveis; o seletor acrescenta outro.
export function EscolhaTopicos({
  grupos,
  opcoes,
  topicos,
  sugeridos,
  aoMudar,
}: {
  grupos: GrupoPrevia[];
  opcoes: OpcaoTopico[];
  topicos: Record<number, string[]>;
  sugeridos: Record<number, string[]>;
  aoMudar: (numero: number, canonicos: string[]) => void;
}) {
  const porCanonico = new Map(opcoes.map((o) => [o.canonico, o]));
  const disciplinas = [...new Set(opcoes.map((o) => o.disciplina))];

  return (
    <ol className="flex flex-col gap-4">
      {grupos.map((g) => (
        <li key={g.itens[0].numero} className="rounded-xl border border-borda bg-white px-6 pt-5 pb-1">
          {g.textoBase ? <TextoBase texto={g.textoBase} /> : <p className="text-sm text-pedra">Itens sem texto-base</p>}
          <ul className="divide-y divide-borda">
            {g.itens.map((i) => {
              const escolhidos = topicos[i.numero] ?? [];
              return (
                <LinhaItem key={i.numero} item={i}>
                  <div className="flex flex-wrap items-center gap-2">
                    {escolhidos.length === 0 && <span className="text-sm text-[#8a5a00]">Sem tópico</span>}
                    {escolhidos.map((c) => {
                      const o = porCanonico.get(c);
                      const daIa = sugeridos[i.numero]?.includes(c);
                      return (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-black/5 py-1 pr-1 pl-3 text-xs font-medium text-black/80">
                          {o ? `${o.titulo} (${o.disciplina})` : c}
                          {daIa && <span className="text-pedra">· IA</span>}
                          <button
                            type="button"
                            onClick={() => aoMudar(i.numero, escolhidos.filter((x) => x !== c))}
                            aria-label={`Remover ${o?.titulo ?? c} do item ${i.numero}`}
                            className="rounded-full p-1 text-pedra transition-colors duration-200 hover:bg-black/10 hover:text-black"
                          >
                            <X size={12} weight="bold" aria-hidden />
                          </button>
                        </span>
                      );
                    })}
                    {escolhidos.length < 3 && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && aoMudar(i.numero, [...escolhidos, e.target.value])}
                        aria-label={`Adicionar tópico ao item ${i.numero}`}
                        className="max-w-full rounded-lg border border-borda-forte bg-white px-2 py-1 text-sm text-grafite"
                      >
                        <option value="">Adicionar tópico</option>
                        {disciplinas.map((d) => (
                          <optgroup key={d} label={d}>
                            {opcoes
                              .filter((o) => o.disciplina === d && !escolhidos.includes(o.canonico))
                              .map((o) => (
                                <option key={o.canonico} value={o.canonico}>
                                  {o.titulo}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                </LinhaItem>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
```

`src/components/importar/assistente.tsx`:

```tsx
"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { gravar, sugerir } from "@/app/(app)/importar/acoes";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import type { ResultadoImportacao } from "@/db/repositorios/importacao";
import { faixas, montarPrevia, type PreviaImportacao } from "@/importacao/previa";
import type { OpcaoTopico } from "@/importacao/topicos";
import { EscolhaTopicos } from "./escolha-topicos";
import { PreviaProva } from "./previa-prova";

type Etapa = "colar" | "previa" | "topicos" | "resumo";

const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: "colar", nome: "Colar a prova" },
  { id: "previa", nome: "Conferir" },
  { id: "topicos", nome: "Tópicos" },
  { id: "resumo", nome: "Pronto" },
];

const campo = "w-full rounded-lg border border-borda-forte bg-white px-3 py-2 text-[15px] placeholder:text-pedra";

function Passos({ atual }: { atual: Etapa }) {
  const indice = ETAPAS.findIndex((e) => e.id === atual);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Etapas da importação">
      {ETAPAS.map((e, k) => (
        <li
          key={e.id}
          aria-current={k === indice ? "step" : undefined}
          className={`flex items-center gap-2 ${k === indice ? "font-medium text-black" : k < indice ? "text-grafite" : "text-pedra"}`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
              k === indice ? "bg-black text-white" : "bg-black/5"
            }`}
          >
            {k + 1}
          </span>
          {e.nome}
        </li>
      ))}
    </ol>
  );
}

function Inconsistencias({ previa }: { previa: PreviaImportacao }) {
  const linhas = [
    previa.anulados.length > 0 && `Anulados, não entram: ${faixas(previa.anulados)}.`,
    previa.semGabarito.length > 0 && `Sem gabarito, não entram: ${faixas(previa.semGabarito)}.`,
    previa.gabaritoSemItem.length > 0 && `No gabarito, mas não encontrados no texto: ${faixas(previa.gabaritoSemItem)}.`,
    ...previa.avisos,
  ].filter((l): l is string => Boolean(l));
  if (linhas.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-grafite">
        <CheckCircle size={18} weight="fill" className="text-azul" aria-hidden />
        Nenhuma inconsistência entre o texto e o gabarito.
      </p>
    );
  }
  return (
    <div className="rounded-lg bg-marigold-claro px-4 py-3 text-sm text-[#5c3c00]" role="status">
      <p className="flex items-center gap-2 font-medium">
        <WarningCircle size={18} weight="fill" aria-hidden />
        Confira antes de seguir
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

// Importação em quatro etapas. A leitura da prova e do gabarito roda no navegador; a sugestão de
// tópicos e a gravação são Server Actions que conferem o moderador.
export function AssistenteImportacao({
  concurso,
  opcoes,
  reaisNasSessoes,
}: {
  concurso: string;
  opcoes: OpcaoTopico[];
  reaisNasSessoes: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa>("colar");
  const [provaOrigem, setProvaOrigem] = useState("");
  const [textoProva, setTextoProva] = useState("");
  const [textoGabarito, setTextoGabarito] = useState("");
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [topicos, setTopicos] = useState<Record<number, string[]>>({});
  const [sugeridos, setSugeridos] = useState<Record<number, string[]>>({});
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const itens = previa?.grupos.flatMap((g) => g.itens) ?? [];
  const semTopico = itens.filter((i) => (topicos[i.numero] ?? []).length === 0).map((i) => i.numero);

  function irPara(nova: Etapa) {
    setErro(null);
    setEtapa(nova);
    window.scrollTo({ top: 0 });
  }

  function analisar(ev: React.FormEvent) {
    ev.preventDefault();
    setPrevia(montarPrevia(textoProva, textoGabarito));
    setTopicos({});
    setSugeridos({});
    irPara("previa");
  }

  function pedirSugestao() {
    if (!previa) return;
    setErro(null);
    iniciar(async () => {
      const r = await sugerir(previa.grupos);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSugeridos(r.dados);
      setTopicos(r.dados);
      irPara("topicos");
    });
  }

  function confirmarGravacao() {
    if (!previa) return;
    setErro(null);
    iniciar(async () => {
      const r = await gravar({
        provaOrigem,
        grupos: previa.grupos.map((g) => ({
          textoBase: g.textoBase,
          itens: g.itens.map((i) => ({ ...i, canonicos: topicos[i.numero] ?? [] })),
        })),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultado(r.dados);
      irPara("resumo");
    });
  }

  function recomecar() {
    setTextoProva("");
    setTextoGabarito("");
    setPrevia(null);
    setResultado(null);
    irPara("colar");
  }

  const alerta = erro && (
    <p role="alert" className="text-sm text-vermelho">
      {erro}
    </p>
  );

  return (
    <div className="mt-8 flex flex-col gap-8">
      <Passos atual={etapa} />

      {etapa === "colar" && (
        <form onSubmit={analisar} className={`${cartao} flex max-w-3xl flex-col gap-6`}>
          <div className="flex flex-col gap-2">
            <label htmlFor="prova-origem" className="text-sm font-medium">
              Prova de origem
            </label>
            <input
              id="prova-origem"
              value={provaOrigem}
              onChange={(e) => setProvaOrigem(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              placeholder="CBM-AL 2021 Soldado"
              className={campo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="texto-prova" className="text-sm font-medium">
              Texto da prova
            </label>
            <p id="ajuda-prova" className="text-sm text-pedra">
              Cole os textos, os comandos (&quot;Julgue os itens a seguir...&quot;) e os itens numerados. Separe os blocos com uma linha em branco.
            </p>
            <textarea
              id="texto-prova"
              aria-describedby="ajuda-prova"
              value={textoProva}
              onChange={(e) => setTextoProva(e.target.value)}
              required
              rows={16}
              className={`${campo} leading-relaxed`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="texto-gabarito" className="text-sm font-medium">
              Gabarito oficial
            </label>
            <p id="ajuda-gabarito" className="text-sm text-pedra">
              Número e resposta (&quot;1 C 2 E 3 X&quot;) ou a tabela do gabarito definitivo. X ou ANULADO marca item anulado, que não é importado.
            </p>
            <textarea
              id="texto-gabarito"
              aria-describedby="ajuda-gabarito"
              value={textoGabarito}
              onChange={(e) => setTextoGabarito(e.target.value)}
              required
              rows={4}
              className={`${campo} font-mono text-sm`}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={provaOrigem.trim().length < 3 || !textoProva.trim() || !textoGabarito.trim()}
              className={botao.primario}
            >
              Analisar prova
            </button>
          </div>
        </form>
      )}

      {etapa === "previa" && previa && (
        <>
          <section className={`${cartao} flex flex-col gap-4`} aria-labelledby="titulo-previa">
            <h2 id="titulo-previa" className={titulo.secao}>
              {previa.total === 1 ? "1 item pronto para importar" : `${previa.total} itens prontos para importar`}
            </h2>
            <p className={textoApoio}>
              {provaOrigem}. Confira o texto-base de cada grupo e o gabarito de cada item.
            </p>
            <Inconsistencias previa={previa} />
            {alerta}
            <div className="flex flex-wrap gap-2">
              {previa.total > 0 && (
                <>
                  <button type="button" onClick={pedirSugestao} disabled={pendente} className={botao.primario}>
                    {pendente ? "Pedindo sugestões..." : "Sugerir tópicos com IA"}
                  </button>
                  <button type="button" onClick={() => irPara("topicos")} disabled={pendente} className={botao.contorno}>
                    Escolher tópicos sem IA
                  </button>
                </>
              )}
              <button type="button" onClick={() => irPara("colar")} disabled={pendente} className={botao.texto}>
                Voltar e corrigir o texto
              </button>
            </div>
          </section>
          <PreviaProva grupos={previa.grupos} />
        </>
      )}

      {etapa === "topicos" && previa && (
        <>
          <section className={`${cartao} flex flex-col gap-4`} aria-labelledby="titulo-topicos">
            <h2 id="titulo-topicos" className={titulo.secao}>
              Tópicos de cada item
            </h2>
            <p className={textoApoio}>
              Tópicos do edital de {concurso}. {Object.keys(sugeridos).length > 0 ? "As sugestões da IA vêm marcadas; confirme ou troque." : "Escolha ao menos um por item."}
            </p>
            <p className="text-sm text-grafite" aria-live="polite">
              {semTopico.length === 0 ? "Todos os itens têm tópico." : `Faltam tópicos nos itens ${faixas(semTopico)}.`}
            </p>
            {alerta}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={confirmarGravacao} disabled={pendente || semTopico.length > 0} className={botao.primario}>
                {pendente ? "Gravando..." : itens.length === 1 ? "Gravar 1 item" : `Gravar ${itens.length} itens`}
              </button>
              <button type="button" onClick={() => irPara("previa")} disabled={pendente} className={botao.texto}>
                Voltar
              </button>
            </div>
          </section>
          <EscolhaTopicos
            grupos={previa.grupos}
            opcoes={opcoes}
            topicos={topicos}
            sugeridos={sugeridos}
            aoMudar={(numero, canonicos) => setTopicos((t) => ({ ...t, [numero]: canonicos }))}
          />
        </>
      )}

      {etapa === "resumo" && resultado && (
        <section className={`${cartao} flex max-w-2xl flex-col gap-4`} aria-labelledby="titulo-resumo">
          <h2 id="titulo-resumo" className={titulo.secao}>
            {resultado.gravados === 1 ? "1 item gravado" : `${resultado.gravados} itens gravados`}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt className="text-pedra">Prova</dt>
            <dd>{provaOrigem}</dd>
            <dt className="text-pedra">Novos</dt>
            <dd className="tabular-nums">{resultado.gravados}</dd>
            <dt className="text-pedra">Já existiam</dt>
            <dd className="tabular-nums">
              {resultado.duplicados.length === 0 ? "nenhum" : `${resultado.duplicados.length} (itens ${faixas(resultado.duplicados)})`}
            </dd>
          </dl>
          <p className={textoApoio}>
            {reaisNasSessoes
              ? "Os itens entram como aprovados e já aparecem nas sessões de estudo dos tópicos escolhidos."
              : "Modo produto: os itens reais não aparecem nas sessões e servem só de referência de estilo para a geração."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={recomecar} className={botao.primario}>
              Importar outra prova
            </button>
            <Link href="/treinar" className={botao.texto}>
              Ir para o treino
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Página e link no menu**

`src/app/(app)/importar/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { AssistenteImportacao } from "@/components/importar/assistente";
import { textoApoio, titulo } from "@/components/ui";
import { dadosDaImportacao } from "@/db/repositorios/importacao";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import { contextoDoUsuario, exigirCargo } from "../contexto";

// A sugestão de tópicos chama a IA em paralelo, um lote a cada 25 itens; vale para as Server Actions da página.
export const maxDuration = 300;

export default async function Importar() {
  const { moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const { db, cargo } = await exigirCargo();
  const { concurso, opcoes } = await dadosDaImportacao(db, cargo.id);

  return (
    <>
      <h1 className={titulo.pagina}>Importar prova</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens reais de provas anteriores da banca, com o gabarito oficial. Entram aprovados, ligados aos tópicos do edital, e servem
        de referência de estilo para os itens gerados.
      </p>
      <AssistenteImportacao concurso={concurso.nome} opcoes={opcoes} reaisNasSessoes={itensReaisVisiveis()} />
    </>
  );
}
```

Em `src/app/(app)/layout.tsx`, depois do link de Itens:

```tsx
            {moderador && <NavLink href="/importar">Importar</NavLink>}
```

- [ ] **Step 4: Verificar e commit**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: sem erros; a rota `/importar` aparece como `ƒ` (dinâmica). O build passa sem `node:crypto` no navegador porque o assistente importa de `gravacao.ts` e `importacao.ts` só tipos.

```bash
git add src/app/\(app\)/importar src/components/importar src/app/\(app\)/layout.tsx
git commit -m "feat(ui): importação de provas reais em etapas para moderadores"
```

---

### Task 11: Documentação

**Files:**
- Modify: `.env.example`, `docs/deploy.md`

- [ ] **Step 1: `.env.example`**

Acrescente ao fim:

```
# Modo produto: false tira das sessões os itens reais de provas anteriores (ficam só como referência
# de estilo do gerador). Vazio ou true: visíveis, para uso pessoal.
ITENS_REAIS_VISIVEIS=
```

- [ ] **Step 2: `docs/deploy.md`**

Acrescente ao fim:

````markdown
## Importação de itens reais

Tela **Importar** (só moderadores): itens de provas anteriores da banca, com o gabarito oficial.

1. Informe a prova de origem (ex.: "CBM-AL 2021 Soldado") e cole o texto da prova e o gabarito. O texto é lido no navegador: textos-base e comandos ("Julgue os itens a seguir...") seguidos de itens numerados. O gabarito aceita "1 C 2 E 3 X", uma resposta por linha ou a tabela do gabarito definitivo do Cebraspe. Anulados (X) não entram.
2. Confira a prévia: grupos, gabaritos e inconsistências (item sem gabarito, gabarito sem item, saltos na numeração, texto que sobrou). Se algo estiver errado, volte e corrija o texto colado; uma linha em branco entre blocos resolve quase tudo.
3. Tópicos: a IA (Claude, com as chaves de IA do worker) sugere 1 ou 2 tópicos canônicos do concurso por item; confirme ou troque. Sem as chaves, ou se a IA falhar, escolha à mão. O custo vai para `ai_usage` com a finalidade `sugerir_topicos`.
4. Gravar: os itens entram como `origem = real`, `status = aprovado`, com `prova_origem` e o gabarito oficial. Itens com o mesmo texto (hash normalizado) já gravados contam como duplicados e não se repetem. Usa `SUPABASE_SECRET_KEY`.

Variável opcional `ITENS_REAIS_VISIVEIS` (Vercel, produção e preview). Vazia ou `true`: os itens reais entram nas sessões (uso pessoal). `false`: modo produto, os itens reais saem de treino, simulado e revisão e continuam como exemplos de estilo na geração.
````

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/deploy.md
git commit -m "docs: importação de itens reais e modo produto"
```

---

### Task 12: Verificação final

- [ ] **Step 1: Tudo verde**

Run: `npm run typecheck && npm run lint && npm test && npm run test:db && npm run build`
Expected: typecheck e lint limpos; 193 testes unitários (40 arquivos) e 36 de banco (5 arquivos) passando; build com a rota `/importar` além das do Plano 4.

- [ ] **Step 2: Roteiro manual no preview da Vercel (controlador)**

1. Como moderador, o menu mostra "Importar"; para outro e-mail, `/importar` dá 404.
2. Colar uma prova real curta (um texto-base com 3 itens e um bloco de 2 itens sem texto) e o gabarito com um X: a prévia mostra 4 itens, o anulado listado, nenhuma outra inconsistência.
3. Apagar o número de um item do gabarito: a prévia acusa "Sem gabarito".
4. "Sugerir tópicos com IA": cada item volta com 1 ou 2 tópicos marcados "IA"; trocar um; remover todos de um item e ver o botão de gravar desabilitado.
5. Gravar: resumo com 4 novos. Importar a mesma prova de novo: 0 novos, 4 já existentes.
6. Treinar o tópico de um item importado: o item aparece, com o texto-base. Com `ITENS_REAIS_VISIVEIS=false` no preview, ele some das sessões e a contagem de itens novos do `/treinar` cai.
7. Painel (moderador): a finalidade `sugerir_topicos` aparece no custo de IA do mês.

Fica para um plano seguinte: mostrar a prova de origem na correção dos itens reais, fechar a leitura direta de itens reais pela API em modo produto (RLS) e testes E2E com Playwright.

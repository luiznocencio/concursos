# Plano 9 — Corretor de discursiva, etapa 4: integração

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** ligar a redação ao resto do estudo:
- os erros de língua sobem a prioridade dos tópicos de Português no motor de foco;
- o painel ganha a seção "Redação";
- o simulado completo pode incluir a prova discursiva (4h30, com o aviso do item 9.7.1);
- moderadores importam temas reais de discursiva.

**Arquitetura:**
- **Banco:** `estudo_historico` (migração 0012) devolve também os erros de redação, marcados com `origem: "redacao"`.
- **Motor de foco:** o repositório converte esses registros em `peso = CONFIG_FOCO.pesoErroRedacao`.
- **Painel:** a prioridade usa tudo, mas respostas, aproveitamento e tendência mostram só os itens.
- **Simulado:** marca `discursiva: true` na configuração, e a redação fica ligada a ele por `redacoes.simulado_id`. O player ganha a aba "Redação", e a entrega do simulado também entrega a redação.
- **Importação:** o tema real é lido e validado em `src/importacao/tema.ts` e gravado pela função do banco `discursiva_importar_temas`, que só a chave de serviço executa.

**Stack:** Next.js 16.4 (App Router, Server Actions, `useActionState`), React 19.3, Tailwind v4, Supabase, Vitest, Playwright.

Especificação: `docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md` (§6 importação, §7 integração).

## Restrições globais

- Código, comentários, textos de tela e commits em português, no estilo do código existente. Não rode formatadores (Prettier) em arquivos inteiros.
- Visual de `docs/design/DESIGN.md`:
  - só os tokens e as classes de `src/components/ui.ts`;
  - um só botão azul cheio por tela;
  - nenhum estouro horizontal em 390 px.
- Consulte `node_modules/next/dist/docs/` antes de usar algo do Next que não esteja no código (veja `AGENTS.md`).
- Nenhum teste chama IA real; o worker não roda no E2E.
- Agentes: **não** deem push; **não** alterem `.env.local`, `src/db/types.ts`, `supabase/migrations/` nem o Supabase remoto. A Tarefa 1 é do controlador.
- Cada tarefa termina com `npm run typecheck`, `npm run lint` e `npm test` passando, e um commit com as linhas finais:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011ToQbiqbi5jXjUo6r9BQ2G
  ```
- Quando o plano mostra o arquivo inteiro de um arquivo que já existe, substitua o conteúdo por inteiro: é a versão validada.

---

### Tarefa 1 (controlador): migração 0012

Feita pelo controlador, não por agente.

**Arquivos:**
- Criar: `supabase/migrations/0012_historico_com_redacao.sql`
- Modificar: `src/db/discursiva.dbtest.ts` (teste novo no fim)

- [ ] **Passo 1: Teste de banco**

Substitua `src/db/discursiva.dbtest.ts` por:

`src/db/discursiva.dbtest.ts`:

```ts
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { parseEdital } from "../core/edital/parse";
import { comoUsuario, criarBancoDeTeste } from "./testing/banco";
import { sqlDoEdital } from "./seed/edital-sql";

const ANA = "00000000-0000-0000-0000-00000000000a";
const BRUNO = "00000000-0000-0000-0000-00000000000b";

let client: Client;
let destruir: () => Promise<void>;
let temaAprovado: string;

async function valor<T>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await client.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}

const padrao = { aspectos: [{ codigo: "1", descricao: "Tema", pontos: 30 }], expectativas: "x" };

// Cria uma redação direto como administrador (as gravações de comoUsuario são desfeitas no fim).
async function redacao(usuario: string, status = "rascunho", extra = ""): Promise<string> {
  return valor<string>(
    `insert into public.redacoes (usuario_id, tema_id, status, linhas${extra ? ", entregue_em" : ""})
     values ($1, $2, $3, '{"Texto da redação"}'${extra ? `, ${extra}` : ""}) returning id`,
    [usuario, temaAprovado, status],
  );
}

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query("insert into auth.users (id, email) values ($1, 'ana@x.com'), ($2, 'bruno@x.com')", [ANA, BRUNO]);
  await client.query(sqlDoEdital(parseEdital(readFileSync("editais/cbmal-2026/edital.yaml", "utf8"))));
  await client.query("set role service_role");
  await valor("select public.discursiva_importar_temas($1)", [
    { concurso: "cbmal-2026", prova_origem: "CBM-AL 2021", temas: [{ enunciado: "Tema real", padrao_resposta: padrao }] },
  ]);
  await client.query("reset role");
  temaAprovado = await valor<string>("select id from public.temas_discursiva where enunciado = 'Tema real'");
  await client.query(
    `insert into public.temas_discursiva (concurso_id, prova_id, origem, status, enunciado, padrao_resposta, hash)
     select concurso_id, prova_id, 'gerado', 'revisao', 'Tema em revisão', padrao_resposta, 'h-revisao'
     from public.temas_discursiva where id = $1`,
    [temaAprovado],
  );
});

afterAll(async () => {
  await destruir();
});

describe("edital", () => {
  it("guarda caracteres_por_linha na configuração da discursiva", async () => {
    const config = await valor<Record<string, number>>(
      "select config_discursiva from public.provas where slug = 'discursiva'",
    );
    expect(config).toEqual({ pontuacao_maxima: 30, linhas_max: 30, nota_minima: 15, caracteres_por_linha: 70 });
  });
});

describe("discursiva_importar_temas", () => {
  it("grava tema real e acusa duplicado pelo enunciado normalizado", async () => {
    await client.query("set role service_role");
    try {
      const r = await valor("select public.discursiva_importar_temas($1)", [
        {
          concurso: "cbmal-2026",
          prova_origem: "CBM-AL 2021",
          temas: [
            { enunciado: "  tema   REAL ", padrao_resposta: padrao },
            { enunciado: "Outro tema", padrao_resposta: padrao },
          ],
        },
      ]);
      expect(r).toEqual({ gravados: 1, duplicados: [0] });
    } finally {
      await client.query("reset role");
    }
  });

  it("exige prova de origem", async () => {
    await expect(
      valor("select public.discursiva_importar_temas($1)", [{ concurso: "cbmal-2026", temas: [] }]),
    ).rejects.toThrow(/prova de origem/);
  });

  it("usuário comum não pode importar", async () => {
    await expect(
      comoUsuario(client, ANA, () =>
        valor("select public.discursiva_importar_temas($1)", [{ concurso: "cbmal-2026", prova_origem: "x", temas: [] }]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("RLS", () => {
  it("usuário só vê temas aprovados", async () => {
    const temas = await comoUsuario(client, ANA, async () =>
      (await client.query("select enunciado from public.temas_discursiva order by enunciado")).rows.map((r) => r.enunciado),
    );
    expect(temas).toEqual(["Outro tema", "Tema real"]);
  });

  it("usuário cria rascunho só com tema aprovado", async () => {
    await comoUsuario(client, ANA, () =>
      client.query("insert into public.redacoes (usuario_id, tema_id) values ($1, $2)", [ANA, temaAprovado]),
    );
    const revisao = await valor<string>("select id from public.temas_discursiva where hash = 'h-revisao'");
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.redacoes (usuario_id, tema_id) values ($1, $2)", [ANA, revisao]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("usuário não grava estado nem nota", async () => {
    const id = await redacao(ANA);
    await expect(
      comoUsuario(client, ANA, () => client.query("update public.redacoes set npd = 30 where id = $1", [id])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      comoUsuario(client, ANA, () =>
        client.query("insert into public.redacoes (usuario_id, tema_id, status) values ($1, $2, 'corrigida')", [ANA, temaAprovado]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("dono edita as linhas só enquanto escreve; outro usuário não vê", async () => {
    const id = await redacao(ANA);
    const corrigida = await redacao(ANA, "corrigida");
    const alteradas = await comoUsuario(client, ANA, async () => {
      const a = await client.query("update public.redacoes set linhas = '{\"Novo\"}' where id = $1", [id]);
      const b = await client.query("update public.redacoes set linhas = '{\"Novo\"}' where id = $1", [corrigida]);
      return [a.rowCount, b.rowCount];
    });
    expect(alteradas).toEqual([1, 0]);
    const vistas = await comoUsuario(client, BRUNO, async () =>
      (await client.query("select count(*)::int as n from public.redacoes")).rows[0].n,
    );
    expect(vistas).toBe(0);
  });

  it("dono grava o texto digitado só no rascunho", async () => {
    const id = await redacao(ANA);
    const entregue = await redacao(ANA, "na_fila");
    const alteradas = await comoUsuario(client, ANA, async () => {
      const a = await client.query("update public.redacoes set texto = 'Meu texto' where id = $1", [id]);
      const b = await client.query("update public.redacoes set texto = 'Meu texto' where id = $1", [entregue]);
      return [a.rowCount, b.rowCount];
    });
    expect(alteradas).toEqual([1, 0]);
  });

  it("correções e erros só para o dono da redação", async () => {
    const id = await redacao(ANA, "corrigida");
    await client.query(
      `insert into public.correcoes_discursiva (redacao_id, papel, provedor, modelo, resposta)
       values ($1, 'lingua', 'anthropic', 'm', '{}')`,
      [id],
    );
    await client.query(
      `insert into public.erros_redacao (redacao_id, usuario_id, linha, trecho, tipo, categoria, correcao, explicacao, canonico)
       values ($1, $2, 1, 'Texto', 'grafia', 'ortografia', 'x', 'y', 'portugues/ortografia')`,
      [id, ANA],
    );
    const contar = (usuario: string) =>
      comoUsuario(client, usuario, async () => {
        const c = await client.query("select count(*)::int as n from public.correcoes_discursiva where redacao_id = $1", [id]);
        const e = await client.query("select count(*)::int as n from public.erros_redacao where redacao_id = $1", [id]);
        return [c.rows[0].n, e.rows[0].n];
      });
    expect(await contar(ANA)).toEqual([1, 1]);
    expect(await contar(BRUNO)).toEqual([0, 0]);
  });

  it("fotos: cada usuário envia só para a própria pasta do bucket", async () => {
    const enviar = (usuario: string, nome: string) =>
      comoUsuario(client, usuario, () =>
        client.query("insert into storage.objects (bucket_id, name) values ('redacoes-fotos', $1)", [nome]),
      );
    await enviar(ANA, `${ANA}/r1/1.jpg`);
    await expect(enviar(ANA, `${BRUNO}/r1/1.jpg`)).rejects.toThrow(/row-level security/);
  });
});

describe("discursiva_entregar", () => {
  it("põe na fila e cria o job de correção", async () => {
    const id = await redacao(BRUNO);
    await comoUsuario(client, BRUNO, async () => {
      await client.query("select public.discursiva_entregar($1)", [id]);
      const r = await client.query("select status, entregue_em is not null as entregue from public.redacoes where id = $1", [id]);
      expect(r.rows[0]).toEqual({ status: "na_fila", entregue: true });
    });
    // comoUsuario desfaz a transação: a verificação do job é feita dentro dela.
  });

  it("enfileira o job com a redação e quem pediu", async () => {
    const id = await redacao(BRUNO);
    const job = await comoUsuario(client, BRUNO, async () => {
      await client.query("select public.discursiva_entregar($1)", [id]);
      await client.query("reset role");
      return (await client.query("select tipo, payload from public.jobs where payload->>'redacao_id' = $1", [id])).rows[0];
    });
    expect(job).toEqual({ tipo: "corrigir_redacao", payload: { redacao_id: id, pedido_por: BRUNO } });
  });

  it("recusa redação de outro usuário e estado inválido", async () => {
    const daAna = await redacao(ANA);
    await expect(
      comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [daAna])),
    ).rejects.toThrow(/não encontrada/);
    const corrigida = await redacao(BRUNO, "corrigida");
    await expect(
      comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [corrigida])),
    ).rejects.toThrow(/estado corrigida/);
  });

  it("aceita entregar de novo uma redação que falhou", async () => {
    const id = await redacao(BRUNO, "falhou");
    await comoUsuario(client, BRUNO, () => client.query("select public.discursiva_entregar($1)", [id]));
  });

  it("limita a 2 redações em correção ao mesmo tempo", async () => {
    const CARLA = "00000000-0000-0000-0000-00000000000c";
    await client.query("insert into auth.users (id, email) values ($1, 'carla@x.com')", [CARLA]);
    await redacao(CARLA, "na_fila");
    await redacao(CARLA, "corrigindo");
    const id = await redacao(CARLA);
    await expect(
      comoUsuario(client, CARLA, () => client.query("select public.discursiva_entregar($1)", [id])),
    ).rejects.toThrow(/limite_simultaneas/);
  });

  it("limita a 10 entregas por dia", async () => {
    const DANI = "00000000-0000-0000-0000-00000000000d";
    await client.query("insert into auth.users (id, email) values ($1, 'dani@x.com')", [DANI]);
    for (let i = 0; i < 10; i++) await redacao(DANI, "corrigida", "now()");
    const id = await redacao(DANI);
    await expect(
      comoUsuario(client, DANI, () => client.query("select public.discursiva_entregar($1)", [id])),
    ).rejects.toThrow(/limite_diario/);
  });
});

describe("discursiva_enviar_fotos", () => {
  it("registra as fotos e enfileira a transcrição", async () => {
    const id = await redacao(ANA);
    const r = await comoUsuario(client, ANA, async () => {
      await client.query("select public.discursiva_enviar_fotos($1, $2)", [id, [`${ANA}/${id}/1.jpg`]]);
      return (await client.query("select status, entrada, fotos from public.redacoes where id = $1", [id])).rows[0];
    });
    expect(r).toEqual({ status: "transcrevendo", entrada: "foto", fotos: [`${ANA}/${id}/1.jpg`] });
  });

  it("recusa foto fora da pasta do usuário e quantidade inválida", async () => {
    const id = await redacao(ANA);
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_enviar_fotos($1, $2)", [id, [`${BRUNO}/x.jpg`]])),
    ).rejects.toThrow(/fora da pasta/);
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_enviar_fotos($1, $2)", [id, []])),
    ).rejects.toThrow(/1 ou 2 fotos/);
  });
});

describe("discursiva_pedir_tema", () => {
  it("enfileira um pedido por vez por usuário", async () => {
    const r = await comoUsuario(client, ANA, async () => {
      const a = await valor<boolean>("select public.discursiva_pedir_tema('cbmal-2026')");
      const b = await valor<boolean>("select public.discursiva_pedir_tema('cbmal-2026')");
      return [a, b];
    });
    expect(r).toEqual([true, false]);
  });

  it("recusa concurso desconhecido", async () => {
    await expect(
      comoUsuario(client, ANA, () => client.query("select public.discursiva_pedir_tema('nada')")),
    ).rejects.toThrow(/concurso desconhecido/);
  });
});

describe("estudo_historico com erros de redação", () => {
  it("inclui os erros de redação do usuário nos tópicos do cargo, marcados como origem redacao", async () => {
    const id = await redacao(ANA, "corrigida");
    const erro = (usuario: string, canonico: string) =>
      client.query(
        `insert into public.erros_redacao (redacao_id, usuario_id, linha, trecho, tipo, categoria, correcao, explicacao, canonico)
         values ($1, $2, 1, 'Texto', 'morfossintaxe', 'crase', 'x', 'y', $3)`,
        [id, usuario, canonico],
      );
    await erro(ANA, "portugues/crase");
    await erro(BRUNO, "portugues/crase");
    // Tópico que não cai nas objetivas do cargo (só na discursiva): fica fora.
    await erro(ANA, "atualidades/temas-atuais");
    const cargo = await valor<string>("select id from public.cargos where slug = 'cfo'");
    const historico = await comoUsuario(client, ANA, () =>
      valor<{ canonico: string; resultado: string; origem: string }[]>("select public.estudo_historico($1)", [cargo]),
    );
    // Um teste anterior já gravou um erro de ortografia da Ana; o do Bruno e o de Atualidades não entram.
    expect(historico.map(({ canonico, resultado, origem }) => `${canonico}:${resultado}:${origem}`).sort()).toEqual([
      "portugues/crase:errado:redacao",
      "portugues/ortografia:errado:redacao",
    ]);
  });
});
```

Run: `npm run test:db`. Esperado: FALHA (`origem` ausente no histórico).

- [ ] **Passo 2: Migração**

`supabase/migrations/0012_historico_com_redacao.sql`:

```sql
-- Histórico do motor de foco com os erros de redação: cada erro de língua vira um "errado" no tópico
-- de Português ligado à categoria. O app dá a esses registros peso menor (CONFIG_FOCO.pesoErroRedacao)
-- e os deixa fora das estatísticas de itens do painel. Igual à 0007, mais o campo "origem".
create or replace function public.estudo_historico(p_cargo uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(h.registro order by h.quando), '[]'::jsonb)
  from (
    select r.respondida_em as quando, jsonb_build_object(
      'canonico', tc.slug,
      'resultado', case
        when r.resposta = 'branco' then 'branco'
        when r.resposta = i.gabarito then case when r.duvida then 'certo_duvida' else 'certo' end
        else 'errado'
      end,
      'respondidaEm', r.respondida_em,
      'origem', 'item'
    ) as registro
    from public.respostas r
    join public.simulados s on s.id = r.simulado_id
    join public.itens i on i.id = r.item_id and i.status in ('aprovado', 'revisao')
    join public.item_topicos it on it.item_id = i.id
    join public.topicos_canonicos tc on tc.id = it.topico_canonico_id
    where r.user_id = (select auth.uid())
      and (s.modo <> 'completo' or s.finalizado_em is not null)
      and it.topico_canonico_id in (select public.estudo_canonicos_do_cargo(p_cargo))
    union all
    select e.criado_em, jsonb_build_object(
      'canonico', e.canonico, 'resultado', 'errado', 'respondidaEm', e.criado_em, 'origem', 'redacao'
    )
    from public.erros_redacao e
    join public.topicos_canonicos tc on tc.slug = e.canonico
    where e.usuario_id = (select auth.uid())
      and tc.id in (select public.estudo_canonicos_do_cargo(p_cargo))
  ) h
$$;
```

Run: `npm run test:db`. Esperado: PASSA (58 testes).

- [ ] **Passo 3: Aplicar e publicar**

`apply_migration` no remoto (nome `0012_historico_com_redacao`). Os tipos não mudam, porque a função continua devolvendo `Json`.

```bash
git add supabase/migrations/0012_historico_com_redacao.sql src/db/discursiva.dbtest.ts
git commit -m "feat(db): erros de redação no histórico do motor de foco"
git push
```

---

### Tarefa 2: erros de redação no motor de foco e no painel de desempenho

**Arquivos:**
- Modificar: `src/db/repositorios/estudo.ts`, `src/estudo/painel.ts`
- Testes: `src/db/repositorios/estudo.test.ts`, `src/estudo/painel.test.ts`

**Interfaces:**
- Consome: `CONFIG_FOCO.pesoErroRedacao` e `RespostaHistorico.peso` (plano 6).
- Produz:
  - `historicoDasLinhas(linhas): RespostaHistorico[]` (em `estudo.ts`);
  - `soItens(historico)` (em `painel.ts`);
  - `tabelaDesempenho`, que agora calcula `n`, `aproveitamento`, brancos e tendência só com os itens, e a prioridade com o histórico completo;
  - `configSessaoSchema`, que aceita `discursiva?: boolean` no simulado completo (usado na Tarefa 4).

- [ ] **Passo 1: Testes**

Substitua `src/db/repositorios/estudo.test.ts` e `src/estudo/painel.test.ts` por:

`src/db/repositorios/estudo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { filtrarCandidatos, historicoDasLinhas, itensDaSessao, provaOrigemVisivel, type Cliente } from "./estudo";

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

describe("historicoDasLinhas", () => {
  it("converte a data e dá peso 0,5 aos erros de redação", () => {
    expect(
      historicoDasLinhas([
        { canonico: "portugues/crase", resultado: "certo", respondidaEm: "2026-10-15T12:00:00Z", origem: "item" },
        { canonico: "portugues/crase", resultado: "errado", respondidaEm: "2026-10-16T12:00:00Z", origem: "redacao" },
        { canonico: "portugues/crase", resultado: "branco", respondidaEm: "2026-10-16T12:00:00Z" },
      ]),
    ).toEqual([
      { canonico: "portugues/crase", resultado: "certo", respondidaEm: new Date("2026-10-15T12:00:00Z") },
      { canonico: "portugues/crase", resultado: "errado", respondidaEm: new Date("2026-10-16T12:00:00Z"), peso: 0.5 },
      { canonico: "portugues/crase", resultado: "branco", respondidaEm: new Date("2026-10-16T12:00:00Z") },
    ]);
  });
});

describe("provaOrigemVisivel", () => {
  it("mostra a prova só nas questões reais", () => {
    expect(provaOrigemVisivel("real", "CEBRASPE 2021 · PC-AL · Agente")).toBe("CEBRASPE 2021 · PC-AL · Agente");
    expect(provaOrigemVisivel("ia", "CEBRASPE 2021 · PC-AL · Agente")).toBeNull();
    expect(provaOrigemVisivel("real", null)).toBeNull();
    expect(provaOrigemVisivel("real", "  ")).toBeNull();
  });
});

// Cliente mínimo: cada consulta encadeada resolve com as linhas da tabela pedida.
function clienteFalso(tabelas: Record<string, unknown[]>): Cliente {
  return {
    from(tabela: string) {
      const consulta = {
        select: () => consulta,
        eq: () => consulta,
        order: () => consulta,
        then: (ok: (r: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: tabelas[tabela], error: null }).then(ok),
      };
      return consulta;
    },
  } as unknown as Cliente;
}

describe("itensDaSessao", () => {
  const item = (id: string, origem: string, prova_origem: string | null) => ({
    id,
    enunciado: `enunciado ${id}`,
    gabarito: "C",
    justificativa: "porque sim",
    citacao: null,
    origem,
    prova_origem,
    fontes: null,
    textos_base: null,
    item_topicos: [],
  });
  const db = clienteFalso({
    simulado_itens: [
      { ordem: 0, itens: item("real", "real", "CEBRASPE 2021 · PC-AL") },
      { ordem: 1, itens: item("ia", "ia", null) },
    ],
    respostas: [{ item_id: "real", resposta: "C", duvida: false }],
  });

  it("manda a prova de origem junto com a correção, só nas questões reais", async () => {
    const itens = await itensDaSessao(db, "s1", () => true);
    expect(itens.map((i) => i.correcao?.provaOrigem)).toEqual(["CEBRASPE 2021 · PC-AL", null]);
  });

  it("não manda a origem enquanto a correção não pode ser vista (simulado em andamento)", async () => {
    const itens = await itensDaSessao(db, "s1", () => false);
    expect(itens.map((i) => i.correcao)).toEqual([null, null]);
    expect(JSON.stringify(itens)).not.toContain("CEBRASPE");
  });
});
```

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

describe("tabelaDesempenho com erros de redação", () => {
  const topicos: TopicoAlvo[] = [{ disciplina: "lp", codigo: "1", titulo: "Crase", canonico: "lp/crase", chave: "lp:1", peso: 1 }];

  it("os erros de redação sobem a prioridade, mas não contam como respostas nem na tendência", () => {
    const itens = [r("lp/crase", "certo", 1)];
    const comRedacao = [...itens, { ...r("lp/crase", "errado", 1), peso: 0.5 }];
    const so = tabelaDesempenho(topicos, calcularPrioridades(topicos, itens, AGORA), itens, AGORA)[0];
    const com = tabelaDesempenho(topicos, calcularPrioridades(topicos, comRedacao, AGORA), comRedacao, AGORA)[0];
    expect(com.topicos[0]).toMatchObject({ n: 1, aproveitamento: 1, tendencia: [null, null, null, 1] });
    expect(com).toMatchObject({ n: 1, aproveitamento: 1 });
    expect(com.topicos[0].prioridade).toBeGreaterThan(so.topicos[0].prioridade);
  });
});

describe("diasAte", () => {
  it("conta os dias até a prova no horário de Brasília e nunca fica negativo", () => {
    expect(diasAte("2026-10-20", AGORA)).toBe(5);
    expect(diasAte("2026-01-01", AGORA)).toBe(0);
  });
});
```

Run: `npx vitest run src/db src/estudo/painel.test.ts`
Esperado: FALHA (`historicoDasLinhas` não existe; o teste de redação no painel falha).

- [ ] **Passo 2: Implementar**

Substitua `src/db/repositorios/estudo.ts` e `src/estudo/painel.ts` por:

`src/db/repositorios/estudo.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CONFIG_FOCO, type ItemCandidato, type RespostaHistorico } from "@/core";
import { montarEstruturaCargo, type EstruturaCargo, type LinhaCargo } from "@/estudo/estrutura";
import type { ConfigSessao, ItemCorrecao, Marcacao, ModoSessao, RepositorioEstudo, ResultadoSessao } from "@/estudo/tipos";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import type { Database, Json } from "../types";

export type Cliente = SupabaseClient<Database>;

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

const candidatosSchema = z.array(
  z.object({
    id: z.string(),
    textoBaseId: z.string().nullable(),
    canonicos: z.array(z.string()),
    visto: z.boolean(),
    origem: z.enum(["real", "ia"]),
  }),
);
const historicoSchema = z.array(
  z.object({
    canonico: z.string(),
    resultado: z.enum(["certo", "certo_duvida", "errado", "branco"]),
    respondidaEm: z.string(),
    origem: z.enum(["item", "redacao"]).default("item"),
  }),
);

// Erros de redação entram no histórico com peso menor que um item respondido (ver CONFIG_FOCO).
export function historicoDasLinhas(linhas: z.input<typeof historicoSchema>): RespostaHistorico[] {
  return historicoSchema.parse(linhas).map(({ origem, respondidaEm, ...r }) => ({
    ...r,
    respondidaEm: new Date(respondidaEm),
    ...(origem === "redacao" ? { peso: CONFIG_FOCO.pesoErroRedacao } : {}),
  }));
}
export const configSessaoSchema: z.ZodType<ConfigSessao> = z.union([
  z.object({ tipo: z.literal("estudar_agora") }),
  z.object({ tipo: z.literal("topico"), canonicos: z.array(z.string()) }),
  z.object({ tipo: z.literal("revisao") }),
  z.object({
    tipo: z.literal("completo"),
    duracaoMin: z.number(),
    provas: z.array(z.object({ slug: z.string(), itens: z.array(z.string()) })),
    disciplinaDoItem: z.record(z.string(), z.string()),
    discursiva: z.boolean().optional(),
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

// Em modo produto (itensReais = false) os itens reais saem das sessões: sem candidato, eles também
// não entram em treino, simulado nem revisão. O gerador continua a usá-los como referência de estilo.
export function filtrarCandidatos(linhas: z.infer<typeof candidatosSchema>, itensReais: boolean): ItemCandidato[] {
  return linhas
    .filter((l) => itensReais || l.origem !== "real")
    .map(({ id, textoBaseId, canonicos, visto }) => ({ id, textoBaseId, canonicos, visto }));
}

// Só questão real mostra de onde veio; item de IA (ou real sem a prova anotada) não mostra nada.
export function provaOrigemVisivel(origem: string, provaOrigem: string | null): string | null {
  if (origem !== "real") return null;
  return provaOrigem?.trim() || null;
}

// Implementação com o cliente do usuário: o RLS garante que cada um só vê e grava o que é seu.
export function criarRepositorioEstudo(db: Cliente, opcoes: { itensReais?: boolean } = {}): RepositorioEstudo {
  const itensReais = opcoes.itensReais ?? itensReaisVisiveis();
  const estruturas = new Map<string, Promise<EstruturaCargo>>();

  return {
    estrutura(cargoId) {
      if (!estruturas.has(cargoId)) estruturas.set(cargoId, carregarEstrutura(db, cargoId));
      return estruturas.get(cargoId)!;
    },

    async candidatos(cargoId) {
      const { data, error } = await db.rpc("estudo_candidatos", { p_cargo: cargoId });
      if (error) falhou("candidatos", error);
      return filtrarCandidatos(candidatosSchema.parse(data), itensReais);
    },

    async historico(cargoId) {
      const { data, error } = await db.rpc("estudo_historico", { p_cargo: cargoId });
      if (error) falhou("histórico", error);
      return historicoDasLinhas(data as z.input<typeof historicoSchema>);
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
      const { data, error } = await db.from("itens").select("id, gabarito, justificativa, citacao, origem, prova_origem, fontes(titulo)")
        .in("id", ids);
      if (error) falhou("itens", error);
      return data.map((i) => ({
        id: i.id,
        gabarito: i.gabarito,
        justificativa: i.justificativa,
        citacao: i.citacao,
        fonte: i.fontes?.titulo ?? null,
        provaOrigem: provaOrigemVisivel(i.origem, i.prova_origem),
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
    concursoSlug: c.concursos.slug,
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
  // A prova de origem vem junto: no simulado ela denunciaria que a questão é real.
  correcao: Omit<ItemCorrecao, "id"> | null;
}

// Itens para a tela da sessão. O gabarito nunca vai ao navegador antes da hora.
export async function itensDaSessao(db: Cliente, sessaoId: string, podeVerCorrecao: (respondido: boolean) => boolean) {
  const { data, error } = await db
    .from("simulado_itens")
    .select(
      "ordem, itens!inner(id, enunciado, gabarito, justificativa, citacao, origem, prova_origem, fontes(titulo), textos_base(conteudo), item_topicos(topicos_canonicos(titulo)))",
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
        ? {
            gabarito: i.gabarito,
            justificativa: i.justificativa,
            citacao: i.citacao,
            fonte: i.fontes?.titulo ?? null,
            provaOrigem: provaOrigemVisivel(i.origem, i.prova_origem),
          }
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

`src/estudo/painel.ts`:

```ts
import { calcularPrioridades, VALOR_RESULTADO, type PrioridadeTopico, type RespostaHistorico, type TopicoAlvo } from "@/core";

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

// Itens respondidos, sem os erros de redação (que só entram na prioridade do motor de foco).
export function soItens(historico: RespostaHistorico[]): RespostaHistorico[] {
  return historico.filter((r) => r.peso === undefined);
}

// Tabela do painel: tópicos na ordem do edital, agrupados por disciplina. A prioridade vem do motor de foco
// (com os erros de redação); respostas, aproveitamento, brancos e tendência contam só os itens.
export function tabelaDesempenho(
  topicosAlvo: TopicoAlvo[],
  prioridades: PrioridadeTopico[],
  historicoCompleto: RespostaHistorico[],
  agora: Date,
): LinhaDisciplina[] {
  const historico = soItens(historicoCompleto);
  const doItens = new Map(calcularPrioridades(topicosAlvo, historico, agora).map((p) => [p.chave, p]));
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
      n: doItens.get(p.chave)?.n ?? 0,
      aproveitamento: doItens.get(p.chave)?.aproveitamento ?? 0,
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

- [ ] **Passo 3: Verificar**

Run: `npx vitest run src/db src/estudo && npm run typecheck`
Esperado: PASSA (2 testes novos).

- [ ] **Passo 4: Commit**

```bash
git add src/db/repositorios/estudo.ts src/db/repositorios/estudo.test.ts src/estudo/painel.ts src/estudo/painel.test.ts
git commit -m "feat(foco): erros de redação na prioridade, fora das estatísticas de itens"
```

---

### Tarefa 3: funções e repositório da redação para painel e simulado

**Arquivos:**
- Modificar: `src/lib/redacao.ts`, `src/lib/redacao.test.ts`, `src/db/repositorios/redacao.ts`

**Interfaces:**
- Produz:
  - **Painel:** `resumoDasRedacoes(redacoes, erros, agora): ResumoRedacoes` (`{ ultima, media, pontos, categorias }`).
  - **Simulado:** `escolherTemaDoSimulado(temas)`, que prefere tema real ainda não feito, depois gerado não feito, depois qualquer um.
  - **Repositório:**
    - `errosDesde(db, desde)`;
    - `criarRedacao(db, usuarioId, temaId, simuladoId?)`;
    - `redacaoDoSimulado(db, simuladoId): RedacaoCompleta | null`.

- [ ] **Passo 1: Teste**

Substitua `src/lib/redacao.test.ts` por:

`src/lib/redacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  escolherTemaDoSimulado,
  mensagemDoBanco,
  passosDoAndamento,
  resumoDasRedacoes,
  resumoDoTema,
  rotuloStatus,
  segmentosDaLinha,
  validarFoto,
} from "./redacao";

describe("rotuloStatus", () => {
  it("traduz os estados da redação", () => {
    expect(rotuloStatus("na_fila")).toEqual({ texto: "Em correção", tom: "alerta" });
    expect(rotuloStatus("corrigindo")).toEqual({ texto: "Em correção", tom: "alerta" });
    expect(rotuloStatus("corrigida")).toEqual({ texto: "Corrigida", tom: "azul" });
    expect(rotuloStatus("falhou")).toEqual({ texto: "Falhou", tom: "erro" });
  });
});

describe("passosDoAndamento", () => {
  it("mostra as três etapas e marca as concluídas", () => {
    expect(passosDoAndamento("corrigindo", ["conteudo_1", "lingua"])).toEqual([
      { nome: "Banca 1 avaliando o conteúdo", feito: true },
      { nome: "Banca 2 avaliando o conteúdo", feito: false },
      { nome: "Revisão de língua portuguesa", feito: true },
    ]);
  });

  it("acrescenta a terceira correção quando as três primeiras terminaram", () => {
    const passos = passosDoAndamento("corrigindo", ["conteudo_1", "conteudo_2", "lingua"]);
    expect(passos.at(-1)).toEqual({ nome: "Terceira correção (as bancas divergiram)", feito: false });
  });

  it("na transcrição, um passo só", () => {
    expect(passosDoAndamento("transcrevendo", [])).toEqual([{ nome: "Lendo a foto da folha", feito: false }]);
  });
});

describe("segmentosDaLinha", () => {
  it("marca os trechos com o número do erro, ignorando caixa", () => {
    expect(segmentosDaLinha("Os bombeiros chegou cedo a festa.", [
      { numero: 1, trecho: "BOMBEIROS CHEGOU" },
      { numero: 2, trecho: "a festa" },
    ])).toEqual([
      { texto: "Os ", erro: null },
      { texto: "bombeiros chegou", erro: 1 },
      { texto: " cedo ", erro: null },
      { texto: "a festa", erro: 2 },
      { texto: ".", erro: null },
    ]);
  });

  it("não sobrepõe marcas: o mesmo trecho repetido marca a próxima ocorrência", () => {
    expect(segmentosDaLinha("tem e tem", [{ numero: 1, trecho: "tem" }, { numero: 2, trecho: "tem" }]).map((s) => s.erro)).toEqual([
      1, null, 2,
    ]);
  });

  it("linha sem erros (ou com trecho não encontrado) fica inteira", () => {
    expect(segmentosDaLinha("Texto.", [{ numero: 1, trecho: "xyz" }])).toEqual([{ texto: "Texto.", erro: null }]);
    expect(segmentosDaLinha("", [])).toEqual([{ texto: "", erro: null }]);
  });
});

describe("mensagemDoBanco", () => {
  it("explica os limites e cai numa mensagem genérica", () => {
    expect(mensagemDoBanco("limite_simultaneas")).toMatch(/2 redações em correção/);
    expect(mensagemDoBanco("limite_diario")).toMatch(/10 correções por dia/);
    expect(mensagemDoBanco("redação não pode ser entregue no estado corrigida")).toMatch(/já foi entregue/);
    expect(mensagemDoBanco("erro qualquer")).toMatch(/Verifique a conexão/);
  });
});

describe("validarFoto", () => {
  it("aceita JPEG, PNG e WebP até 15 MB", () => {
    expect(validarFoto({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validarFoto({ type: "image/heic", size: 1000 })).toMatch(/JPEG, PNG ou WebP/);
    expect(validarFoto({ type: "image/png", size: 16 * 1024 * 1024 })).toMatch(/15 MB/);
  });
});

describe("resumoDoTema", () => {
  it("usa o que vem depois de \"tema:\" e corta o ponto final", () => {
    expect(resumoDoTema("Considerando que os textos têm caráter motivador, redija um texto acerca do tema: OS DESASTRES CLIMÁTICOS.\nAborde: 1 ...")).toBe(
      "OS DESASTRES CLIMÁTICOS",
    );
  });

  it("sem \"tema:\", usa o enunciado e limita a 160 caracteres", () => {
    expect(resumoDoTema("Prevenção de incêndios")).toBe("Prevenção de incêndios");
    expect(resumoDoTema("x".repeat(200))).toHaveLength(158);
  });
});

describe("resumoDasRedacoes", () => {
  const agora = new Date("2026-10-20T12:00:00Z");
  const red = (id: string, npd: number | null, quando: string | null, status = "corrigida") => ({ id, status, npd, corrigidaEm: quando });

  it("última nota, média das 5 últimas e pontos em ordem cronológica", () => {
    const r = resumoDasRedacoes(
      [
        red("f", 20, "2026-10-19T00:00:00Z"),
        red("a", 10, "2026-10-01T00:00:00Z"),
        red("b", 12, "2026-10-02T00:00:00Z"),
        red("c", 14, "2026-10-03T00:00:00Z"),
        red("d", 16, "2026-10-04T00:00:00Z"),
        red("e", 18, "2026-10-05T00:00:00Z"),
        red("x", null, null, "na_fila"),
      ],
      [],
      agora,
    );
    expect(r.ultima).toBe(20);
    expect(r.media).toBe(16);
    expect(r.pontos.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("sem redação corrigida, sem nota", () => {
    expect(resumoDasRedacoes([red("x", null, null, "rascunho")], [], agora)).toMatchObject({ ultima: null, media: null, pontos: [] });
  });

  it("conta as categorias de erro dos últimos 30 dias, mais frequentes primeiro", () => {
    const e = (categoria: string, criadoEm: string) => ({ categoria, criadoEm });
    const r = resumoDasRedacoes(
      [],
      [e("crase", "2026-10-19T00:00:00Z"), e("concordancia", "2026-10-18T00:00:00Z"), e("crase", "2026-10-10T00:00:00Z"), e("regencia", "2026-08-01T00:00:00Z")],
      agora,
    );
    expect(r.categorias).toEqual([
      { categoria: "crase", rotulo: "crase", canonico: "portugues/crase", n: 2 },
      { categoria: "concordancia", rotulo: "concordância", canonico: "portugues/concordancia-verbal-e-nominal", n: 1 },
    ]);
  });
});

describe("escolherTemaDoSimulado", () => {
  const t = (id: string, origem: string, feito: boolean) => ({ id, origem, feito });

  it("prefere tema real não feito, depois gerado não feito, depois qualquer um", () => {
    expect(escolherTemaDoSimulado([t("g", "gerado", false), t("r", "real", false)])?.id).toBe("r");
    expect(escolherTemaDoSimulado([t("r", "real", true), t("g", "gerado", false)])?.id).toBe("g");
    expect(escolherTemaDoSimulado([t("r", "real", true)])?.id).toBe("r");
    expect(escolherTemaDoSimulado([])).toBeNull();
  });
});
```

Run: `npx vitest run src/lib/redacao.test.ts`. Esperado: FALHA (funções novas não existem).

- [ ] **Passo 2: Implementar**

Substitua `src/lib/redacao.ts` e `src/db/repositorios/redacao.ts` por:

`src/lib/redacao.ts`:

```ts
import { CANONICO_POR_CATEGORIA, ROTULO_CATEGORIA } from "@/core/discursiva/erros";
import type { CategoriaErro } from "@/core/discursiva/tipos";
import type { pilula } from "@/components/ui";

export const BUCKET_FOTOS = "redacoes-fotos";

export type StatusRedacao =
  | "rascunho"
  | "transcrevendo"
  | "aguardando_confirmacao"
  | "na_fila"
  | "corrigindo"
  | "corrigida"
  | "falhou";

export function rotuloStatus(status: string): { texto: string; tom: keyof typeof pilula } {
  switch (status) {
    case "rascunho":
      return { texto: "Rascunho", tom: "neutra" };
    case "transcrevendo":
      return { texto: "Lendo a foto", tom: "alerta" };
    case "aguardando_confirmacao":
      return { texto: "Conferir transcrição", tom: "alerta" };
    case "na_fila":
    case "corrigindo":
      return { texto: "Em correção", tom: "alerta" };
    case "corrigida":
      return { texto: "Corrigida", tom: "azul" };
    default:
      return { texto: "Falhou", tom: "erro" };
  }
}

export interface Passo {
  nome: string;
  feito: boolean;
}

// Passos mostrados enquanto a redação está na fila, a partir dos papéis já gravados em correcoes_discursiva.
export function passosDoAndamento(status: string, papeis: string[]): Passo[] {
  const feito = (p: string) => papeis.includes(p);
  if (status === "transcrevendo") return [{ nome: "Lendo a foto da folha", feito: feito("transcricao") }];
  const passos = [
    { nome: "Banca 1 avaliando o conteúdo", feito: feito("conteudo_1") },
    { nome: "Banca 2 avaliando o conteúdo", feito: feito("conteudo_2") },
    { nome: "Revisão de língua portuguesa", feito: feito("lingua") },
  ];
  // A terceira correção só aparece quando as duas primeiras já terminaram e divergiram (ou já foi feita).
  if (feito("conteudo_3") || (passos.every((p) => p.feito) && status !== "corrigida")) {
    passos.push({ nome: "Terceira correção (as bancas divergiram)", feito: feito("conteudo_3") });
  }
  return passos;
}

export interface Segmento {
  texto: string;
  // Número do erro (1, 2, ...) quando o trecho está marcado.
  erro: number | null;
}

/**
 * Divide a linha em trechos normais e marcados, para sublinhar os erros apontados nela.
 * A busca ignora caixa; erros sobrepostos ou não encontrados ficam só na lista abaixo do texto.
 */
export function segmentosDaLinha(linha: string, erros: { numero: number; trecho: string }[]): Segmento[] {
  const minuscula = linha.toLocaleLowerCase("pt-BR");
  const marcas: { inicio: number; fim: number; numero: number }[] = [];
  for (const e of erros) {
    const alvo = e.trecho.trim().toLocaleLowerCase("pt-BR");
    if (!alvo) continue;
    let inicio = minuscula.indexOf(alvo);
    while (inicio >= 0 && marcas.some((m) => inicio < m.fim && inicio + alvo.length > m.inicio)) {
      inicio = minuscula.indexOf(alvo, inicio + 1);
    }
    if (inicio >= 0) marcas.push({ inicio, fim: inicio + alvo.length, numero: e.numero });
  }
  marcas.sort((a, b) => a.inicio - b.inicio);
  const segmentos: Segmento[] = [];
  let pos = 0;
  for (const m of marcas) {
    if (m.inicio > pos) segmentos.push({ texto: linha.slice(pos, m.inicio), erro: null });
    segmentos.push({ texto: linha.slice(m.inicio, m.fim), erro: m.numero });
    pos = m.fim;
  }
  if (pos < linha.length || segmentos.length === 0) segmentos.push({ texto: linha.slice(pos), erro: null });
  return segmentos;
}

// Traduz os erros levantados pelas funções do banco (discursiva_entregar / enviar_fotos / pedir_tema).
export function mensagemDoBanco(mensagem: string): string {
  if (mensagem.includes("limite_simultaneas")) return "Você já tem 2 redações em correção. Espere uma terminar para entregar outra.";
  if (mensagem.includes("limite_diario")) return "Você atingiu o limite de 10 correções por dia. Tente de novo amanhã.";
  if (mensagem.includes("não pode ser entregue") || mensagem.includes("não pode receber fotos")) {
    return "Esta redação já foi entregue. Atualize a página.";
  }
  if (mensagem.includes("fotos")) return "Envie 1 ou 2 fotos da folha.";
  return "Não foi possível concluir agora. Verifique a conexão e tente de novo.";
}

const ERRO_FORMATO = "Use uma foto em JPEG, PNG ou WebP.";
const MIDIAS = ["image/jpeg", "image/png", "image/webp"];

export function validarFoto(arquivo: { type: string; size: number }): string | null {
  if (!MIDIAS.includes(arquivo.type)) return ERRO_FORMATO;
  if (arquivo.size > 15 * 1024 * 1024) return "A foto passa de 15 MB. Tire outra com resolução menor.";
  return null;
}

// Os enunciados da banca começam quase todos igual ("Considerando que os textos..."); o título útil vem depois de "tema:".
export function resumoDoTema(enunciado: string): string {
  const m = /\btema:\s*([^\n]+)/i.exec(enunciado);
  const titulo = (m ? m[1] : enunciado).trim().replace(/[.:]\s*$/, "");
  return titulo.length > 160 ? `${titulo.slice(0, 157)}…` : titulo;
}

export interface ResumoRedacoes {
  ultima: number | null;
  // Média das últimas 5 corrigidas.
  media: number | null;
  pontos: { id: string; quando: string; npd: number }[];
  categorias: { categoria: string; rotulo: string; canonico: string | null; n: number }[];
}

const DIAS_ERROS = 30;

// Seção "Redação" do painel: notas das corrigidas (até 8 no gráfico) e as categorias de erro mais frequentes em 30 dias.
export function resumoDasRedacoes(
  redacoes: { id: string; status: string; npd: number | null; corrigidaEm: string | null }[],
  erros: { categoria: string; criadoEm: string }[],
  agora: Date,
): ResumoRedacoes {
  const corrigidas = redacoes
    .filter((r) => r.status === "corrigida" && r.npd !== null && r.corrigidaEm)
    .map((r) => ({ id: r.id, quando: r.corrigidaEm!, npd: r.npd! }))
    .sort((a, b) => a.quando.localeCompare(b.quando));
  const ultimas5 = corrigidas.slice(-5);
  const desde = agora.getTime() - DIAS_ERROS * 86_400_000;
  const contagem = new Map<string, number>();
  for (const e of erros) if (new Date(e.criadoEm).getTime() >= desde) contagem.set(e.categoria, (contagem.get(e.categoria) ?? 0) + 1);
  const categorias = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([categoria, n]) => ({
      categoria,
      rotulo: ROTULO_CATEGORIA[categoria as CategoriaErro] ?? categoria,
      canonico: CANONICO_POR_CATEGORIA[categoria as CategoriaErro] ?? null,
      n,
    }));
  return {
    ultima: corrigidas.at(-1)?.npd ?? null,
    media: ultimas5.length ? ultimas5.reduce((s, r) => s + r.npd, 0) / ultimas5.length : null,
    pontos: corrigidas.slice(-8),
    categorias,
  };
}

// Tema da discursiva no simulado: real ainda não feito, depois gerado não feito, depois qualquer um.
export function escolherTemaDoSimulado<T extends { id: string; origem: string; feito: boolean }>(temas: T[]): T | null {
  return (
    temas.find((t) => t.origem === "real" && !t.feito) ??
    temas.find((t) => !t.feito) ??
    temas[0] ??
    null
  );
}
```

`src/db/repositorios/redacao.ts`:

```ts
import { z } from "zod";
import type { ConfigDiscursiva } from "@/core";
import { BUCKET_FOTOS } from "@/lib/redacao";
import type { Database, Json } from "../types";
import type { Cliente } from "./estudo";

// Leitura e escrita das redações pelo próprio usuário (cliente com RLS). O worker usa repositorios/discursiva.ts.

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

// Erro de uma função do banco (limites, estado inválido): a mensagem vai para mensagemDoBanco.
export class ErroRedacao extends Error {}


const aspectoSchema = z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() });
const temaSchema = z.object({
  textos_apoio: z.array(z.object({ titulo: z.string().default(""), texto: z.string(), fonte: z.string().default("") })),
  padrao_resposta: z.object({ aspectos: z.array(aspectoSchema), expectativas: z.string().default("") }),
});
const configSchema = z.object({
  pontuacao_maxima: z.number(),
  linhas_max: z.number(),
  nota_minima: z.number(),
  caracteres_por_linha: z.number().default(70),
});
const detalhesSchema = z
  .object({
    aspectos: z.array(aspectoSchema.extend({ nota: z.number() })),
    usadas: z.array(z.string()),
    erros_descartados: z.number(),
  })
  .nullable();
const prioridadeSchema = z.object({
  tipo: z.enum(["aspecto", "erro"]),
  titulo: z.string(),
  detalhe: z.string(),
  canonico: z.string().optional(),
});

export interface TemaResumo {
  id: string;
  enunciado: string;
  origem: "gerado" | "real";
  provaOrigem: string | null;
  feito: boolean;
}

export interface RedacaoResumo {
  id: string;
  tema: string;
  status: string;
  npd: number | null;
  criadaEm: string;
  corrigidaEm: string | null;
}

export interface RedacaoCompleta {
  id: string;
  status: string;
  aviso: string | null;
  entrada: string;
  texto: string;
  linhas: string[];
  excedente: string[];
  fotos: string[];
  nc: number | null;
  ne: number | null;
  tl: number | null;
  npd: number | null;
  zeradaMotivo: string | null;
  terceiraCorrecao: boolean;
  prioridades: z.infer<typeof prioridadeSchema>[];
  detalhes: z.infer<typeof detalhesSchema>;
  tema: {
    enunciado: string;
    origem: string;
    provaOrigem: string | null;
    textosApoio: { titulo: string; texto: string; fonte: string }[];
    padrao: { aspectos: z.infer<typeof aspectoSchema>[]; expectativas: string };
  };
  config: ConfigDiscursiva;
  correcoes: { papel: string; provedor: string; modelo: string; resposta: Json }[];
  erros: Database["public"]["Tables"]["erros_redacao"]["Row"][];
}

// Temas aprovados do concurso: reais primeiro, depois os mais recentes. `feito` marca os que o usuário já usou.
export async function listarTemas(db: Cliente, concursoSlug: string, limite = 30): Promise<TemaResumo[]> {
  const { data, error } = await db
    .from("temas_discursiva")
    .select("id, enunciado, origem, prova_origem, criado_em, concursos!inner(slug), redacoes(id)")
    .eq("concursos.slug", concursoSlug)
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) falhou("listar temas", error);
  return data
    .map((t) => ({
      id: t.id,
      enunciado: t.enunciado,
      origem: t.origem === "real" ? ("real" as const) : ("gerado" as const),
      provaOrigem: t.prova_origem,
      feito: t.redacoes.length > 0,
    }))
    .sort((a, b) => Number(b.origem === "real") - Number(a.origem === "real"));
}

export async function listarRedacoes(db: Cliente, limite = 50): Promise<RedacaoResumo[]> {
  const { data, error } = await db
    .from("redacoes")
    .select("id, status, npd, criado_em, corrigida_em, temas_discursiva!inner(enunciado)")
    .order("criado_em", { ascending: false })
    .limit(limite);
  if (error) falhou("listar redações", error);
  return data.map((r) => ({
    id: r.id,
    tema: r.temas_discursiva.enunciado,
    status: r.status,
    npd: r.npd,
    criadaEm: r.criado_em,
    corrigidaEm: r.corrigida_em,
  }));
}

export async function criarRedacao(db: Cliente, usuarioId: string, temaId: string, simuladoId?: string): Promise<string> {
  const { data, error } = await db
    .from("redacoes")
    .insert({ usuario_id: usuarioId, tema_id: temaId, simulado_id: simuladoId ?? null })
    .select("id")
    .single();
  if (error) falhou("criar redação", error);
  return data.id;
}

export async function carregarRedacao(db: Cliente, id: string): Promise<RedacaoCompleta | null> {
  const { data, error } = await db
    .from("redacoes")
    .select(
      `id, status, aviso, entrada, texto, linhas, excedente, fotos, nc, ne, tl, npd, zerada_motivo, terceira_correcao,
       prioridades, detalhes,
       temas_discursiva!inner(enunciado, origem, prova_origem, textos_apoio, padrao_resposta, provas!inner(config_discursiva)),
       correcoes_discursiva(papel, provedor, modelo, resposta),
       erros_redacao(id, redacao_id, usuario_id, linha, trecho, tipo, categoria, correcao, explicacao, canonico, criado_em)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) falhou("carregar redação", error);
  if (!data) return null;
  const tema = temaSchema.parse(data.temas_discursiva);
  const config = configSchema.parse(data.temas_discursiva.provas.config_discursiva);
  return {
    id: data.id,
    status: data.status,
    aviso: data.aviso,
    entrada: data.entrada,
    texto: data.texto,
    linhas: data.linhas,
    excedente: data.excedente,
    fotos: data.fotos,
    nc: data.nc,
    ne: data.ne,
    tl: data.tl,
    npd: data.npd,
    zeradaMotivo: data.zerada_motivo,
    terceiraCorrecao: data.terceira_correcao,
    prioridades: z.array(prioridadeSchema).catch([]).parse(data.prioridades ?? []),
    detalhes: detalhesSchema.catch(null).parse(data.detalhes),
    tema: {
      enunciado: data.temas_discursiva.enunciado,
      origem: data.temas_discursiva.origem,
      provaOrigem: data.temas_discursiva.prova_origem,
      textosApoio: tema.textos_apoio,
      padrao: tema.padrao_resposta,
    },
    config: {
      pontuacaoMaxima: config.pontuacao_maxima,
      linhasMax: config.linhas_max,
      notaMinima: config.nota_minima,
      caracteresPorLinha: config.caracteres_por_linha,
    },
    correcoes: data.correcoes_discursiva,
    erros: [...data.erros_redacao].sort((a, b) => a.linha - b.linha),
  };
}

// Só grava enquanto a redação é rascunho (a RLS recusa depois); devolve false se nada foi alterado.
export async function salvarTexto(
  db: Cliente,
  id: string,
  dados: { texto?: string; linhas: string[]; excedente: string[] },
): Promise<boolean> {
  const { data, error } = await db.from("redacoes").update(dados).eq("id", id).select("id");
  if (error) falhou("salvar redação", error);
  return data.length > 0;
}

async function rpc(db: Cliente, chamada: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await chamada;
  if (error) throw new ErroRedacao(error.message);
}

export function entregarRedacao(db: Cliente, id: string) {
  return rpc(db, db.rpc("discursiva_entregar", { p_redacao: id }));
}

export function enviarFotos(db: Cliente, id: string, caminhos: string[]) {
  return rpc(db, db.rpc("discursiva_enviar_fotos", { p_redacao: id, p_fotos: caminhos }));
}

// true se enfileirou; false se o usuário já tinha um pedido de tema aberto.
export async function pedirTema(db: Cliente, concursoSlug: string): Promise<boolean> {
  const { data, error } = await db.rpc("discursiva_pedir_tema", { p_concurso: concursoSlug });
  if (error) throw new ErroRedacao(error.message);
  return data;
}

// URLs temporárias (30 min) para mostrar as fotos da folha ao lado da transcrição.
export async function urlsDasFotos(db: Cliente, caminhos: string[]): Promise<string[]> {
  if (caminhos.length === 0) return [];
  const { data, error } = await db.storage.from(BUCKET_FOTOS).createSignedUrls(caminhos, 60 * 30);
  if (error) falhou("assinar fotos", error);
  return data.map((d) => d.signedUrl ?? "").filter(Boolean);
}

// Configuração da prova discursiva do concurso (nota máxima e mínimo), para a lista de redações.
export async function configDaDiscursiva(db: Cliente, concursoSlug: string): Promise<ConfigDiscursiva | null> {
  const { data, error } = await db
    .from("provas")
    .select("config_discursiva, concursos!inner(slug)")
    .eq("tipo", "discursiva")
    .eq("concursos.slug", concursoSlug)
    .limit(1)
    .maybeSingle();
  if (error) falhou("configuração da discursiva", error);
  if (!data) return null;
  const c = configSchema.parse(data.config_discursiva);
  return { pontuacaoMaxima: c.pontuacao_maxima, linhasMax: c.linhas_max, notaMinima: c.nota_minima, caracteresPorLinha: c.caracteres_por_linha };
}

// Erros de língua do usuário desde a data dada (para a seção "Redação" do painel).
export async function errosDesde(db: Cliente, desde: Date): Promise<{ categoria: string; criadoEm: string }[]> {
  const { data, error } = await db.from("erros_redacao").select("categoria, criado_em").gte("criado_em", desde.toISOString());
  if (error) falhou("erros das redações", error);
  return data.map((e) => ({ categoria: e.categoria, criadoEm: e.criado_em }));
}

// Redação ligada a um simulado completo com discursiva (no máximo uma por simulado).
export async function redacaoDoSimulado(db: Cliente, simuladoId: string): Promise<RedacaoCompleta | null> {
  const { data, error } = await db.from("redacoes").select("id").eq("simulado_id", simuladoId).limit(1).maybeSingle();
  if (error) falhou("redação do simulado", error);
  return data ? carregarRedacao(db, data.id) : null;
}
```

- [ ] **Passo 3: Verificar**

Run: `npx vitest run src/lib && npm run typecheck`
Esperado: PASSA (4 testes novos).

- [ ] **Passo 4: Commit**

```bash
git add src/lib/redacao.ts src/lib/redacao.test.ts src/db/repositorios/redacao.ts
git commit -m "feat(redacao): resumo para o painel, tema do simulado e redação ligada ao simulado"
```

---

### Tarefa 4: seção "Redação" no painel

**Arquivos:**
- Modificar: `src/app/(app)/painel/page.tsx`

**Interfaces:**
- Consome: `listarRedacoes`, `errosDesde`, `configDaDiscursiva`, `resumoDasRedacoes`, `Evolucao` e `treinarTopicos`.
- A seção mostra a última nota, a média das últimas 5, o gráfico (com 2 ou mais corrigidas) e as 5 categorias de erro mais frequentes em 30 dias, cada uma com "Treinar".

- [ ] **Passo 1: Implementar**

Substitua `src/app/(app)/painel/page.tsx` por:

`src/app/(app)/painel/page.tsx`:

```tsx
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { calcularPrioridades } from "@/core";
import { contarFilaItens, criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { custoIaDoMes, situacaoDaFila } from "@/db/repositorios/moderacao";
import { configDaDiscursiva, errosDesde, listarRedacoes } from "@/db/repositorios/redacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { diasAte, tabelaDesempenho } from "@/estudo/painel";
import { Evolucao } from "@/components/painel/evolucao";
import { Tendencia } from "@/components/painel/tendencia";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, data, dataDaProva, dataEHora, nota, percentual, plural } from "@/lib/formato";
import { resumoDasRedacoes } from "@/lib/redacao";
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
  const [estrutura, historico, simulados, redacoes, errosRedacao, configRedacao] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 10 }),
    listarRedacoes(db),
    errosDesde(db, new Date(agora.getTime() - 30 * 86_400_000)),
    configDaDiscursiva(db, cargo.concursoSlug),
  ]);
  const redacao = resumoDasRedacoes(redacoes, errosRedacao, agora);
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

      {configRedacao && (
        <section className={`${cartao} mt-4`}>
          <h2 className={titulo.secao}>Redação</h2>
          {redacao.ultima === null ? (
            <p className={`${textoApoio} mt-3`}>
              Escreva uma <Link href="/redacao" className="text-azul hover:underline">redação</Link> para acompanhar a nota da
              discursiva e os erros de língua mais frequentes.
            </p>
          ) : (
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="flex flex-col gap-6">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-pedra">Última nota</dt>
                    <dd className="text-[28px] font-semibold tabular-nums tracking-tight">
                      {nota(redacao.ultima)}
                      <span className="text-base font-normal text-pedra"> / {configRedacao.pontuacaoMaxima}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-pedra">Média das últimas 5</dt>
                    <dd className="text-[28px] font-semibold tabular-nums tracking-tight">{nota(Math.round((redacao.media ?? 0) * 100) / 100)}</dd>
                  </div>
                </dl>
                {redacao.pontos.length >= 2 && (
                  <Evolucao
                    nome="Nota na discursiva"
                    maximo={configRedacao.pontuacaoMaxima}
                    corte={configRedacao.notaMinima}
                    pontos={redacao.pontos.map((p) => ({ id: p.id, rotulo: data(p.quando), nota: p.npd }))}
                  />
                )}
              </div>
              <div>
                <h3 className="text-sm font-medium">Erros mais frequentes (30 dias)</h3>
                {redacao.categorias.length === 0 ? (
                  <p className="mt-2 text-sm text-pedra">Nenhum erro de língua nos últimos 30 dias.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-borda">
                    {redacao.categorias.map((c) => (
                      <li key={c.categoria} className="flex items-center justify-between gap-4 py-2">
                        <span className="first-letter:uppercase">{c.rotulo}</span>
                        <span className="flex items-center gap-3">
                          <span className="text-sm text-pedra tabular-nums">{plural(c.n, "erro", "erros")}</span>
                          {c.canonico && (
                            <form action={treinarTopicos}>
                              <input type="hidden" name="canonico" value={c.canonico} />
                              <input type="hidden" name="total" value="10" />
                              <button type="submit" className={botao.texto}>
                                Treinar
                              </button>
                            </form>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <div className={cartao}>
          <h2 className={titulo.secao}>10 tópicos prioritários</h2>
          <ol className="mt-4 flex flex-col">
            {prioridades.slice(0, 10).map((t, i) => (
              <li key={t.chave} className="flex items-center gap-3 py-2">
                <span className="w-5 shrink-0 text-sm tabular-nums text-pedra">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2" title={t.titulo}>{t.titulo}</span>
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
                  <li key={f.id} className="rounded-lg bg-vermelho-claro px-3 py-2 text-vermelho-tinta">
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

- [ ] **Passo 2: Verificar e commit**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add "src/app/(app)/painel/page.tsx"
git commit -m "feat(painel): seção de redação com nota, evolução e erros frequentes"
```

---

### Tarefa 5: simulado completo com a prova discursiva

**Arquivos:**
- Modificar: `src/estudo/tipos.ts`, `src/estudo/servico.ts`, `src/estudo/servico.test.ts`
- Modificar: `src/app/(app)/acoes.ts`, `src/app/(app)/simulado/page.tsx`, `src/app/(app)/simulado/[id]/page.tsx`, `src/app/(app)/simulado/[id]/acoes.ts`, `src/app/(app)/simulado/[id]/resultado/page.tsx`
- Modificar: `src/components/simulado/player-simulado.tsx`, `src/components/redacao/folha-escrita.tsx`, `src/components/aviso.tsx`

**Interfaces:**
- **Serviço:**
  - `ConfigSessao` completo ganha `discursiva?: boolean`;
  - `previaSimulado(repo, cargoId, comDiscursiva = false)` e `iniciarSimulado(repo, cargoId, comDiscursiva = false)`: com a discursiva, vale a duração inteira do cargo; sem ela, desconta `DURACAO_DISCURSIVA_MIN`.
- **Ações:**
  - `comecarSimulado(formData)`: com `discursiva=sim`, escolhe o tema, cria o simulado e a redação ligada a ele. Sem tema, volta com o aviso `sem-tema`.
  - `entregar(sessaoId, textoRedacao = null)`: depois das objetivas, grava o texto final da redação e a entrega, se houver texto. Uma falha na redação não impede a entrega do simulado.
- **Componentes:**
  - `FolhaEscrita` ganha `noSimulado` (sem entrega nem cronômetro próprios; texto e folha empilhados) e `aoMudar`;
  - `PlayerSimulado` ganha `redacao?: RedacaoNoSimulado | null` e a aba "Redação".

- [ ] **Passo 1: Teste do serviço**

Substitua `src/estudo/servico.test.ts` por:

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
    expect(c).toMatchObject({ gabarito: "C", resultado: "errado", justificativa: "porque a", provaOrigem: null, concluida: false });
    expect(estado.revisao.get("a")).toEqual({ etapa: 1, proximaEm: new Date(AGORA.getTime() + DIA) });

    const outra = await responderItem(repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: 1, agora: AGORA });
    expect(outra).toMatchObject({ resposta: "E", resultado: "errado" });
    expect(estado.revisao.get("a")!.etapa).toBe(1);
  });

  it("diz de que prova veio uma questão real", async () => {
    const f = criarRepositorioFalso({ estrutura, gabaritos: { a: "C", b: "E" }, provasOrigem: { b: "CEBRASPE 2021 · PC-AL" } });
    const id = await f.repo.criarSessao("cargo", "treino", { tipo: "estudar_agora" }, ["a", "b"]);
    const real = await responderItem(f.repo, { sessaoId: id, itemId: "b", resposta: "E", duvida: false, tempoMs: null, agora: AGORA });
    expect(real.provaOrigem).toBe("CEBRASPE 2021 · PC-AL");
    const ia = await responderItem(f.repo, { sessaoId: id, itemId: "a", resposta: "C", duvida: false, tempoMs: null, agora: AGORA });
    expect(ia.provaOrigem).toBeNull();
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

  it("com a discursiva, usa a duração inteira do cargo e marca a sessão", async () => {
    const { repo, estado } = criarRepositorioFalso({ estrutura, candidatos });
    const r = await iniciarSimulado(repo, "cargo", true);
    const s = estado.sessoes.get((r as { sessaoId: string }).sessaoId)!;
    expect(s.config).toMatchObject({ tipo: "completo", duracaoMin: 270, discursiva: true });
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

Run: `npx vitest run src/estudo/servico.test.ts`. Esperado: FALHA (`discursiva: true` ausente; duração 210 em vez de 270).

- [ ] **Passo 2: Implementar o serviço**

Substitua `src/estudo/tipos.ts` e `src/estudo/servico.ts` por:

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
      // true quando a prova discursiva faz parte do simulado (redação ligada pela coluna redacoes.simulado_id).
      discursiva?: boolean;
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
  // Prova de onde a questão real foi tirada; null nos itens gerados por IA.
  provaOrigem: string | null;
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

// Tempo da prova discursiva dentro da duração do cargo: no simulado "só objetivas" ele é descontado
// (4h30 menos 1h no CBM-AL); com a discursiva, vale a duração inteira.
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
export async function previaSimulado(repo: RepositorioEstudo, cargoId: string, comDiscursiva = false): Promise<PreviaSimulado> {
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
  const discursiva = comDiscursiva && estrutura.temDiscursiva;
  const duracaoMin = estrutura.cargo.duracaoMin - (estrutura.temDiscursiva && !discursiva ? DURACAO_DISCURSIVA_MIN : 0);
  return {
    config: { tipo: "completo", duracaoMin, provas, disciplinaDoItem, ...(discursiva ? { discursiva: true } : {}) },
    faltantes,
  };
}

export async function iniciarSimulado(repo: RepositorioEstudo, cargoId: string, comDiscursiva = false): Promise<InicioSimulado> {
  const { config, faltantes } = await previaSimulado(repo, cargoId, comDiscursiva);
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
  provaOrigem: string | null;
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
    provaOrigem: item.provaOrigem,
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

Run: `npx vitest run src/estudo`. Esperado: PASSA (1 teste novo).

- [ ] **Passo 3: Ações e telas**

Substitua os arquivos abaixo:

`src/app/(app)/acoes.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { criarRedacao, listarTemas } from "@/db/repositorios/redacao";
import {
  iniciarEstudarAgora,
  iniciarRevisao,
  iniciarSimulado,
  iniciarTreinoTopico,
  pedirGeracaoDosFaltantes,
  type InicioSessao,
} from "@/estudo/servico";
import { escolherTemaDoSimulado } from "@/lib/redacao";
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

// Com a discursiva, o simulado leva uma redação (tema real ainda não feito, se houver) e dura o tempo inteiro do cargo.
export async function comecarSimulado(formData: FormData) {
  const { db, cargo, user } = await exigirCargo();
  const comDiscursiva = formData.get("discursiva") === "sim";
  const tema = comDiscursiva ? escolherTemaDoSimulado(await listarTemas(db, cargo.concursoSlug)) : null;
  if (comDiscursiva && !tema) redirect("/simulado?aviso=sem-tema");
  const r = await iniciarSimulado(criarRepositorioEstudo(db), cargo.id, comDiscursiva);
  if (r.tipo === "faltam_itens") redirect("/simulado?aviso=faltam");
  if (tema) await criarRedacao(db, user.id, tema.id, r.sessaoId);
  redirect(`/simulado/${r.sessaoId}`);
}

export async function gerarFaltantes(formData: FormData) {
  const { db, cargo } = await exigirCargo();
  const canonicos = formData.getAll("canonico").map(String).filter(Boolean);
  const novos = await pedirGeracaoDosFaltantes(criarRepositorioEstudo(db), cargo.id, canonicos);
  redirect(`/simulado?aviso=geracao&pedidos=${novos}`);
}
```

`src/app/(app)/simulado/page.tsx`:

```tsx
import Link from "next/link";
import { criarRepositorioEstudo, listarSessoes } from "@/db/repositorios/estudo";
import { listarTemas } from "@/db/repositorios/redacao";
import { DURACAO_DISCURSIVA_MIN, previaSimulado } from "@/estudo/servico";
import { Aviso } from "@/components/aviso";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota, plural } from "@/lib/formato";
import { comecarSimulado, gerarFaltantes } from "../acoes";
import { exigirCargo } from "../contexto";

export default async function Simulado({ searchParams }: { searchParams: Promise<{ aviso?: string; pedidos?: string }> }) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const [estrutura, previa, abertos, entregues, temas] = await Promise.all([
    repo.estrutura(cargo.id),
    previaSimulado(repo, cargo.id),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { modo: "completo", abertas: false, limite: 20 }),
    listarTemas(db, cargo.concursoSlug),
  ]);
  const total = estrutura.provas.reduce((s, p) => s + p.nItens, 0);
  const aberto = abertos[0];
  const horas = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  const comRedacao = previa.config.duracaoMin + DURACAO_DISCURSIVA_MIN;

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <section className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <div className={`${cartao} flex flex-col gap-6 p-8`}>
          <div>
            <h1 className={titulo.pagina}>Simulado completo</h1>
            <p className={`${textoApoio} mt-3 max-w-[56ch]`}>
              {total} itens de {estrutura.provas.map((p) => p.nome).join(" e ")}, na distribuição do edital, em{" "}
              {horas(previa.config.duracaoMin)}
              {estrutura.temDiscursiva && `, ou ${horas(comRedacao)} com a redação`}. A correção sai só no final, com as regras e
              os cortes da banca.
            </p>
          </div>
          {aberto ? (
            <Link href={`/simulado/${aberto.id}`} className={`${botao.primario} self-start`}>
              Continuar simulado ({aberto.respondidos} de {aberto.total})
            </Link>
          ) : previa.faltantes.length === 0 ? (
            <form action={comecarSimulado} className="flex flex-col gap-4">
              {estrutura.temDiscursiva && (
                <label className="flex items-start gap-3 text-[15px]">
                  <input
                    type="checkbox"
                    name="discursiva"
                    value="sim"
                    defaultChecked={temas.length > 0}
                    disabled={temas.length === 0}
                    className="mt-1 size-4 accent-azul"
                  />
                  <span>
                    Incluir a prova discursiva ({horas(comRedacao)} no total)
                    {temas.length === 0 && (
                      <span className="block text-sm text-pedra">
                        Ainda não há tema de redação. Gere um em <Link href="/redacao" className="text-azul hover:underline">Redação</Link>.
                      </span>
                    )}
                  </span>
                </label>
              )}
              <button type="submit" className={`${botao.primario} self-start`}>
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
import { redacaoDoSimulado } from "@/db/repositorios/redacao";
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

  const [estrutura, itens, redacao] = await Promise.all([
    repo.estrutura(sessao.cargoId),
    itensDaSessao(db, id, () => false),
    redacaoDoSimulado(db, id),
  ]);
  const provas = sessao.config.provas.reduce<ProvaNoSimulado[]>((acc, p) => {
    const inicio = acc.at(-1)?.fim ?? 0;
    const nome = estrutura.provas.find((x) => x.slug === p.slug)?.nome ?? p.slug;
    return [...acc, { slug: p.slug, nome, inicio, fim: inicio + p.itens.length }];
  }, []);

  return (
    <PlayerSimulado
      sessaoId={id}
      itens={itens}
      provas={provas}
      prazo={prazoDoSimulado(sessao)!.toISOString()}
      redacao={
        redacao?.status === "rascunho"
          ? {
              id: redacao.id,
              texto: redacao.texto,
              config: redacao.config,
              enunciado: redacao.tema.enunciado,
              textosApoio: redacao.tema.textosApoio,
            }
          : null
      }
    />
  );
}
```

`src/app/(app)/simulado/[id]/acoes.ts`:

```ts
"use server";

import { contarTL, distribuirEmLinhas } from "@/core";
import { criarRepositorioEstudo, type Cliente } from "@/db/repositorios/estudo";
import { entregarRedacao, ErroRedacao, redacaoDoSimulado, salvarTexto } from "@/db/repositorios/redacao";
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

// Grava o texto final da redação do simulado e a entrega para correção (se houver texto).
// Falhas aqui não impedem a entrega das objetivas: a redação continua como rascunho, e o resultado avisa.
async function entregarRedacaoDoSimulado(db: Cliente, sessaoId: string, texto: string | null) {
  try {
    const r = await redacaoDoSimulado(db, sessaoId);
    if (!r || r.status !== "rascunho") return;
    const final = (texto ?? r.texto).slice(0, 20_000);
    const folha = distribuirEmLinhas(final, r.config.caracteresPorLinha, r.config.linhasMax);
    await salvarTexto(db, r.id, { texto: final, ...folha });
    if (contarTL(folha.linhas) > 0) await entregarRedacao(db, r.id);
  } catch (e) {
    if (!(e instanceof ErroRedacao)) console.error(e);
  }
}

export async function entregar(sessaoId: string, textoRedacao: string | null = null): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await entregarSimulado(criarRepositorioEstudo(db), sessaoId, new Date());
  } catch (e) {
    return falha(e);
  }
  await entregarRedacaoDoSimulado(db, sessaoId, textoRedacao);
  return { ok: true, dados: null };
}
```

`src/app/(app)/simulado/[id]/resultado/page.tsx`:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao, resultadoGuardado } from "@/db/repositorios/estudo";
import { redacaoDoSimulado } from "@/db/repositorios/redacao";
import { ListaCorrecao } from "@/components/sessao/lista-correcao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora, nota } from "@/lib/formato";
import { rotuloStatus } from "@/lib/redacao";
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
  const [r, itens, redacao] = await Promise.all([
    resultadoGuardado(db, id),
    itensDaSessao(db, id, () => true),
    redacaoDoSimulado(db, id),
  ]);
  if (!r || r.tipo !== "completo") notFound();
  const statusRedacao = redacao ? rotuloStatus(redacao.status) : null;

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
            {r.corteConjunto !== null && <span className="text-pedra"> / corte {r.corteConjunto}</span>}
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

      {redacao && statusRedacao && (
        <section className={`${cartao} mt-4 flex flex-col gap-4`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className={titulo.secao}>P3 – Prova discursiva</h2>
            <span className={pilula[statusRedacao.tom]}>{statusRedacao.texto}</span>
          </div>
          {redacao.status === "corrigida" && redacao.npd !== null ? (
            <p className="text-[28px] font-semibold tabular-nums tracking-tight">
              {nota(redacao.npd)}
              <span className="text-base font-normal text-pedra">
                {" "}
                / {redacao.config.pontuacaoMaxima} · mínimo {redacao.config.notaMinima}
              </span>
            </p>
          ) : redacao.status === "rascunho" ? (
            <p className={textoApoio}>A redação não foi entregue (ficou sem texto). Você pode terminá-la e entregar agora.</p>
          ) : (
            <p className={textoApoio}>A correção leva cerca de 1 minuto. A nota aparece aqui e em Redação.</p>
          )}
          {!r.aprovado && (
            <p className="rounded-lg bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
              Na prova real, sua redação não seria corrigida: só é corrigida a discursiva de quem passa nos cortes das objetivas
              (edital, item 9.7.1). Corrigimos mesmo assim, para treino.
            </p>
          )}
          <Link href={`/redacao/${redacao.id}`} className={`${botao.secundario} self-start`}>
            {redacao.status === "rascunho" ? "Continuar a redação" : "Ver a redação"}
          </Link>
        </section>
      )}

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

`src/components/simulado/player-simulado.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { entregar, marcar } from "@/app/(app)/simulado/[id]/acoes";
import { Enunciado } from "@/components/sessao/enunciado";
import { FolhaEscrita } from "@/components/redacao/folha-escrita";
import type { ConfigDiscursiva } from "@/core/discursiva/tipos";
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

export interface RedacaoNoSimulado {
  id: string;
  texto: string;
  config: ConfigDiscursiva;
  enunciado: string;
  textosApoio: { titulo: string; texto: string; fonte: string }[];
}

// Simulado completo: sem correção até a entrega; cada marcação é salva na hora e pode ser trocada.
export function PlayerSimulado({
  sessaoId,
  itens,
  provas,
  prazo,
  redacao = null,
}: {
  sessaoId: string;
  itens: ItemDaSessao[];
  provas: ProvaNoSimulado[];
  prazo: string;
  redacao?: RedacaoNoSimulado | null;
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
  const [naRedacao, setNaRedacao] = useState(false);
  const textoRedacao = useRef<string | null>(null);

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
      const r = await entregar(sessaoId, textoRedacao.current);
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
      {redacao && (
        // Fica montada (só escondida) ao voltar aos itens, para não perder o texto nem o salvamento em andamento.
        <article className={`flex min-w-0 flex-col gap-6 ${naRedacao ? "" : "hidden"}`}>
          <p className="text-sm text-pedra">P3 – Prova discursiva</p>
          <div className="text-[15px] leading-relaxed whitespace-pre-line">{redacao.enunciado}</div>
          {redacao.textosApoio.map((t, i) => (
            <blockquote key={i} className="border-l-2 border-borda-forte pl-4 text-[15px] text-grafite">
              {t.titulo && <p className="font-medium text-tinta">{t.titulo}</p>}
              <p className="whitespace-pre-line">{t.texto}</p>
            </blockquote>
          ))}
          <FolhaEscrita
            redacaoId={redacao.id}
            textoInicial={redacao.texto}
            config={redacao.config}
            noSimulado
            aoMudar={(t) => (textoRedacao.current = t)}
          />
        </article>
      )}
      <article className={`flex min-w-0 flex-col gap-8 ${naRedacao ? "hidden" : ""}`}>
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
              atual?.duvida ? "border-transparent bg-marigold-claro text-marigold-tinta" : "border-borda-forte text-tinta/70 hover:bg-realce"
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
                      onClick={() => {
                        setIndice(n);
                        setNaRedacao(false);
                      }}
                      aria-label={`Item ${n + 1}${marcado ? ", marcado" : ""}${m?.duvida ? ", com dúvida" : ""}`}
                      aria-current={n === indice ? "step" : undefined}
                      className={`flex aspect-square w-full items-center justify-center rounded text-[10px] font-medium transition-colors duration-200 ${
                        marcado ? "bg-azul-claro text-azul" : "bg-superficie text-pedra ring-1 ring-borda-forte ring-inset"
                      } ${m?.duvida ? "!bg-marigold-claro !text-marigold-tinta" : ""} ${n === indice ? "outline-2 outline-offset-1 outline-azul" : ""}`}
                    >
                      {n + 1}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        {redacao && (
          <div>
            <p className="mb-2 text-sm font-medium">P3 – Prova discursiva</p>
            <button
              type="button"
              onClick={() => setNaRedacao(true)}
              aria-current={naRedacao ? "step" : undefined}
              className={`${botao.contorno} w-full ${naRedacao ? "!border-azul !bg-azul-claro !text-azul" : ""}`}
            >
              Redação
            </button>
          </div>
        )}
        {confirmando ? (
          <div className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-4">
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

`src/components/redacao/folha-escrita.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { entregar, salvarRascunho } from "@/app/(app)/redacao/acoes";
import { contarTL, distribuirEmLinhas } from "@/core/discursiva/linhas";
import type { ConfigDiscursiva } from "@/core/discursiva/tipos";
import { botao } from "@/components/ui";
import { duracao } from "@/lib/formato";

type Salvamento = "salvo" | "pendente" | "salvando" | "erro";
const ESPERA_SALVAR_MS = 1500;
const TEMPO_SUGERIDO_MS = 60 * 60_000;

// Conta o tempo desde a primeira tecla, sem guardar no servidor (é só uma referência para treinar).
function TempoEscrevendo({ inicio }: { inicio: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (inicio === null) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inicio]);
  if (inicio === null) return <span className="text-pedra">o tempo começa na primeira tecla</span>;
  const passou = Math.max(0, agora - inicio);
  return (
    <span className={`tabular-nums ${passou > TEMPO_SUGERIDO_MS ? "text-vermelho" : "text-grafite"}`}>
      {duracao(passou)} {passou > TEMPO_SUGERIDO_MS ? "(passou de 1 hora)" : "de 1 hora sugerida"}
    </span>
  );
}

// Escrita da redação: o texto digitado é distribuído nas linhas da folha como na prova, e salvo sozinho.
// `noSimulado`: sem entrega nem cronômetro próprios (o simulado entrega tudo junto e tem o seu tempo);
// `aoMudar` repassa o texto atual para o simulado enviar na entrega.
export function FolhaEscrita({
  redacaoId,
  textoInicial,
  config,
  noSimulado = false,
  aoMudar,
}: {
  redacaoId: string;
  textoInicial: string;
  config: ConfigDiscursiva;
  noSimulado?: boolean;
  aoMudar?: (texto: string) => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial);
  const [salvamento, setSalvamento] = useState<Salvamento>("salvo");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [entregando, iniciarEntrega] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const folha = distribuirEmLinhas(texto, config.caracteresPorLinha, config.linhasMax);
  const tl = contarTL(folha.linhas);

  async function salvar(valor: string) {
    setSalvamento("salvando");
    const r = await salvarRascunho(redacaoId, valor);
    if (r.ok) {
      setSalvamento("salvo");
      setErro(null);
    } else {
      setSalvamento("erro");
      setErro(r.erro);
    }
  }

  function aoDigitar(valor: string) {
    setTexto(valor);
    aoMudar?.(valor);
    setSalvamento("pendente");
    if (inicio === null) setInicio(Date.now());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => salvar(valor), ESPERA_SALVAR_MS);
  }

  function confirmarEntrega() {
    if (timer.current) clearTimeout(timer.current);
    iniciarEntrega(async () => {
      const r = await entregar(redacaoId, texto);
      if (!r.ok) {
        setErro(r.erro);
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  const estado = { salvo: "Rascunho salvo", pendente: "Alterações não salvas", salvando: "Salvando…", erro: "Não salvou" }[salvamento];

  return (
    <div className="flex flex-col gap-6">
      {/* No simulado a coluna é mais estreita: texto e folha ficam um embaixo do outro. */}
      <div className={`grid gap-6 ${noSimulado ? "" : "lg:grid-cols-2"}`}>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="texto" className="text-sm font-medium">
            Seu texto
          </label>
          <textarea
            id="texto"
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder="Escreva aqui. Use Enter para começar um parágrafo novo."
            className="min-h-80 w-full resize-y rounded-lg border border-borda-campo bg-superficie px-4 py-3 text-[15px] leading-relaxed"
          />
          <p className="flex flex-wrap justify-between gap-2 text-sm" aria-live="polite">
            <span className={salvamento === "erro" ? "text-vermelho" : "text-pedra"}>{estado}</span>
            {!noSimulado && <TempoEscrevendo inicio={inicio} />}
          </p>
        </div>

        <figure className="flex min-w-0 flex-col gap-2">
          <figcaption className="flex justify-between gap-2 text-sm">
            <span className="font-medium">Folha de texto definitivo</span>
            <span className={`tabular-nums ${folha.excedente.length ? "text-vermelho" : "text-pedra"}`}>
              {tl}/{config.linhasMax} linhas
            </span>
          </figcaption>
          {/* Largura fixa para as linhas não quebrarem; no celular a folha rola na horizontal. */}
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <ol className="min-w-[30rem] text-[13px] leading-6">
              {Array.from({ length: config.linhasMax }, (_, i) => (
                <li key={i} className="flex border-b border-borda last:border-b-0">
                  <span className="w-9 shrink-0 border-r border-borda pr-2 text-right text-pedra tabular-nums select-none">{i + 1}</span>
                  <span className="px-2 whitespace-pre">{folha.linhas[i] ?? ""}</span>
                </li>
              ))}
            </ol>
          </div>
          {folha.excedente.length > 0 && (
            <p className="text-sm text-vermelho">
              {folha.excedente.length === 1 ? "1 linha passou" : `${folha.excedente.length} linhas passaram`} do limite e não
              serão corrigidas (edital, item 9.7.5): {folha.excedente.join(" ").slice(0, 120)}…
            </p>
          )}
        </figure>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-vermelho">
          {erro}
        </p>
      )}
      {noSimulado ? (
        <p className="text-sm text-pedra">A redação é entregue junto com o simulado.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {confirmando ? (
            <>
              <span className="text-sm">Depois de entregar, o texto não pode mais ser editado.</span>
              <button type="button" onClick={confirmarEntrega} disabled={entregando} className={botao.primario}>
                {entregando ? "Entregando…" : "Entregar agora"}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} disabled={entregando} className={botao.texto}>
                Continuar escrevendo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} disabled={tl === 0} className={botao.primario}>
              Entregar para correção
            </button>
          )}
        </div>
      )}
    </div>
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
    case "tema-pedido":
      return "Pedimos um tema novo. Ele aparece na lista em cerca de 1 minuto, se a revisão por outra IA aprovar; se não aparecer, peça outro.";
    case "tema-ja-pedido":
      return "Você já tem um tema novo a caminho. Espere ele ficar pronto para pedir outro.";
    case "sem-tema":
      return "Não há tema de redação para a prova discursiva. Gere um tema em Redação ou comece o simulado só com as objetivas.";
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
    <p role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-azul-claro px-4 py-3 text-[15px] text-azul-tinta">
      <Info size={20} weight="bold" className="mt-0.5 shrink-0" aria-hidden />
      {texto}
    </p>
  );
}
```

- [ ] **Passo 4: Verificar e commit**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add src/estudo "src/app/(app)/acoes.ts" "src/app/(app)/simulado" src/components/simulado/player-simulado.tsx src/components/redacao/folha-escrita.tsx src/components/aviso.tsx
git commit -m "feat(simulado): prova discursiva no simulado completo"
```

---

### Tarefa 6: importação de temas reais

**Arquivos:**
- Criar: `src/importacao/tema.ts`, `src/components/importar/tema-real.tsx`
- Teste: `src/importacao/tema.test.ts`
- Modificar: `src/app/(app)/importar/acoes.ts`, `src/app/(app)/importar/page.tsx`

**Interfaces:**
- Produz:
  - **Leitura:** `CamposTema`, `TemaReal`, `lerTextosApoio`, `lerPadrao`, `lerTemaReal(campos, pontuacaoMaxima)`.
  - **Ação:** `EstadoTema` e `importarTema(anterior, formData)`, para usar com `useActionState`.
  - **Componente:** `ImportarTemaReal({ pontuacaoMaxima })`.
- Só moderadores. A soma dos pontos do padrão precisa dar a nota máxima da prova. Um tema repetido (mesmo enunciado normalizado) não é gravado.

- [ ] **Passo 1: Teste**

`src/importacao/tema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lerPadrao, lerTemaReal, lerTextosApoio } from "./tema";

describe("lerTextosApoio", () => {
  it("separa por linha em branco e reconhece título e fonte", () => {
    expect(lerTextosApoio("Texto I\nDados do texto um.\nFonte: Agência X\n\nOutro texto\nsem título.")).toEqual([
      { titulo: "Texto I", texto: "Dados do texto um.", fonte: "Agência X" },
      { titulo: "Texto 2", texto: "Outro texto\nsem título.", fonte: "" },
    ]);
  });

  it("texto vazio não tem blocos", () => {
    expect(lerTextosApoio("  \n\n ")).toEqual([]);
  });
});

describe("lerPadrao", () => {
  it("lê código, descrição e pontos com vírgula", () => {
    expect(lerPadrao("1 | Apresentação | 3\n2.1 | Causas | 13,5")).toEqual({
      aspectos: [
        { codigo: "1", descricao: "Apresentação", pontos: 3 },
        { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
      ],
      erros: [],
    });
  });

  it("aponta a linha mal formada", () => {
    expect(lerPadrao("1 | Apresentação | 3\n2.1 Causas 13,5").erros).toEqual([
      'Linha 2 do padrão de resposta: use "código | descrição | pontos".',
    ]);
  });
});

describe("lerTemaReal", () => {
  const campos = {
    provaOrigem: " CEBRASPE 2021 · CBM-AL ",
    enunciado: " Redija um texto sobre prevenção. ",
    textosApoio: "Texto I\nDados.\nFonte: X",
    padrao: "1 | Apresentação | 3\n2.1 | Causas | 13,5\n2.2 | Propostas | 13,5",
    expectativas: " Espera-se... ",
  };

  it("monta o tema quando tudo confere", () => {
    expect(lerTemaReal(campos, 30)).toEqual({
      ok: true,
      provaOrigem: "CEBRASPE 2021 · CBM-AL",
      tema: {
        enunciado: "Redija um texto sobre prevenção.",
        textos_apoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "X" }],
        padrao_resposta: {
          aspectos: [
            { codigo: "1", descricao: "Apresentação", pontos: 3 },
            { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
            { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
          ],
          expectativas: "Espera-se...",
        },
      },
    });
  });

  it("junta os erros: origem, enunciado, soma e códigos repetidos", () => {
    const r = lerTemaReal({ ...campos, provaOrigem: "", enunciado: "", padrao: "1 | A | 3\n1 | B | 10" }, 30);
    expect(r).toEqual({
      ok: false,
      erros: [
        "Informe a prova de origem (ex.: CEBRASPE 2021 · CBM-AL · Soldado).",
        "Informe o enunciado da proposta.",
        "Há códigos de aspecto repetidos.",
        "Os pontos do padrão somam 13, mas a prova vale 30.",
      ],
    });
  });
});
```

Run: `npx vitest run src/importacao/tema.test.ts`. Esperado: FALHA (módulo não existe).

- [ ] **Passo 2: Implementar**

`src/importacao/tema.ts`:

```ts
// Tema real de prova discursiva digitado pelo moderador: enunciado, textos de apoio, padrão de resposta.

export interface CamposTema {
  provaOrigem: string;
  enunciado: string;
  textosApoio: string;
  padrao: string;
  expectativas: string;
}

export interface TemaReal {
  enunciado: string;
  textos_apoio: { titulo: string; texto: string; fonte: string }[];
  padrao_resposta: { aspectos: { codigo: string; descricao: string; pontos: number }[]; expectativas: string };
}

export type LeituraTema = { ok: true; provaOrigem: string; tema: TemaReal } | { ok: false; erros: string[] };

// Blocos separados por linha em branco. "Texto I" (ou "Texto 1") na primeira linha vira o título;
// uma última linha "Fonte: ..." vira a fonte.
export function lerTextosApoio(texto: string): TemaReal["textos_apoio"] {
  return texto
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((linhas) => linhas.length > 0)
    .map((linhas, i) => {
      const titulo = /^texto\s+[ivxlc\d]+\b/i.test(linhas[0]) && linhas.length > 1 ? linhas.shift()! : `Texto ${i + 1}`;
      const fonte = linhas.length > 1 && /^fonte:/i.test(linhas[linhas.length - 1]) ? linhas.pop()!.replace(/^fonte:\s*/i, "") : "";
      return { titulo, texto: linhas.join("\n"), fonte };
    });
}

// Uma linha por aspecto: "código | descrição | pontos" (pontos com vírgula ou ponto).
export function lerPadrao(texto: string): { aspectos: TemaReal["padrao_resposta"]["aspectos"]; erros: string[] } {
  const aspectos: TemaReal["padrao_resposta"]["aspectos"] = [];
  const erros: string[] = [];
  texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((linha, i) => {
      const partes = linha.split("|").map((p) => p.trim());
      const pontos = Number((partes[2] ?? "").replace(",", "."));
      if (partes.length !== 3 || !partes[0] || !partes[1] || !(pontos > 0)) {
        erros.push(`Linha ${i + 1} do padrão de resposta: use "código | descrição | pontos".`);
        return;
      }
      aspectos.push({ codigo: partes[0], descricao: partes[1], pontos });
    });
  return { aspectos, erros };
}

export function lerTemaReal(c: CamposTema, pontuacaoMaxima: number): LeituraTema {
  const erros: string[] = [];
  const provaOrigem = c.provaOrigem.trim();
  const enunciado = c.enunciado.trim();
  if (!provaOrigem) erros.push("Informe a prova de origem (ex.: CEBRASPE 2021 · CBM-AL · Soldado).");
  if (!enunciado) erros.push("Informe o enunciado da proposta.");
  const { aspectos, erros: errosPadrao } = lerPadrao(c.padrao);
  erros.push(...errosPadrao);
  if (errosPadrao.length === 0) {
    if (aspectos.length < 2) erros.push("O padrão de resposta precisa de pelo menos 2 aspectos.");
    if (new Set(aspectos.map((a) => a.codigo)).size !== aspectos.length) erros.push("Há códigos de aspecto repetidos.");
    const soma = aspectos.reduce((s, a) => s + a.pontos, 0);
    if (Math.abs(soma - pontuacaoMaxima) > 0.01) {
      erros.push(`Os pontos do padrão somam ${soma.toLocaleString("pt-BR")}, mas a prova vale ${pontuacaoMaxima}.`);
    }
  }
  if (erros.length) return { ok: false, erros };
  return {
    ok: true,
    provaOrigem,
    tema: {
      enunciado,
      textos_apoio: lerTextosApoio(c.textosApoio),
      padrao_resposta: { aspectos, expectativas: c.expectativas.trim() },
    },
  };
}
```

Run: `npx vitest run src/importacao/tema.test.ts`. Esperado: PASSA (6 testes).

- [ ] **Passo 3: Ação, formulário e página**

`src/app/(app)/importar/acoes.ts`:

```ts
"use server";

import { ErroIa } from "@/ai/tipos";
import { dadosDaImportacao, importarItensReais, registrarUsoSugestao, type ResultadoImportacao } from "@/db/repositorios/importacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { ErroImportacao, importacaoSchema, montarLoteReal, previaSchema } from "@/importacao/gravacao";
import { lerTemaReal, type CamposTema } from "@/importacao/tema";
import { configDaDiscursiva } from "@/db/repositorios/redacao";
import type { Json } from "@/db/types";
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

// `vez` conta os envios: o formulário usa como chave para remontar com os valores certos.
export type EstadoTema =
  | { vez: number; tipo: "gravado" | "duplicado"; enunciado: string }
  | { vez: number; tipo: "erro"; erros: string[]; campos: CamposTema }
  | null;

// Tema real de discursiva: validado aqui (inclusive a soma dos pontos) e gravado pela função do banco,
// que só a chave de serviço executa. O mesmo enunciado não entra duas vezes.
export async function importarTema(anterior: EstadoTema, formData: FormData): Promise<EstadoTema> {
  const vez = (anterior?.vez ?? 0) + 1;
  const ctx = await moderador();
  const campos: CamposTema = {
    provaOrigem: String(formData.get("provaOrigem") ?? ""),
    enunciado: String(formData.get("enunciado") ?? ""),
    textosApoio: String(formData.get("textosApoio") ?? ""),
    padrao: String(formData.get("padrao") ?? ""),
    expectativas: String(formData.get("expectativas") ?? ""),
  };
  if (!ctx) return { vez, tipo: "erro", erros: [SO_MODERADOR.erro], campos };
  try {
    const config = await configDaDiscursiva(ctx.db, ctx.cargo.concursoSlug);
    if (!config) return { vez, tipo: "erro", erros: ["Este concurso não tem prova discursiva."], campos };
    const lido = lerTemaReal(campos, config.pontuacaoMaxima);
    if (!lido.ok) return { vez, tipo: "erro", erros: lido.erros, campos };
    const { data, error } = await criarClienteServico().rpc("discursiva_importar_temas", {
      p_lote: { concurso: ctx.cargo.concursoSlug, prova_origem: lido.provaOrigem, temas: [lido.tema] } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    const r = data as { gravados: number };
    return { vez, tipo: r.gravados === 1 ? "gravado" : "duplicado", enunciado: lido.tema.enunciado };
  } catch (e) {
    console.error(e);
    return { vez, tipo: "erro", erros: ["Não foi possível gravar o tema. Tente de novo."], campos };
  }
}
```

`src/components/importar/tema-real.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { importarTema, type EstadoTema } from "@/app/(app)/importar/acoes";
import { botao } from "@/components/ui";

const campo = "w-full rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-[15px]";

// Formulário de tema real de discursiva. Em caso de erro, os campos voltam preenchidos.
export function ImportarTemaReal({ pontuacaoMaxima }: { pontuacaoMaxima: number }) {
  const [estado, enviar, enviando] = useActionState<EstadoTema, FormData>(importarTema, null);
  const valores = estado?.tipo === "erro" ? estado.campos : null;
  // A chave muda a cada resposta: o formulário remonta com os valores devolvidos (ou vazio depois de gravar).
  return (
    <form key={estado?.vez ?? 0} action={enviar} className="flex flex-col gap-5">
      {estado?.tipo === "gravado" && (
        <p role="status" className="rounded-xl bg-azul-claro px-4 py-3 text-[15px] text-azul-tinta">
          Tema gravado. Ele já aparece em Redação, entre os temas reais.
        </p>
      )}
      {estado?.tipo === "duplicado" && (
        <p role="status" className="rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          Esse tema já estava cadastrado; nada foi gravado.
        </p>
      )}
      {estado?.tipo === "erro" && (
        <ul role="alert" className="list-disc rounded-xl bg-vermelho-claro py-3 pr-4 pl-8 text-[15px] text-vermelho">
          {estado.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Prova de origem
        <input name="provaOrigem" defaultValue={valores?.provaOrigem} placeholder="CEBRASPE 2021 · CBM-AL · Soldado" className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Enunciado (comando da prova)
        <textarea name="enunciado" rows={6} defaultValue={valores?.enunciado} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Textos de apoio
        <span className="font-normal text-pedra">Um por bloco, separados por linha em branco. Opcional: “Texto I” na primeira linha e “Fonte: …” na última.</span>
        <textarea name="textosApoio" rows={6} defaultValue={valores?.textosApoio} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Padrão de resposta
        <span className="font-normal text-pedra">
          Uma linha por aspecto: código | descrição | pontos. Os pontos somam {pontuacaoMaxima}.
        </span>
        <textarea
          name="padrao"
          rows={5}
          defaultValue={valores?.padrao}
          placeholder={"1 | Apresentação e estrutura textual | 3\n2.1 | Primeiro tópico | 9\n2.2 | Segundo tópico | 9\n2.3 | Terceiro tópico | 9"}
          className={`${campo} font-mono text-[13px]`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        O que a banca espera (opcional)
        <textarea name="expectativas" rows={4} defaultValue={valores?.expectativas} className={campo} />
      </label>
      <button type="submit" disabled={enviando} className={`${botao.contorno} self-start`}>
        {enviando ? "Gravando…" : "Gravar tema"}
      </button>
    </form>
  );
}
```

`src/app/(app)/importar/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { AssistenteImportacao } from "@/components/importar/assistente";
import { ImportarTemaReal } from "@/components/importar/tema-real";
import { cartao, textoApoio, titulo } from "@/components/ui";
import { dadosDaImportacao } from "@/db/repositorios/importacao";
import { configDaDiscursiva } from "@/db/repositorios/redacao";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import { contextoDoUsuario, exigirCargo } from "../contexto";

// A sugestão de tópicos chama a IA em paralelo, um lote a cada 25 itens; vale para as Server Actions da página.
export const maxDuration = 300;

export default async function Importar() {
  const { moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const { db, cargo } = await exigirCargo();
  const [{ concurso, opcoes }, discursiva] = await Promise.all([
    dadosDaImportacao(db, cargo.id),
    configDaDiscursiva(db, cargo.concursoSlug),
  ]);

  return (
    <>
      <h1 className={titulo.pagina}>Importar prova</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens reais de provas anteriores da banca, com o gabarito oficial. Entram aprovados, ligados aos tópicos do edital, e servem
        de referência de estilo para os itens gerados.
      </p>
      <AssistenteImportacao concurso={concurso.nome} opcoes={opcoes} reaisNasSessoes={itensReaisVisiveis()} />

      {discursiva && (
        <section className={`${cartao} mt-12 flex flex-col gap-4`}>
          <h2 className={titulo.secao}>Tema de redação</h2>
          <p className={`${textoApoio} max-w-[60ch]`}>
            Proposta real de prova discursiva, com o padrão de resposta da banca. Entra aprovada e aparece primeiro na lista de
            temas.
          </p>
          <ImportarTemaReal pontuacaoMaxima={discursiva.pontuacaoMaxima} />
        </section>
      )}
    </>
  );
}
```

- [ ] **Passo 4: Verificar e commit**

Run: `npm run typecheck && npm run lint && npm test && NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npm run build`
Esperado: tudo passa.

```bash
git add src/importacao/tema.ts src/importacao/tema.test.ts src/components/importar/tema-real.tsx "src/app/(app)/importar"
git commit -m "feat(importar): temas reais de prova discursiva"
```

---

### Tarefa 7: testes de ponta a ponta

**Arquivos:**
- Criar: `e2e/discursiva-integracao.spec.ts`

- [ ] **Passo 1: Escrever os testes**

`e2e/discursiva-integracao.spec.ts`:

```ts
import { expect, test, type Admin } from "./fixtures";

const ASPECTOS = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];

async function criarTema(admin: Admin, nome: string): Promise<string> {
  const enunciado = `Tema E2E ${nome} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { error } = await admin.rpc("discursiva_importar_temas", {
    p_lote: { concurso: "cbmal-2026", prova_origem: "Prova E2E", temas: [{ enunciado, padrao_resposta: { aspectos: ASPECTOS, expectativas: "" } }] },
  });
  expect(error).toBeNull();
  const { data } = await admin.from("temas_discursiva").select("id").eq("enunciado", enunciado).single();
  return data!.id;
}

test("simulado com a discursiva: escreve a redação e ela é entregue junto", async ({ page, admin, usuarioLogado }) => {
  await criarTema(admin, "simulado");
  await page.goto("/simulado");
  const opcao = page.getByLabel(/Incluir a prova discursiva \(4h30 no total\)/);
  await expect(opcao).toBeChecked();
  await page.getByRole("button", { name: "Começar simulado" }).click();
  await expect(page).toHaveURL(/\/simulado\/[0-9a-f-]{36}$/);
  const sessaoId = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Redação", exact: true }).click();
  await page.getByLabel("Seu texto").fill("Texto da redação escrita dentro do simulado.");
  await expect(page.getByText("1/30 linhas")).toBeVisible();
  await page.getByRole("button", { name: "Item 1", exact: true }).click();
  await expect(page.getByText(/item 1 de 120$/)).toBeVisible();

  await page.getByRole("button", { name: "Entregar simulado" }).click();
  await page.getByRole("button", { name: "Entregar", exact: true }).click();
  await expect(page).toHaveURL(/\/resultado$/);
  await expect(page.getByRole("heading", { name: "P3 – Prova discursiva" })).toBeVisible();
  await expect(page.getByText("Em correção")).toBeVisible();

  const { data: r } = await admin.from("redacoes").select("status, linhas, usuario_id").eq("simulado_id", sessaoId).single();
  expect(r).toEqual({ status: "na_fila", linhas: ["Texto da redação escrita dentro do simulado."], usuario_id: usuarioLogado.id });
  const { data: s } = await admin.from("simulados").select("config").eq("id", sessaoId).single();
  expect(s!.config).toMatchObject({ duracaoMin: 270, discursiva: true });
});

test("painel mostra a seção de redação com a nota e os erros mais frequentes", async ({ page, admin, usuarioLogado }) => {
  const tema = await criarTema(admin, "painel");
  const { data: red } = await admin
    .from("redacoes")
    .insert({ usuario_id: usuarioLogado.id, tema_id: tema, status: "corrigida", linhas: ["x"], npd: 17.5, corrigida_em: new Date().toISOString() })
    .select("id")
    .single();
  const erro = { redacao_id: red!.id, usuario_id: usuarioLogado.id, linha: 1, trecho: "x", tipo: "morfossintaxe", correcao: "y", explicacao: "z" };
  await admin.from("erros_redacao").insert([
    { ...erro, categoria: "crase", canonico: "portugues/crase" },
    { ...erro, categoria: "crase", canonico: "portugues/crase" },
    { ...erro, categoria: "concordancia", canonico: "portugues/concordancia-verbal-e-nominal" },
  ]);

  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Redação", exact: true })).toBeVisible();
  await expect(page.getByText("Última nota")).toBeVisible();
  await expect(page.getByText("17,5", { exact: true })).toBeVisible();
  const lista = page.getByRole("heading", { name: "Erros mais frequentes (30 dias)" }).locator("..");
  await expect(lista.getByRole("listitem").first()).toContainText("crase");
  await expect(lista.getByRole("listitem").first()).toContainText("2 erros");
});
```

- [ ] **Passo 2: Rodar contra o Supabase local**

Com o Supabase local de pé e as migrações até a 0012 aplicadas (veja `docs/testes.md`):

Run: `npm run test:e2e`
Esperado: todos passam (os 15 anteriores e os 2 novos).

Se o Supabase local não puder subir neste ambiente, registre o erro e siga. O CI do PR roda o E2E.

- [ ] **Passo 3: Commit**

```bash
git add e2e/discursiva-integracao.spec.ts
git commit -m "test(e2e): simulado com discursiva e seção de redação do painel"
```

---

## Validação feita antes deste plano

O código deste plano foi escrito e testado numa cópia à parte:
- **Testes:** 303 unitários e 58 de banco, além de typecheck e lint.
- **E2E:** com o build de produção contra o Supabase local (migrações até a 0012), passaram 17 testes: os 15 anteriores e os 2 novos.
  - **Simulado:** o simulado com a discursiva dura 270 minutos e leva a aba "Redação". A redação é entregue junto com o simulado, e o resultado mostra a seção da prova discursiva.
  - **Painel:** a seção de redação mostra a nota e os erros mais frequentes.
- **Visual:** capturas em 390 px e 1280 px das telas do painel, da escolha do simulado, da aba de redação e do resultado.
- **Banco:** o teste da 0012 falha sem a migração e passa com ela.

## Depois desta etapa

O corretor de discursiva fica completo. Na primeira correção real em produção, conferir:
- a resposta do GPT na banca 2;
- o custo por correção em `ai_usage`;
- a primeira importação de um tema real, pela tela `/importar`.

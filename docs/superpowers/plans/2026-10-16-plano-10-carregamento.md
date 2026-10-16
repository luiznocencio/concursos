# Plano 10 — Respostas de carregamento em todo o app

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** tudo o que demora mostra uma resposta, seguindo as heurísticas de Nielsen (1 visibilidade do status, 3 controle, 5 prevenção de erros, 9 recuperação) e os limites de 0,1 s, 1 s e 10 s:
- **Navegação:** o item do menu mostra um indicador enquanto a página carrega; cada área tem um esqueleto (`loading.tsx`); uma falha mostra "Tentar de novo" (`error.tsx`).
- **Formulários:** cada botão de envio fica desativado e diz o que está acontecendo ("Montando a sessão…"), o que evita envio duplo.
- **Ações na tela:** correção do treino, entrega do simulado, envio da foto em etapas, importação e salvamento da redação mostram o andamento.
- **IA em segundo plano:**
  - na Redação, um cartão "Gerando um tema novo…" com o tempo decorrido e aviso se a revisão reprovou ou a geração falhou;
  - no Início e em Treinar, a faixa "Gerando itens para N tópicos…";
  - na correção e na transcrição, o tempo decorrido e, depois de 3 min, o aviso de demora.

**Arquitetura:**
- **Banco:** a função `meus_pedidos_ia()` (migração 0013) devolve os pedidos de geração do próprio usuário (em aberto ou dos últimos 30 min).
- **Regras puras:** em `src/lib/pedidos.ts` (`topicosEmGeracao`, `estadoDoTema`, `tempoDeEspera`).
- **Componentes:** `Indicador`, `Esqueleto`, `PaginaCarregando` (`src/components/carregando.tsx`), `BotaoEnviar` (`useFormStatus`), `AutoAtualizar` (`router.refresh()` periódico), `TempoDeEspera` (relógio só no navegador, via `useSyncExternalStore`) e `GeracaoDeItens`.
- **Next 16:** `error.tsx` recebe `retry` (não `reset`); o indicador do menu usa `useLinkStatus` de `next/link`.

**Stack:** Next.js 16.4 (App Router, Server Actions), React 19.3, Tailwind v4, Phosphor, Supabase, Vitest, Playwright.

## Restrições globais

- Código, comentários, textos de tela e commits em português, no estilo do código existente. Não rode formatadores (Prettier) em arquivos inteiros.
- Visual de `docs/design/DESIGN.md`:
  - só os tokens e as classes de `src/components/ui.ts`;
  - um só botão azul cheio por tela;
  - nenhum estouro horizontal em 390 px;
  - animações respeitam `motion-reduce`.
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

### Tarefa 1 (controlador): migração 0013

Feita pelo controlador, não por agente.

**Arquivos:**
- Criar: `supabase/migrations/0013_meus_pedidos_ia.sql`
- Modificar: `src/db/discursiva.dbtest.ts` (bloco `meus_pedidos_ia` no fim), `src/db/types.ts` (`meus_pedidos_ia: { Args: never; Returns: Json }`)

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

describe("meus_pedidos_ia", () => {
  it("devolve só os pedidos de IA do próprio usuário, em aberto ou recentes", async () => {
    await client.query("delete from public.jobs");
    await client.query(
      `insert into public.jobs (tipo, payload, status, atualizado_em) values
        ('gerar_tema', jsonb_build_object('concurso', 'c', 'pedido_por', $1::text), 'pendente', now()),
        ('gerar_itens', jsonb_build_object('canonico', 'portugues/crase', 'pedido_por', $1::text), 'concluido', now()),
        ('gerar_itens', jsonb_build_object('canonico', 'portugues/regencia', 'pedido_por', $1::text), 'concluido', now() - interval '2 hours'),
        ('corrigir_redacao', jsonb_build_object('redacao_id', 'r', 'pedido_por', $1::text), 'pendente', now()),
        ('gerar_tema', jsonb_build_object('concurso', 'c', 'pedido_por', $2::text), 'pendente', now())`,
      [ANA, BRUNO],
    );
    const pedidos = await comoUsuario(client, ANA, () =>
      valor<{ tipo: string; status: string; canonico: string | null }[]>("select public.meus_pedidos_ia()"),
    );
    expect(pedidos.map((p) => `${p.tipo}:${p.status}:${p.canonico}`).sort()).toEqual([
      "gerar_itens:concluido:portugues/crase",
      "gerar_tema:pendente:null",
    ]);
  });

  it("não fica disponível para visitantes", async () => {
    await client.query("set role anon");
    try {
      await expect(client.query("select public.meus_pedidos_ia()")).rejects.toThrow(/permission denied/);
    } finally {
      await client.query("reset role");
    }
  });
});
```

Run: `npm run test:db`. Esperado: FALHA (a função não existe).

- [ ] **Passo 2: Migração**

`supabase/migrations/0013_meus_pedidos_ia.sql`:

```sql
-- Pedidos de geração por IA do próprio usuário (itens e temas), para as telas mostrarem o andamento.
-- A tabela jobs não tem política de leitura para usuários: esta função devolve só os pedidos de auth.uid(),
-- em aberto ou atualizados nos últimos 30 minutos, com os campos que as telas usam.
create or replace function public.meus_pedidos_ia()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'tipo', j.tipo,
    'status', j.status,
    'canonico', j.payload->>'canonico',
    'criadoEm', j.criado_em,
    'atualizadoEm', j.atualizado_em
  ) order by j.criado_em desc), '[]'::jsonb)
  from public.jobs j
  where j.payload->>'pedido_por' = (select auth.uid())::text
    and j.tipo in ('gerar_itens', 'gerar_tema')
    and (j.status in ('pendente', 'processando') or j.atualizado_em > now() - interval '30 minutes')
$$;

revoke all on function public.meus_pedidos_ia() from public, anon;
grant execute on function public.meus_pedidos_ia() to authenticated;
```

Run: `npm run test:db`. Esperado: PASSA (60 testes).

- [ ] **Passo 3: Aplicar e publicar**

`apply_migration` no remoto (nome `0013_meus_pedidos_ia`) e a linha nova em `src/db/types.ts`, em ordem alfabética entre as funções.

```bash
git add supabase/migrations/0013_meus_pedidos_ia.sql src/db/discursiva.dbtest.ts src/db/types.ts
git commit -m "feat(db): meus_pedidos_ia para mostrar o andamento das gerações"
git push
```

---

### Tarefa 2: regras e componentes de carregamento

**Arquivos:**
- Criar: `src/lib/pedidos.ts`, `src/lib/pedidos.test.ts`, `src/db/repositorios/pedidos.ts`, `src/components/carregando.tsx`, `src/components/botao-enviar.tsx`, `src/components/auto-atualizar.tsx`, `src/components/tempo-de-espera.tsx`, `src/components/geracao-itens.tsx`
- Modificar: `src/components/nav-link.tsx`, `src/db/repositorios/redacao.ts`

- [ ] **Passo 1: Teste das regras**

`src/lib/pedidos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { estadoDoTema, tempoDeEspera, topicosEmGeracao, type PedidoIa } from "./pedidos";

const pedido = (tipo: PedidoIa["tipo"], status: PedidoIa["status"], criadoEm: string, canonico: string | null = null): PedidoIa => ({
  tipo,
  status,
  canonico,
  criadoEm,
  atualizadoEm: criadoEm,
});

describe("topicosEmGeracao", () => {
  it("conta tópicos distintos com pedido de itens em aberto", () => {
    expect(
      topicosEmGeracao([
        pedido("gerar_itens", "pendente", "2026-10-16T10:00:00Z", "a"),
        pedido("gerar_itens", "processando", "2026-10-16T10:00:00Z", "a"),
        pedido("gerar_itens", "pendente", "2026-10-16T10:00:00Z", "b"),
        pedido("gerar_itens", "concluido", "2026-10-16T10:00:00Z", "c"),
        pedido("gerar_tema", "pendente", "2026-10-16T10:00:00Z"),
      ]),
    ).toBe(2);
  });
});

describe("estadoDoTema", () => {
  const pedidoEm = "2026-10-16T10:00:00Z";

  it("sem pedido de tema, nada a avisar", () => {
    expect(estadoDoTema([], [])).toBeNull();
  });

  it("pedido em aberto: gerando desde a criação", () => {
    expect(estadoDoTema([pedido("gerar_tema", "processando", pedidoEm)], [])).toEqual({ tipo: "gerando", desde: pedidoEm });
  });

  it("concluído com tema gerado depois do pedido: nada a avisar", () => {
    expect(estadoDoTema([pedido("gerar_tema", "concluido", pedidoEm)], [{ origem: "gerado", criadoEm: "2026-10-16T10:01:00Z" }])).toBeNull();
  });

  it("concluído sem tema novo: a revisão reprovou", () => {
    const temas = [{ origem: "gerado", criadoEm: "2026-10-15T10:00:00Z" }, { origem: "real", criadoEm: "2026-10-16T11:00:00Z" }];
    expect(estadoDoTema([pedido("gerar_tema", "concluido", pedidoEm)], temas)).toEqual({ tipo: "reprovado" });
  });

  it("vale o pedido mais recente; falha é avisada", () => {
    const pedidos = [pedido("gerar_tema", "concluido", "2026-10-16T09:00:00Z"), pedido("gerar_tema", "falhou", pedidoEm)];
    expect(estadoDoTema(pedidos, [])).toEqual({ tipo: "falhou" });
  });
});

describe("tempoDeEspera", () => {
  const agora = new Date("2026-10-16T10:05:00Z");

  it("segundos até 1 minuto, depois minutos", () => {
    expect(tempoDeEspera("2026-10-16T10:04:20Z", agora)).toEqual({ texto: "há 40 s", demorando: false });
    expect(tempoDeEspera("2026-10-16T10:03:00Z", agora)).toEqual({ texto: "há 2 min", demorando: false });
  });

  it("passa a demorando depois do limite", () => {
    expect(tempoDeEspera("2026-10-16T10:01:00Z", agora).demorando).toBe(true);
    expect(tempoDeEspera("2026-10-16T10:04:00Z", agora, 30).demorando).toBe(true);
  });
});
```

Run: `npx vitest run src/lib/pedidos.test.ts`. Esperado: FALHA (módulo ausente).

- [ ] **Passo 2: Regras**

`src/lib/pedidos.ts`:

```ts
// Andamento das tarefas de IA em segundo plano, para as telas mostrarem o status (heurística 1 de Nielsen).

export interface PedidoIa {
  tipo: "gerar_itens" | "gerar_tema";
  status: "pendente" | "processando" | "concluido" | "falhou";
  canonico: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

const emAberto = (p: PedidoIa) => p.status === "pendente" || p.status === "processando";

// Tópicos com geração de itens ainda na fila (um tópico pode ter mais de um pedido).
export function topicosEmGeracao(pedidos: PedidoIa[]): number {
  return new Set(pedidos.filter((p) => p.tipo === "gerar_itens" && emAberto(p)).map((p) => p.canonico)).size;
}

export type EstadoTema = { tipo: "gerando"; desde: string } | { tipo: "reprovado" } | { tipo: "falhou" } | null;

/**
 * O que dizer sobre o último pedido de tema: ainda gerando, falhou, ou terminou sem tema novo na lista
 * (a revisão da outra IA reprovou). Se um tema gerado apareceu depois do pedido, não há o que avisar.
 */
export function estadoDoTema(pedidos: PedidoIa[], temas: { origem: string; criadoEm: string }[]): EstadoTema {
  const ultimo = pedidos
    .filter((p) => p.tipo === "gerar_tema")
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  if (!ultimo) return null;
  if (emAberto(ultimo)) return { tipo: "gerando", desde: ultimo.criadoEm };
  if (ultimo.status === "falhou") return { tipo: "falhou" };
  const chegou = temas.some((t) => t.origem === "gerado" && new Date(t.criadoEm) >= new Date(ultimo.criadoEm));
  return chegou ? null : { tipo: "reprovado" };
}

// "há 40 s", "há 2 min"; `demorando` depois do limite (padrão 3 min), para avisar que está mais lento que o normal.
export function tempoDeEspera(desde: string, agora: Date, limiteSegundos = 180): { texto: string; demorando: boolean } {
  const s = Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 1000));
  const texto = s < 60 ? `há ${s} s` : `há ${Math.floor(s / 60)} min`;
  return { texto, demorando: s > limiteSegundos };
}
```

Run: `npx vitest run src/lib/pedidos.test.ts`. Esperado: PASSA (8 testes).

- [ ] **Passo 3: Repositórios**

O de pedidos é novo. O de redação ganha `criadoEm` em `TemaResumo` e `entregueEm`/`atualizadoEm` em `RedacaoCompleta`.

`src/db/repositorios/pedidos.ts`:

```ts
import { z } from "zod";
import type { PedidoIa } from "@/lib/pedidos";
import type { Cliente } from "./estudo";

const pedidosSchema = z.array(
  z.object({
    tipo: z.enum(["gerar_itens", "gerar_tema"]),
    status: z.enum(["pendente", "processando", "concluido", "falhou"]),
    canonico: z.string().nullable(),
    criadoEm: z.string(),
    atualizadoEm: z.string(),
  }),
);

// Pedidos de geração do próprio usuário (em aberto ou dos últimos 30 min). O status é só informativo:
// se a leitura falhar, a página segue sem ele.
export async function meusPedidosIa(db: Cliente): Promise<PedidoIa[]> {
  const { data, error } = await db.rpc("meus_pedidos_ia");
  const lidos = error ? null : pedidosSchema.safeParse(data);
  if (!lidos?.success) {
    console.error("meus_pedidos_ia:", error?.message ?? lidos?.error.message);
    return [];
  }
  return lidos.data;
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
  criadoEm: string;
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
  entregueEm: string | null;
  atualizadoEm: string;
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
      criadoEm: t.criado_em,
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
       entregue_em, atualizado_em, prioridades, detalhes,
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
    entregueEm: data.entregue_em,
    atualizadoEm: data.atualizado_em,
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

- [ ] **Passo 4: Componentes**

`src/components/carregando.tsx`:

```tsx
import { CircleNotch } from "@phosphor-icons/react/ssr";

// Indicador de andamento padrão do app (um só ícone em todo lugar, heurística de consistência).
// Sem animação para quem pede movimento reduzido.
export function Indicador({ tamanho = 16, className = "" }: { tamanho?: number; className?: string }) {
  return <CircleNotch size={tamanho} weight="bold" aria-hidden className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`} />;
}

// Bloco do esqueleto de carregamento: tem o formato do conteúdo que vai chegar.
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-tinta/5 motion-reduce:animate-none ${className}`} />;
}

// Página inteira em carregamento: anuncia o estado para leitores de tela e mostra os blocos.
export function PaginaCarregando({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}
```

`src/components/botao-enviar.tsx`:

```tsx
"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Indicador } from "./carregando";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  // Texto enquanto o formulário é enviado, dizendo o que está acontecendo ("Montando a sessão…").
  pendente: string;
};

// Botão de envio de formulário com Server Action: responde na hora ao clique, mostra o andamento
// e fica desativado até a resposta (evita envio duplo). Com `name`/`value`, só o botão clicado mostra o andamento.
export function BotaoEnviar({ pendente, children, disabled, name, value, ...props }: Props) {
  const { pending, data } = useFormStatus();
  const esteBotao = pending && (name === undefined || data?.get(name) === String(value));
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={esteBotao} {...props}>
      {esteBotao ? (
        <>
          <Indicador />
          {pendente}
        </>
      ) : (
        children
      )}
    </button>
  );
}
```

`src/components/auto-atualizar.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Recarrega os dados da página de tempos em tempos enquanto algo é gerado em segundo plano.
export function AutoAtualizar({ intervaloMs = 5000 }: { intervaloMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), intervaloMs);
    return () => clearInterval(t);
  }, [router, intervaloMs]);
  return null;
}
```

`src/components/tempo-de-espera.tsx`:

```tsx
"use client";

import { useSyncExternalStore } from "react";
import { tempoDeEspera } from "@/lib/pedidos";

// "Começou há 40 s", contando a cada segundo; passado o limite, avisa que está mais lento que o normal.
// O relógio só começa no navegador, para o HTML do servidor não divergir da hidratação.
function aCadaSegundo(avisar: () => void) {
  const t = setInterval(avisar, 1000);
  return () => clearInterval(t);
}
const segundoAtual = () => Math.floor(Date.now() / 1000) * 1000;

export function TempoDeEspera({ desde, demora }: { desde: string; demora: string }) {
  const agora = useSyncExternalStore(aCadaSegundo, segundoAtual, () => null);
  if (agora === null) return null;
  const { texto, demorando } = tempoDeEspera(desde, new Date(agora));
  return (
    <span className="flex flex-col gap-2">
      <span className="text-sm text-pedra tabular-nums">Começou {texto}</span>
      {demorando && (
        <span role="status" className="rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          {demora}
        </span>
      )}
    </span>
  );
}
```

`src/components/geracao-itens.tsx`:

```tsx
import { AutoAtualizar } from "@/components/auto-atualizar";
import { Indicador } from "@/components/carregando";
import { topicosEmGeracao, type PedidoIa } from "@/lib/pedidos";

// Faixa enquanto há itens sendo gerados para o usuário; some sozinha quando a fila esvazia.
export function GeracaoDeItens({ pedidos }: { pedidos: PedidoIa[] }) {
  const n = topicosEmGeracao(pedidos);
  if (n === 0) return null;
  return (
    <div role="status" className="mb-8 flex items-start gap-3 rounded-xl bg-realce px-4 py-3 text-[15px] text-grafite">
      <AutoAtualizar intervaloMs={20_000} />
      <Indicador className="mt-0.5" />
      <span>
        Gerando itens para {n === 1 ? "1 tópico" : `${n} tópicos`}… Leva alguns minutos; os itens novos entram nas próximas
        sessões.
      </span>
    </div>
  );
}
```

`src/components/nav-link.tsx`:

```tsx
"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Indicador } from "./carregando";

// Marca o item clicado enquanto a página nova carrega (a resposta ao clique é imediata).
function Andamento() {
  const { pending } = useLinkStatus();
  return pending ? <Indicador tamanho={12} className="ml-1.5" /> : null;
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const caminho = usePathname();
  const ativo = href === "/" ? caminho === "/" : caminho.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
        ativo ? "bg-tinta/5 text-tinta" : "text-tinta/55 hover:text-tinta"
      }`}
    >
      {children}
      <Andamento />
    </Link>
  );
}
```

- [ ] **Passo 5: Verificar e commitar**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add src/lib/pedidos.ts src/lib/pedidos.test.ts src/db/repositorios/pedidos.ts src/db/repositorios/redacao.ts src/components/carregando.tsx src/components/botao-enviar.tsx src/components/auto-atualizar.tsx src/components/tempo-de-espera.tsx src/components/geracao-itens.tsx src/components/nav-link.tsx
git commit -m "feat: componentes e regras de carregamento"
```

---

### Tarefa 3: botões de envio e andamento da IA nas páginas

Todo `<button type="submit">` de formulário de servidor vira `BotaoEnviar` com o texto de espera. Redação, Início e Treinar passam a mostrar os pedidos de IA em andamento.

**Arquivos:**
- Modificar: as páginas e componentes abaixo, `src/components/redacao/andamento.tsx`, `src/components/aviso.tsx`

- [ ] **Passo 1: Andamento e avisos**

`src/components/redacao/andamento.tsx`:

```tsx
import { CheckCircle, CircleNotch } from "@phosphor-icons/react/ssr";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { TempoDeEspera } from "@/components/tempo-de-espera";
import type { Passo } from "@/lib/redacao";

// Enquanto o worker trabalha, recarrega os dados da página a cada 5 s; a página troca de tela quando o estado muda.
export function Andamento({ passos, desde }: { passos: Passo[]; desde: string }) {
  return (
    <div className="flex flex-col gap-4">
      <AutoAtualizar />
      <ul className="flex flex-col gap-3" aria-live="polite">
        {passos.map((p) => (
          <li key={p.nome} className="flex items-center gap-3">
            {p.feito ? (
              <CheckCircle size={22} weight="fill" className="text-azul" aria-label="concluído" />
            ) : (
              <CircleNotch size={22} className="animate-spin text-pedra motion-reduce:animate-none" aria-label="em andamento" />
            )}
            <span className={p.feito ? "" : "text-grafite"}>{p.nome}</span>
          </li>
        ))}
      </ul>
      <TempoDeEspera
        desde={desde}
        demora="Está demorando mais que o normal. Se a IA falhar, o sistema tenta de novo sozinho."
      />
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
      ? `Pedimos a geração de itens para ${pedidos === 1 ? "1 tópico" : `${pedidos} tópicos`}. Acompanhe na faixa abaixo.`
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
      return "Pedimos um tema novo. Acompanhe abaixo, em Escolha um tema.";
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

- [ ] **Passo 2: Páginas**

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
import { BotaoEnviar } from "@/components/botao-enviar";
import { GeracaoDeItens } from "@/components/geracao-itens";
import { meusPedidosIa } from "@/db/repositorios/pedidos";

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
  const [estrutura, historico, abertas, recentes, vencidas, pedidosIa] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.historico(cargo.id),
    listarSessoes(db, cargo.id, { abertas: true, limite: 1 }),
    listarSessoes(db, cargo.id, { limite: 5 }),
    contarRevisoesVencidas(db, agora),
    meusPedidosIa(db),
  ]);
  const foco = calcularPrioridades(estrutura.topicosAlvo, historico, agora).slice(0, 5);
  const aberta = abertas[0];
  const dias = diasAte(estrutura.concurso.dataProva, agora);

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <GeracaoDeItens pedidos={pedidosIa} />
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
              <BotaoEnviar pendente="Montando a sessão…" className={botao.primario}>
                Começar sessão
              </BotaoEnviar>
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
                <BotaoEnviar
                  key={c.id}
                  pendente={c.nome}
                  name="cargo"
                  value={c.id}
                  aria-pressed={c.id === cargo.id}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ${
                    c.id === cargo.id ? "bg-white text-meia-noite" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {c.nome}
                </BotaoEnviar>
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
            <BotaoEnviar pendente="Montando a revisão…" disabled={vencidas === 0} className={botao.contorno}>
              Revisar agora
            </BotaoEnviar>
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
                  <p className="line-clamp-2 font-medium" title={t.titulo}>{t.titulo}</p>
                  <p className="text-sm text-pedra">
                    {estrutura.disciplinas[t.disciplina]} ·{" "}
                    {t.n === 0 ? "nunca praticado" : `${aproveitamento(t.aproveitamento)} em ${plural(t.n, "resposta", "respostas")}`}
                  </p>
                </div>
                <form action={treinarTopicos}>
                  <input type="hidden" name="canonico" value={t.canonico} />
                  <input type="hidden" name="total" value="10" />
                  <BotaoEnviar pendente="Montando…" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    Treinar
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </BotaoEnviar>
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
                  className="flex items-center gap-4 py-3 transition-colors duration-200 hover:bg-realce"
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
import { BotaoEnviar } from "@/components/botao-enviar";
import { GeracaoDeItens } from "@/components/geracao-itens";
import { meusPedidosIa } from "@/db/repositorios/pedidos";

export default async function Treinar({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; pedidos?: string }>;
}) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const agora = new Date();
  const [estrutura, candidatos, historico, pedidosIa] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.candidatos(cargo.id),
    repo.historico(cargo.id),
    meusPedidosIa(db),
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
      <GeracaoDeItens pedidos={pedidosIa} />
      <h1 className={titulo.pagina}>Treinar por tópico</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Escolha os tópicos do edital. Os itens que você ainda não viu vêm primeiro; quando faltam, pedimos mais à IA.
      </p>

      <form action={treinarTopicos} className="mt-8 flex flex-col gap-6">
        <div className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {tabela.map((d) => (
            <details key={d.disciplina} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-4">
                <span className="flex-1 font-semibold">{estrutura.disciplinas[d.disciplina]}</span>
                <span className="text-sm text-pedra">{plural(d.topicos.length, "tópico", "tópicos")}</span>
              </summary>
              <ul className="flex flex-col pb-4">
                {d.topicos.map((t) => (
                  <li key={`${t.disciplina}:${t.codigo}`}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-realce">
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

        <div className="sticky bottom-4 flex flex-wrap items-center gap-4 self-start rounded-xl border border-borda bg-superficie px-4 py-3">
          <label htmlFor="total" className="text-sm font-medium">
            Quantidade
          </label>
          <select id="total" name="total" defaultValue="10" className="rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-sm">
            <option value="10">10 itens</option>
            <option value="20">20 itens</option>
            <option value="30">30 itens</option>
          </select>
          <BotaoEnviar pendente="Montando o treino…" className={botao.primario}>
            Começar treino
          </BotaoEnviar>
        </div>
      </form>
    </>
  );
}
```

`src/app/(app)/redacao/page.tsx`:

```tsx
import Link from "next/link";
import { Aviso } from "@/components/aviso";
import { Evolucao } from "@/components/painel/evolucao";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { configDaDiscursiva, listarRedacoes, listarTemas } from "@/db/repositorios/redacao";
import { data, nota } from "@/lib/formato";
import { resumoDoTema, rotuloStatus } from "@/lib/redacao";
import { exigirCargo } from "../contexto";
import { novaRedacao, pedirNovoTema } from "./acoes";
import { BotaoEnviar } from "@/components/botao-enviar";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { Indicador } from "@/components/carregando";
import { TempoDeEspera } from "@/components/tempo-de-espera";
import { meusPedidosIa } from "@/db/repositorios/pedidos";
import { estadoDoTema } from "@/lib/pedidos";

export default async function Redacoes({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const [temas, redacoes, config, pedidos] = await Promise.all([
    listarTemas(db, cargo.concursoSlug),
    listarRedacoes(db),
    configDaDiscursiva(db, cargo.concursoSlug),
    meusPedidosIa(db),
  ]);
  const novoTema = estadoDoTema(pedidos, temas);
  const corrigidas = redacoes.filter((r) => r.status === "corrigida" && r.npd !== null).slice(0, 8).reverse();

  return (
    <>
      <Aviso codigo={aviso} />
      <h1 className={titulo.pagina}>Redação</h1>
      <p className={`${textoApoio} mt-3 max-w-[62ch]`}>
        Escreva na folha de {config?.linhasMax ?? 30} linhas ou envie a foto da folha manuscrita. Duas bancas de IA corrigem o
        conteúdo, como na Cebraspe, e a revisão de língua aponta cada erro.
      </p>

      {config && corrigidas.length >= 2 && (
        <section className={`${cartao} mt-8`}>
          <Evolucao
            nome="Nota na discursiva"
            maximo={config.pontuacaoMaxima}
            corte={config.notaMinima}
            pontos={corrigidas.map((r) => ({ id: r.id, rotulo: data(r.corrigidaEm ?? r.criadaEm), nota: r.npd ?? 0 }))}
          />
        </section>
      )}

      <section className="mt-12">
        <h2 className={titulo.secao}>Suas redações</h2>
        {redacoes.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhuma redação ainda. Escolha um tema abaixo para começar.</p>
        ) : (
          <ul className="mt-4 divide-y divide-borda rounded-xl border border-borda bg-superficie">
            {redacoes.map((r) => {
              const s = rotuloStatus(r.status);
              return (
                <li key={r.id}>
                  <Link href={`/redacao/${r.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-realce">
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2" title={r.tema}>
                        {resumoDoTema(r.tema)}
                      </span>
                      <span className="text-sm text-pedra">{data(r.criadaEm)}</span>
                    </span>
                    <span className={pilula[s.tom]}>{s.texto}</span>
                    {r.npd !== null && <span className="w-12 text-right font-semibold tabular-nums">{nota(r.npd)}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className={titulo.secao}>Escolha um tema</h2>
          {novoTema?.tipo !== "gerando" && (
            <form action={pedirNovoTema}>
              <BotaoEnviar pendente="Pedindo…" className={botao.secundario}>
                Gerar tema novo
              </BotaoEnviar>
            </form>
          )}
        </div>
        {novoTema?.tipo === "gerando" && (
          <div role="status" className={`${cartao} mt-4 flex flex-col gap-2`}>
            <AutoAtualizar />
            <p className="flex items-center gap-2 font-medium">
              <Indicador /> Gerando um tema novo…
            </p>
            <p className={textoApoio}>
              Uma IA escreve a proposta e outra revisa. Leva cerca de 1 minuto; o tema aparece aqui quando ficar pronto.
            </p>
            <TempoDeEspera
              desde={novoTema.desde}
              demora="Está demorando mais que o normal. Pode sair desta página: o tema aparece aqui quando ficar pronto."
            />
          </div>
        )}
        {(novoTema?.tipo === "reprovado" || novoTema?.tipo === "falhou") && (
          <p role="status" className="mt-4 rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
            {novoTema.tipo === "reprovado"
              ? "O último tema gerado não passou na revisão e foi descartado. Peça outro."
              : "Não foi possível gerar o último tema. Peça outro."}
          </p>
        )}
        {temas.length === 0 ? (
          novoTema?.tipo !== "gerando" && (
            <p className={`${textoApoio} mt-3`}>Nenhum tema ainda. Gere um tema novo: fica pronto em cerca de 1 minuto.</p>
          )
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {temas.map((t) => (
              <li key={t.id} className={`${cartao} flex flex-col gap-4`}>
                <div className="flex flex-wrap gap-2">
                  {t.origem === "real" && <span className={pilula.azul}>Tema real{t.provaOrigem ? ` · ${t.provaOrigem}` : ""}</span>}
                  {t.feito && <span className={pilula.neutra}>Já feito</span>}
                </div>
                <p className="line-clamp-3 font-medium" title={t.enunciado}>
                  {resumoDoTema(t.enunciado)}
                </p>
                <form action={novaRedacao} className="mt-auto">
                  <input type="hidden" name="tema" value={t.id} />
                  <BotaoEnviar pendente="Abrindo…" className={botao.contorno}>
                    Escrever sobre este tema
                  </BotaoEnviar>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
```

`src/app/(app)/redacao/[id]/page.tsx`:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Andamento } from "@/components/redacao/andamento";
import { ConferenciaFoto } from "@/components/redacao/conferencia-foto";
import { EnvioFoto } from "@/components/redacao/envio-foto";
import { FolhaEscrita } from "@/components/redacao/folha-escrita";
import { ResultadoRedacao } from "@/components/redacao/resultado";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { carregarRedacao, urlsDasFotos } from "@/db/repositorios/redacao";
import { passosDoAndamento, rotuloStatus } from "@/lib/redacao";
import { contextoDoUsuario } from "../../contexto";
import { tentarDeNovo } from "../acoes";
import { BotaoEnviar } from "@/components/botao-enviar";

const transcricaoSchema = z.object({ linhas: z.array(z.object({ texto: z.string(), ilegivel: z.boolean() })) });

export default async function PaginaRedacao({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const { id } = await params;
  const { erro } = await searchParams;
  const { db, user } = await contextoDoUsuario();
  const r = await carregarRedacao(db, id);
  if (!r) notFound();
  const s = rotuloStatus(r.status);

  return (
    <>
      <Link href="/redacao" className={`${botao.texto} -ml-4 mb-4`}>
        ← Redações
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={titulo.secao}>Redação</h1>
        <span className={pilula[s.tom]}>{s.texto}</span>
        {r.tema.origem === "real" && <span className={pilula.azul}>Tema real{r.tema.provaOrigem ? ` · ${r.tema.provaOrigem}` : ""}</span>}
      </div>

      <details className={`${cartao} mt-6`} open={r.status === "rascunho"}>
        <summary className="cursor-pointer font-semibold">Proposta</summary>
        <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line">{r.tema.enunciado}</p>
        {r.tema.textosApoio.map((t, i) => (
          <blockquote key={i} className="mt-4 border-l-2 border-borda-forte pl-4 text-[15px] text-grafite">
            {t.titulo && <p className="font-medium text-tinta">{t.titulo}</p>}
            <p className="whitespace-pre-line">{t.texto}</p>
            {t.fonte && <p className="mt-1 text-sm text-pedra">{t.fonte}</p>}
          </blockquote>
        ))}
      </details>

      {(r.aviso || erro) && (
        <p role="status" className="mt-6 rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          {erro ?? r.aviso}
        </p>
      )}

      <div className="mt-8">
        <Conteudo r={r} usuarioId={user.id} />
      </div>
    </>
  );
}

async function Conteudo({ r, usuarioId }: { r: NonNullable<Awaited<ReturnType<typeof carregarRedacao>>>; usuarioId: string }) {
  const { db } = await contextoDoUsuario();
  switch (r.status) {
    case "rascunho":
      return (
        <div className="flex flex-col gap-10">
          <FolhaEscrita redacaoId={r.id} textoInicial={r.texto} config={r.config} />
          <section className={`${cartao} flex flex-col gap-3`}>
            <h2 className="font-semibold">Prefere escrever no papel?</h2>
            <p className={textoApoio}>
              Escreva à mão numa folha de {r.config.linhasMax} linhas e envie a foto. A IA transcreve linha por linha e você
              confere antes da correção.
            </p>
            <EnvioFoto redacaoId={r.id} usuarioId={usuarioId} />
          </section>
        </div>
      );
    case "aguardando_confirmacao": {
      const t = transcricaoSchema.safeParse(r.correcoes.find((c) => c.papel === "transcricao")?.resposta);
      const duvidosas = t.success ? t.data.linhas.flatMap((l, i) => (l.ilegivel ? [i + 1] : [])) : [];
      return (
        <ConferenciaFoto
          redacaoId={r.id}
          fotos={await urlsDasFotos(db, r.fotos)}
          linhasIniciais={r.linhas}
          duvidosas={duvidosas}
          linhasMax={r.config.linhasMax}
        />
      );
    }
    case "corrigida":
      return <ResultadoRedacao r={r} />;
    case "falhou":
      return (
        <section className={`${cartao} flex flex-col gap-4`}>
          <p className={textoApoio}>A correção não terminou. Seu texto está salvo e pode ser corrigido de novo.</p>
          <form action={tentarDeNovo.bind(null, r.id)}>
            <BotaoEnviar pendente="Entregando…" className={botao.primario}>
              Tentar de novo
            </BotaoEnviar>
          </form>
        </section>
      );
    default:
      return (
        <section className={`${cartao} flex flex-col gap-6`}>
          <Andamento
            passos={passosDoAndamento(r.status, r.correcoes.map((c) => c.papel))}
            desde={r.status === "transcrevendo" ? r.atualizadoEm : (r.entregueEm ?? r.atualizadoEm)}
          />
          <p className={textoApoio}>Leva cerca de 1 minuto. Pode sair desta página: a correção continua e fica salva em Redações.</p>
        </section>
      );
  }
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
import { BotaoEnviar } from "@/components/botao-enviar";

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
              <BotaoEnviar pendente="Montando a prova…" className={`${botao.primario} self-start`}>
                Começar simulado
              </BotaoEnviar>
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
              <BotaoEnviar pendente="Pedindo…" className={botao.secundario}>
                Pedir itens à IA
              </BotaoEnviar>
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
import { BotaoEnviar } from "@/components/botao-enviar";

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
            <BotaoEnviar pendente="Montando a revisão…" className={botao.primario}>
              Revisar erros
            </BotaoEnviar>
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
import { BotaoEnviar } from "@/components/botao-enviar";

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
            <BotaoEnviar pendente="Encerrando…" className={botao.texto}>
              Encerrar sessão
            </BotaoEnviar>
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
            <BotaoEnviar pendente="Montando a sessão…" className={botao.primario}>
              Nova sessão
            </BotaoEnviar>
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
import { BotaoEnviar } from "@/components/botao-enviar";

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
                  <blockquote className="border-l-2 border-borda-forte pl-4 text-sm leading-relaxed text-tinta/70">
                    {i.citacao}
                    {i.fonte && <span className="mt-1 block text-pedra">{i.fonte}</span>}
                  </blockquote>
                )}
                {v.denuncias && v.denuncias.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {v.denuncias.map((d, k) => (
                      <li key={k} className="text-vermelho-tinta">
                        Denúncia{d.em ? ` em ${dataEHora(d.em)}` : ""}: {d.motivo || "sem motivo"}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={decidir} className="flex flex-wrap gap-2">
                  <input type="hidden" name="item" value={i.id} />
                  <BotaoEnviar pendente="Aprovando…" name="decisao" value="aprovar" className={botao.contorno}>
                    Aprovar como está
                  </BotaoEnviar>
                  <BotaoEnviar pendente="Aprovando…" name="decisao" value="inverter" className={botao.contorno}>
                    Aprovar com gabarito {i.gabarito === "C" ? "Errado" : "Certo"}
                  </BotaoEnviar>
                  <BotaoEnviar pendente="Descartando…" name="decisao" value="descartar" className={`${botao.texto} text-vermelho`}>
                    Descartar
                  </BotaoEnviar>
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
import { BotaoEnviar } from "@/components/botao-enviar";

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
                              <BotaoEnviar pendente="Montando…" className={botao.texto}>
                                Treinar
                              </BotaoEnviar>
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
                  <BotaoEnviar pendente="" className={botao.texto} aria-label={`Treinar ${t.titulo}`}>
                    <ArrowRight size={16} weight="bold" aria-hidden />
                  </BotaoEnviar>
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

`src/app/(app)/layout.tsx`:

```tsx
import Link from "next/link";
import { cookies } from "next/headers";
import { NavLink } from "@/components/nav-link";
import { SeletorTema } from "@/components/seletor-tema";
import { botao } from "@/components/ui";
import { COOKIE_TEMA, lerTema } from "@/lib/tema";
import { sair } from "../actions";
import { contextoDoUsuario } from "./contexto";
import { BotaoEnviar } from "@/components/botao-enviar";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const { user, moderador } = await contextoDoUsuario();
  const tema = lerTema((await cookies()).get(COOKIE_TEMA)?.value);
  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-10 border-b border-borda bg-papel/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 md:gap-4">
          <Link href="/" className="text-[15px] font-semibold tracking-tight">
            Concursos
          </Link>
          <nav aria-label="Principal" className="-mx-1 flex flex-1 gap-1 overflow-x-auto px-1">
            <NavLink href="/">Início</NavLink>
            <NavLink href="/treinar">Treinar</NavLink>
            <NavLink href="/simulado">Simulado</NavLink>
            <NavLink href="/redacao">Redação</NavLink>
            <NavLink href="/painel">Painel</NavLink>
            {moderador && <NavLink href="/itens">Itens</NavLink>}
            {moderador && <NavLink href="/importar">Importar</NavLink>}
          </nav>
          <span className="hidden text-sm text-pedra md:inline">{user.email}</span>
          <SeletorTema inicial={tema} />
          <form action={sair}>
            <BotaoEnviar pendente="Saindo…" className={botao.texto}>
              Sair
            </BotaoEnviar>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-24">{children}</main>
    </div>
  );
}
```

`src/app/entrar/page.tsx`:

```tsx
import { botao } from "@/components/ui";
import { enviarLinkMagico } from "./actions";
import { BotaoEnviar } from "@/components/botao-enviar";

const MENSAGENS: Record<string, string> = {
  email: "Informe um e-mail válido.",
  "nao-autorizado": "Este e-mail não tem acesso à plataforma.",
  envio: "Não foi possível enviar o link. Tente de novo em alguns minutos.",
  limite: "Limite de e-mails de acesso atingido. Use o último link recebido ou tente de novo em até 1 hora.",
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
        <p className="rounded-xl border border-borda bg-superficie p-6 text-grafite">
          Enviamos um link de acesso para o seu e-mail. Abra-o neste navegador.
        </p>
      ) : (
        <form action={enviarLinkMagico} className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-6">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-borda-campo bg-superficie px-3 py-2"
          />
          <input type="hidden" name="proximo" value={proximo ?? "/"} />
          {erro && <p className="text-sm text-vermelho">{MENSAGENS[erro] ?? "Algo deu errado."}</p>}
          <BotaoEnviar pendente="Enviando o link…" className={botao.primario}>
            Receber link de acesso
          </BotaoEnviar>
        </form>
      )}
    </main>
  );
}
```

`src/components/redacao/resultado.tsx`:

```tsx
import { ROTULO_CATEGORIA, type CategoriaErro } from "@/core";
import type { RedacaoCompleta } from "@/db/repositorios/redacao";
import { notasPorAspecto } from "@/pipeline/discursiva/consolidar";
import { correcaoConteudoSchema, type CorrecaoConteudo } from "@/pipeline/discursiva/schemas";
import { treinarTopicos } from "@/app/(app)/acoes";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { nota } from "@/lib/formato";
import { segmentosDaLinha } from "@/lib/redacao";
import { BotaoEnviar } from "@/components/botao-enviar";

const BANCAS = ["conteudo_1", "conteudo_2", "conteudo_3"] as const;
const NOME_TIPO: Record<string, string> = { grafia: "grafia", morfossintaxe: "morfossintaxe", propriedade_vocabular: "propriedade vocabular" };
const MOTIVO_ZERO: Record<string, string> = {
  sem_texto: "Texto sem linhas escritas recebe nota zero (edital, item 9.7.5, alínea f).",
  fuga_tema: "As bancas consideraram que o texto fugiu ao tema: a nota é zero (edital, item 9.7.5, alínea f).",
  npd_negativo: "Os erros de língua superaram a nota de conteúdo, e a nota final não fica negativa (edital, item 9.7.5, alínea e).",
};

function rotuloCategoria(c: string): string {
  return ROTULO_CATEGORIA[c as CategoriaErro] ?? c;
}

export function ResultadoRedacao({ r }: { r: RedacaoCompleta }) {
  const npd = r.npd ?? 0;
  const aprovado = npd >= r.config.notaMinima;
  const aspectos = r.tema.padrao.aspectos;
  const bancas = BANCAS.map((papel) => {
    const c = r.correcoes.find((x) => x.papel === papel);
    const lida = c ? correcaoConteudoSchema.safeParse(c.resposta) : null;
    return lida?.success ? { papel, correcao: lida.data as CorrecaoConteudo } : null;
  }).filter((b) => b !== null);
  const notas = bancas.map((b) => notasPorAspecto(b.correcao, aspectos));
  const usadas = new Set(r.detalhes?.usadas ?? []);
  const media = new Map((r.detalhes?.aspectos ?? []).map((a) => [a.codigo, a.nota]));
  const erros = r.erros.map((e, i) => ({ ...e, numero: i + 1 }));

  return (
    <div className="flex flex-col gap-12">
      <section className={`${cartao} flex flex-col gap-4 p-8`}>
        <p className="text-sm text-pedra">Nota na prova discursiva</p>
        <p className="flex flex-wrap items-baseline gap-3">
          <span className={titulo.pagina}>{nota(npd)}</span>
          <span className="text-grafite">de {r.config.pontuacaoMaxima}</span>
          <span className={aprovado ? pilula.azul : pilula.erro}>
            {aprovado ? "Acima" : "Abaixo"} do mínimo de {r.config.notaMinima}
          </span>
        </p>
        {r.zeradaMotivo ? (
          <p className={textoApoio}>{MOTIVO_ZERO[r.zeradaMotivo]}</p>
        ) : (
          <p className={`${textoApoio} tabular-nums`}>
            NPD = NC − 6 × NE ÷ TL = {nota(r.nc ?? 0)} − 6 × {r.ne ?? 0} ÷ {r.tl ?? 0} = {nota(npd)}
          </p>
        )}
        {r.terceiraCorrecao && (
          <p className="text-sm text-grafite">
            As duas primeiras bancas divergiram em mais de 25% da nota: houve terceira correção, e valeu a média das duas
            notas mais próximas.
          </p>
        )}
      </section>

      {r.prioridades.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className={titulo.secao}>O que estudar primeiro</h2>
          <ol className="flex flex-col gap-3">
            {r.prioridades.map((p, i) => (
              <li key={i} className={`${cartao} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                <div className="min-w-0">
                  <p className="font-medium">{p.titulo}</p>
                  <p className="text-sm text-grafite">{p.detalhe}</p>
                </div>
                {p.canonico && (
                  <form action={treinarTopicos}>
                    <input type="hidden" name="canonico" value={p.canonico} />
                    <input type="hidden" name="total" value="10" />
                    <BotaoEnviar pendente="Montando o treino…" className={botao.secundario}>
                      Treinar 10 itens
                    </BotaoEnviar>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className={titulo.secao}>Conteúdo</h2>
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {aspectos.map((a, k) => (
            <li key={a.codigo} className="px-5 py-4">
              <details>
                <summary className="flex cursor-pointer list-none items-start gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="text-pedra">{a.codigo}</span> {a.descricao}
                    <span className="mt-1 block text-sm text-pedra">
                      {bancas.map((b, i) => `Banca ${i + 1}: ${nota(notas[i][k])}`).join(" · ")}
                      {usadas.size > 0 && bancas.some((b) => !usadas.has(b.papel)) && " (vale a média das duas mais próximas)"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold">{nota(media.get(a.codigo) ?? 0)}</span>
                    <span className="text-sm text-pedra"> de {nota(a.pontos)}</span>
                  </span>
                </summary>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-grafite">
                  {bancas.map((b, i) => {
                    const j = b.correcao.aspectos.find((x) => x.codigo.trim() === a.codigo)?.justificativa;
                    return j ? (
                      <li key={b.papel}>
                        <span className="font-medium text-tinta">Banca {i + 1}:</span> {j}
                      </li>
                    ) : null;
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        {bancas.map((b, i) => (
          <p key={b.papel} className="text-sm text-grafite">
            <span className="font-medium text-tinta">Banca {i + 1}:</span> {b.correcao.comentario}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={titulo.secao}>
          Língua portuguesa <span className="text-base font-normal text-pedra">({erros.length === 1 ? "1 erro" : `${erros.length} erros`})</span>
        </h2>
        <ol className="rounded-xl border border-borda bg-superficie font-mono text-[13px] leading-7">
          {r.linhas.map((linha, i) => (
            <li key={i} className="flex border-b border-borda last:border-b-0">
              <span className="w-9 shrink-0 border-r border-borda pr-2 text-right text-pedra select-none">{i + 1}</span>
              <span className="min-w-0 flex-1 px-2 break-words whitespace-pre-wrap">
                {segmentosDaLinha(
                  linha,
                  erros.filter((e) => e.linha === i + 1),
                ).map((s, j) =>
                  s.erro === null ? (
                    <span key={j}>{s.texto}</span>
                  ) : (
                    <a
                      key={j}
                      href={`#erro-${s.erro}`}
                      aria-label={`${s.texto} (erro ${s.erro})`}
                      className="text-vermelho underline decoration-wavy underline-offset-4"
                    >
                      {s.texto}
                      <sup className="ml-0.5 font-sans">{s.erro}</sup>
                    </a>
                  ),
                )}
              </span>
            </li>
          ))}
        </ol>
        {erros.length > 0 && (
          <ol className="flex flex-col gap-3">
            {erros.map((e) => (
              <li key={e.id} id={`erro-${e.numero}`} className="scroll-mt-24 text-[15px]">
                <p>
                  <span className="font-semibold">{e.numero}.</span> Linha {e.linha} · {rotuloCategoria(e.categoria)}{" "}
                  <span className="text-pedra">({NOME_TIPO[e.tipo] ?? e.tipo})</span>
                </p>
                <p className="text-grafite">
                  <span className="text-vermelho line-through">{e.trecho}</span> → <span className="text-tinta">{e.correcao}</span>.{" "}
                  {e.explicacao}
                </p>
              </li>
            ))}
          </ol>
        )}
        {(r.detalhes?.erros_descartados ?? 0) > 0 && (
          <p className="text-sm text-pedra">
            {r.detalhes!.erros_descartados} apontamento(s) da revisão foram descartados porque não correspondiam ao texto.
          </p>
        )}
      </section>

      <section>
        <details className={cartao}>
          <summary className="cursor-pointer font-semibold">Padrão de resposta</summary>
          <ul className="mt-4 flex flex-col gap-1 text-[15px]">
            {aspectos.map((a) => (
              <li key={a.codigo}>
                <span className="text-pedra">{a.codigo}</span> {a.descricao} — até {nota(a.pontos)} pontos
              </li>
            ))}
          </ul>
          <p className={`${textoApoio} mt-4 whitespace-pre-line`}>{r.tema.padrao.expectativas}</p>
        </details>
      </section>
    </div>
  );
}
```

- [ ] **Passo 3: Verificar e commitar**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add "src/app" src/components/redacao/andamento.tsx src/components/aviso.tsx src/components/redacao/resultado.tsx
git commit -m "feat: botões com estado de envio e andamento das gerações de IA"
```

---

### Tarefa 4: esqueletos de carregamento e tela de erro

**Arquivos:**
- Criar: `src/components/esqueleto-questao.tsx`, `src/app/(app)/loading.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/sessao/[id]/loading.tsx`, `src/app/(app)/simulado/[id]/loading.tsx`, `src/app/(app)/redacao/[id]/loading.tsx`

- [ ] **Passo 1: Arquivos**

`src/components/esqueleto-questao.tsx`:

```tsx
import { Esqueleto, PaginaCarregando } from "./carregando";

// Formato de uma questão em andamento (treino ou simulado): enunciado, opções e navegação.
export function EsqueletoQuestao({ rotulo, comLateral = false }: { rotulo: string; comLateral?: boolean }) {
  return (
    <PaginaCarregando rotulo={rotulo}>
      <div className={`grid gap-8 ${comLateral ? "lg:grid-cols-[1fr_300px]" : ""}`}>
        <div className="flex flex-col gap-4">
          <Esqueleto className="h-4 w-40" />
          <Esqueleto className="h-5 w-full" />
          <Esqueleto className="h-5 w-full" />
          <Esqueleto className="h-5 w-3/4" />
          <div className="mt-4 flex gap-3">
            <Esqueleto className="h-12 w-32" />
            <Esqueleto className="h-12 w-32" />
          </div>
        </div>
        {comLateral && <Esqueleto className="hidden h-96 rounded-xl lg:block" />}
      </div>
    </PaginaCarregando>
  );
}
```

`src/app/(app)/loading.tsx`:

```tsx
import { Esqueleto, PaginaCarregando } from "@/components/carregando";

// Esqueleto padrão das páginas do app: título, texto e cartões, no formato do conteúdo que vai chegar.
export default function Carregando() {
  return (
    <PaginaCarregando rotulo="Carregando a página…">
      <Esqueleto className="h-10 w-64 max-w-full" />
      <Esqueleto className="h-5 w-[32rem] max-w-full" />
      <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Esqueleto className="h-48 rounded-xl" />
        <Esqueleto className="h-48 rounded-xl" />
      </div>
      <Esqueleto className="h-64 rounded-xl" />
    </PaginaCarregando>
  );
}
```

`src/app/(app)/error.tsx`:

```tsx
"use client";

import { WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";

// Falha ao carregar uma página do app: diz o que houve, sem detalhes técnicos, e oferece tentar de novo.
export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className={`${cartao} flex flex-col items-start gap-4 p-8`}>
      <WarningCircle size={28} className="text-vermelho" aria-hidden />
      <h1 className={titulo.secao}>Não foi possível carregar esta página</h1>
      <p className={`${textoApoio} max-w-[56ch]`}>
        Pode ter sido a conexão ou uma instabilidade momentânea. O que você já respondeu ou escreveu continua salvo.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className={botao.primario}>
          Tentar de novo
        </button>
        <Link href="/" className={botao.texto}>
          Voltar ao início
        </Link>
      </div>
      {error.digest && <p className="text-xs text-pedra">Código do erro: {error.digest}</p>}
    </section>
  );
}
```

`src/app/(app)/sessao/[id]/loading.tsx`:

```tsx
import { EsqueletoQuestao } from "@/components/esqueleto-questao";

export default function Carregando() {
  return <EsqueletoQuestao rotulo="Carregando a sessão…" />;
}
```

`src/app/(app)/simulado/[id]/loading.tsx`:

```tsx
import { EsqueletoQuestao } from "@/components/esqueleto-questao";

export default function Carregando() {
  return <EsqueletoQuestao rotulo="Carregando o simulado…" comLateral />;
}
```

`src/app/(app)/redacao/[id]/loading.tsx`:

```tsx
import { Esqueleto, PaginaCarregando } from "@/components/carregando";

// Formato da redação: proposta e, abaixo, o texto e a folha de 30 linhas.
export default function Carregando() {
  return (
    <PaginaCarregando rotulo="Carregando a redação…">
      <Esqueleto className="h-6 w-40" />
      <Esqueleto className="h-32 rounded-xl" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Esqueleto className="h-80" />
        <Esqueleto className="h-80" />
      </div>
    </PaginaCarregando>
  );
}
```

- [ ] **Passo 2: Verificar e commitar**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add src/components/esqueleto-questao.tsx "src/app/(app)/loading.tsx" "src/app/(app)/error.tsx" "src/app/(app)/sessao/[id]/loading.tsx" "src/app/(app)/simulado/[id]/loading.tsx" "src/app/(app)/redacao/[id]/loading.tsx"
git commit -m "feat: esqueletos de carregamento e tela de erro com nova tentativa"
```

---

### Tarefa 5: andamento nas ações dos componentes de cliente

**Arquivos:**
- Modificar: os oito componentes abaixo

- [ ] **Passo 1: Componentes**

`src/components/sessao/player-treino.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { responder } from "@/app/(app)/sessao/[id]/acoes";
import { Indicador } from "@/components/carregando";
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
  branco: "bg-tinta/5 text-tinta/60 border-transparent",
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
        const { gabarito, justificativa, citacao, fonte, provaOrigem, resultado } = r.dados;
        setCorrigidos((c) => ({
          ...c,
          [item.id]: {
            gabarito,
            justificativa,
            citacao,
            fonte,
            provaOrigem,
            resultado,
            resposta: r.dados.resposta,
            duvida: r.dados.duvida,
          },
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
                  duvida ? "border-transparent bg-marigold-claro text-marigold-tinta" : "border-borda-forte text-tinta/70 hover:bg-realce"
                }`}
              >
                Tenho dúvida
              </button>
              <button type="button" disabled={pendente} onClick={() => marcar("branco")} className={botao.texto}>
                Deixar em branco
              </button>
            </div>
            {pendente && (
              <p role="status" className="flex items-center gap-2 text-sm text-grafite">
                <Indicador />
                Corrigindo…
              </p>
            )}
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
                    c ? COR_MAPA[c.resultado] : "border-borda-forte bg-superficie text-tinta/60"
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

`src/components/sessao/marcar-suspeito.tsx`:

```tsx
"use client";

import { Flag } from "@phosphor-icons/react";
import { useState, useTransition } from "react";
import { marcarComoSuspeito } from "@/app/(app)/sessao/[id]/acoes";
import { Indicador } from "@/components/carregando";
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
        className="rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-[15px] placeholder:text-pedra"
      />
      {estado !== "livre" && <p className="text-sm text-vermelho">{estado}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pendente || !motivo.trim()} aria-busy={pendente} className={botao.contorno}>
          {pendente && <Indicador />}
          {pendente ? "Marcando…" : "Marcar como suspeito"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className={botao.texto}>
          Cancelar
        </button>
      </div>
    </form>
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
import { Indicador } from "@/components/carregando";
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
        {entregando && (
          <p role="status" className="flex items-center gap-2 text-sm text-grafite">
            <Indicador />
            Entregando e corrigindo a prova…
          </p>
        )}
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
              <button type="button" disabled={entregando} aria-busy={entregando} onClick={finalizar} className={botao.primario}>
                {entregando && <Indicador />}
                {entregando ? "Entregando…" : "Entregar"}
              </button>
              <button type="button" disabled={entregando} onClick={() => setConfirmando(false)} className={botao.texto}>
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
import { Indicador } from "@/components/carregando";
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

  const estado = { salvo: "Rascunho salvo", pendente: "Salvando em instantes…", salvando: "Salvando…", erro: "Não salvou" }[salvamento];

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
            <span className={`flex items-center gap-1.5 ${salvamento === "erro" ? "text-vermelho" : "text-pedra"}`}>
              {salvamento === "salvando" && <Indicador tamanho={12} />}
              {estado}
            </span>
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
              <button type="button" onClick={confirmarEntrega} disabled={entregando} aria-busy={entregando} className={botao.primario}>
                {entregando && <Indicador />}
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

`src/components/redacao/conferencia-foto.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmarTranscricao } from "@/app/(app)/redacao/acoes";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";

// Foto ao lado da transcrição: o usuário corrige o que a IA leu errado antes da correção.
export function ConferenciaFoto({
  redacaoId,
  fotos,
  linhasIniciais,
  duvidosas,
  linhasMax,
}: {
  redacaoId: string;
  fotos: string[];
  linhasIniciais: string[];
  duvidosas: number[];
  linhasMax: number;
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState(linhasIniciais.length ? linhasIniciais : [""]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function alterar(i: number, valor: string) {
    setLinhas((ls) => ls.map((l, j) => (j === i ? valor : l)));
  }

  function confirmar() {
    iniciar(async () => {
      const r = await confirmarTranscricao(redacaoId, linhas);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
        {fotos.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage, sem otimização.
          <img key={url} src={url} alt={`Foto ${i + 1} da folha`} className="w-full rounded-lg border border-borda" />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-sm text-grafite">
          Confira cada linha com a foto. Nas linhas marcadas em amarelo, a leitura ficou incerta.
        </p>
        <ol className="flex flex-col gap-1">
          {linhas.map((l, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-sm text-pedra tabular-nums">{i + 1}</span>
              <input
                aria-label={`Linha ${i + 1}`}
                value={l}
                onChange={(e) => alterar(i, e.target.value)}
                className={`min-w-0 flex-1 rounded-lg border px-3 py-1.5 font-mono text-[13px] ${
                  duvidosas.includes(i + 1) ? "border-marigold bg-marigold-claro" : "border-borda-campo bg-superficie"
                }`}
              />
            </li>
          ))}
        </ol>
        {linhas.length < linhasMax && (
          <button type="button" onClick={() => setLinhas((ls) => [...ls, ""])} className={`${botao.texto} self-start`}>
            Adicionar linha
          </button>
        )}
        {erro && (
          <p role="alert" className="text-sm text-vermelho">
            {erro}
          </p>
        )}
        <button type="button" onClick={confirmar} disabled={enviando} aria-busy={enviando} className={`${botao.primario} self-start`}>
          {enviando && <Indicador />}
          {enviando ? "Entregando…" : "Confirmar e entregar para correção"}
        </button>
      </div>
    </div>
  );
}
```

`src/components/redacao/envio-foto.tsx`:

```tsx
"use client";

import { Camera } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarFotos } from "@/app/(app)/redacao/acoes";
import { criarClienteNavegador } from "@/db/supabase/navegador";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";
import { BUCKET_FOTOS, validarFoto } from "@/lib/redacao";

const LADO_MAXIMO = 2000;

// Reduz a foto para no máximo 2000 px no lado maior (JPEG), o bastante para ler a letra e leve para enviar.
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível ler a foto."))), "image/jpeg", 0.85),
  );
}

export function EnvioFoto({ redacaoId, usuarioId }: { redacaoId: string; usuarioId: string }) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // Passo atual do envio (reduzir, enviar, registrar), mostrado no botão: o envio de 2 fotos pode levar vários segundos.
  const [passo, setPasso] = useState("Enviando…");

  function escolher(lista: FileList | null) {
    const escolhidos = Array.from(lista ?? []).slice(0, 2);
    const problema = escolhidos.map(validarFoto).find(Boolean) ?? null;
    setErro(problema);
    setArquivos(problema ? [] : escolhidos);
  }

  function enviar() {
    iniciar(async () => {
      try {
        const db = criarClienteNavegador();
        const caminhos: string[] = [];
        const total = arquivos.length;
        for (const [i, arquivo] of arquivos.entries()) {
          const deQuantas = total > 1 ? ` ${i + 1} de ${total}` : "";
          setPasso(`Reduzindo a foto${deQuantas}…`);
          const reduzida = await reduzirFoto(arquivo);
          setPasso(`Enviando a foto${deQuantas}…`);
          const caminho = `${usuarioId}/${redacaoId}/${Date.now()}-${i + 1}.jpg`;
          const { error } = await db.storage.from(BUCKET_FOTOS).upload(caminho, reduzida, { contentType: "image/jpeg" });
          if (error) throw error;
          caminhos.push(caminho);
        }
        setPasso("Registrando para a transcrição…");
        const r = await registrarFotos(redacaoId, caminhos);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        router.refresh();
      } catch (e) {
        console.error(e);
        setErro("Não foi possível enviar a foto. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={`${botao.secundario} w-fit cursor-pointer has-focus-visible:outline-2`}>
        <Camera size={20} aria-hidden />
        <span>Escolher fotos da folha (até 2)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => escolher(e.target.files)}
          className="sr-only"
        />
      </label>
      {arquivos.length > 0 && <p className="text-sm text-grafite">{arquivos.map((a) => a.name).join(", ")}</p>}
      {erro && (
        <p role="alert" className="text-sm text-vermelho">
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={enviar}
        disabled={arquivos.length === 0 || enviando}
        aria-busy={enviando}
        className={`${botao.contorno} self-start`}
      >
        {enviando && <Indicador />}
        {enviando ? passo : "Enviar para transcrição"}
      </button>
    </div>
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
import { Indicador } from "@/components/carregando";
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

const campo = "w-full rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-[15px] placeholder:text-pedra";

function Passos({ atual }: { atual: Etapa }) {
  const indice = ETAPAS.findIndex((e) => e.id === atual);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Etapas da importação">
      {ETAPAS.map((e, k) => (
        <li
          key={e.id}
          aria-current={k === indice ? "step" : undefined}
          className={`flex items-center gap-2 ${k === indice ? "font-medium text-tinta" : k < indice ? "text-grafite" : "text-pedra"}`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
              k === indice ? "bg-tinta text-papel" : "bg-tinta/5"
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
    <div className="rounded-lg bg-marigold-claro px-4 py-3 text-sm text-marigold-tinta" role="status">
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
                    {pendente && <Indicador />}
                    {pendente ? "Pedindo sugestões à IA…" : "Sugerir tópicos com IA"}
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
                {pendente && <Indicador />}
                {pendente ? "Gravando…" : itens.length === 1 ? "Gravar 1 item" : `Gravar ${itens.length} itens`}
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

`src/components/importar/tema-real.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { importarTema, type EstadoTema } from "@/app/(app)/importar/acoes";
import { Indicador } from "@/components/carregando";
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
      <button type="submit" disabled={enviando} aria-busy={enviando} className={`${botao.contorno} self-start`}>
        {enviando && <Indicador />}
        {enviando ? "Gravando…" : "Gravar tema"}
      </button>
    </form>
  );
}
```

- [ ] **Passo 2: Verificar e commitar**

Run: `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

```bash
git add src/components/sessao src/components/simulado src/components/redacao src/components/importar
git commit -m "feat: andamento nas ações de treino, simulado, redação e importação"
```

---

### Tarefa 6: testes de ponta a ponta

**Arquivos:**
- Modificar: `e2e/geracao.spec.ts`, `e2e/redacao.spec.ts`

- [ ] **Passo 1: Testes**

`e2e/geracao.spec.ts`:

```ts
import { abrirDisciplina, expect, test } from "./fixtures";

// Pedir 30 itens de um tópico que só tem 3 enfileira um job de geração em nome do usuário.
// O worker não roda no E2E (e as chaves de IA estão vazias): o teste para na fila.
// Usa um tópico que nenhum outro teste treina, porque a fila não repete pedido aberto do mesmo tópico.
test("treino maior que o estoque enfileira um pedido de geração", async ({ page, admin, usuarioLogado }) => {
  await page.goto("/treinar");
  const disciplina = await abrirDisciplina(page, "Matemática");
  const topico = disciplina.getByRole("checkbox").last();
  const canonico = await topico.getAttribute("value");
  expect(canonico).toBeTruthy();
  // Pedidos de execuções anteriores ficam pendentes (o worker nunca roda aqui) e bloqueariam o novo.
  const limpeza = await admin.from("jobs").delete().eq("payload->>canonico", canonico!).in("status", ["pendente", "processando"]);
  expect(limpeza.error).toBeNull();
  await topico.check();
  await page.getByLabel("Quantidade", { exact: true }).selectOption("30");
  await page.getByRole("button", { name: "Começar treino" }).click();

  // A sessão começa com o que há; o pedido vai para a fila sem atrasar o estudo.
  await expect(page).toHaveURL(/\/sessao\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Item 1 de 3")).toBeVisible();

  const { data: jobs, error } = await admin
    .from("jobs")
    .select("tipo, status, tentativas, payload")
    .eq("payload->>pedido_por", usuarioLogado.id);
  expect(error).toBeNull();
  expect(jobs).toHaveLength(1);
  expect(jobs![0]).toMatchObject({
    tipo: "gerar_itens",
    status: "pendente",
    tentativas: 0,
    payload: { concurso: "cbmal-2026", canonico, quantidade: 5, pedido_por: usuarioLogado.id },
  });

  // Enquanto o pedido está na fila, Início e Treinar mostram a faixa de andamento.
  await page.goto("/");
  await expect(page.getByText(/Gerando itens para 1 tópico…/)).toBeVisible();
  await page.goto("/treinar");
  await expect(page.getByText(/Gerando itens para 1 tópico…/)).toBeVisible();
});
```

`e2e/redacao.spec.ts`:

```ts
import type { Page } from "@playwright/test";
import { expect, test, type Admin } from "./fixtures";

const ASPECTOS = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas do problema", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas de solução", pontos: 13.5 },
];

// Tema real importado pela função do banco (como a tela de importação faz), com enunciado único por teste.
async function criarTema(admin: Admin, nome: string): Promise<{ id: string; enunciado: string }> {
  const enunciado = `Tema E2E ${nome} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { error } = await admin.rpc("discursiva_importar_temas", {
    p_lote: {
      concurso: "cbmal-2026",
      prova_origem: "Prova E2E",
      temas: [{ enunciado, textos_apoio: [{ titulo: "Texto I", texto: "Dados de apoio.", fonte: "E2E" }], padrao_resposta: { aspectos: ASPECTOS, expectativas: "Expectativas do E2E." } }],
    },
  });
  expect(error).toBeNull();
  const { data } = await admin.from("temas_discursiva").select("id").eq("enunciado", enunciado).single();
  return { id: data!.id, enunciado };
}

async function semEstouroHorizontal(page: Page) {
  const { largura, visivel } = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    visivel: document.documentElement.clientWidth,
  }));
  expect(largura, "largura do conteúdo cabe na tela").toBeLessThanOrEqual(visivel);
}

test("escreve, salva sozinho e entrega a redação para correção", async ({ page, admin, usuarioLogado }) => {
  const tema = await criarTema(admin, "escrita");
  await page.goto("/redacao");
  const cartao = page.getByRole("listitem").filter({ hasText: tema.enunciado });
  await expect(cartao.getByText("Tema real · Prova E2E")).toBeVisible();
  await cartao.getByRole("button", { name: "Escrever sobre este tema" }).click();
  await expect(page).toHaveURL(/\/redacao\/[0-9a-f-]{36}$/);
  const id = page.url().split("/").pop()!;

  await page.getByLabel("Seu texto").fill("Primeira linha do texto.\n\nSegundo parágrafo da redação.");
  await expect(page.getByText("2/30 linhas")).toBeVisible();
  await expect(page.getByText("Rascunho salvo")).toBeVisible({ timeout: 10_000 });
  await page.reload();
  await expect(page.getByLabel("Seu texto")).toHaveValue("Primeira linha do texto.\n\nSegundo parágrafo da redação.");

  await page.getByRole("button", { name: "Entregar para correção" }).click();
  await page.getByRole("button", { name: "Entregar agora" }).click();
  await expect(page.getByText("Banca 1 avaliando o conteúdo")).toBeVisible();
  await expect(page.getByText("Em correção").first()).toBeVisible();

  const { data: r } = await admin.from("redacoes").select("status, linhas, texto").eq("id", id).single();
  expect(r).toEqual({ status: "na_fila", linhas: ["Primeira linha do texto.", "", "Segundo parágrafo da redação."], texto: "Primeira linha do texto.\n\nSegundo parágrafo da redação." });
  const { data: jobs } = await admin.from("jobs").select("tipo, payload").eq("payload->>redacao_id", id);
  expect(jobs).toEqual([{ tipo: "corrigir_redacao", payload: { redacao_id: id, pedido_por: usuarioLogado.id } }]);
});

test.describe("no celular (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("mostra o resultado da redação corrigida e leva ao treino do erro", async ({ page, admin, usuarioLogado }) => {
    const tema = await criarTema(admin, "resultado");
    const banca = (n: number[], comentario: string) => ({
      aspectos: ASPECTOS.map((a, i) => ({ codigo: a.codigo, nota: n[i], justificativa: `Justificativa ${a.codigo}` })),
      fuga_tema: false,
      comentario,
    });
    const { data: red, error } = await admin
      .from("redacoes")
      .insert({
        usuario_id: usuarioLogado.id,
        tema_id: tema.id,
        status: "corrigida",
        linhas: ["O Brasil precisa investir em prevenção.", "Os bombeiros chegou cedo ao local."],
        nc: 22,
        ne: 1,
        tl: 2,
        npd: 19,
        corrigida_em: new Date().toISOString(),
        detalhes: {
          aspectos: ASPECTOS.map((a, i) => ({ ...a, nota: [2.5, 11, 8.5][i] })),
          usadas: ["conteudo_1", "conteudo_2"],
          erros_descartados: 0,
        },
        prioridades: [
          { tipo: "aspecto", codigo: "2.2", titulo: "Aprofunde: Propostas de solução", detalhe: "Você fez 8,5 de 13,5 pontos neste aspecto." },
          { tipo: "erro", categoria: "concordancia", canonico: "portugues/concordancia-verbal-e-nominal", titulo: "Revise concordância", detalhe: "1 erro na redação." },
        ],
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    await admin.from("correcoes_discursiva").insert([
      { redacao_id: red!.id, papel: "conteudo_1", provedor: "anthropic", modelo: "m", resposta: banca([3, 10, 8], "Comentário da banca 1.") },
      { redacao_id: red!.id, papel: "conteudo_2", provedor: "openai", modelo: "m", resposta: banca([2, 12, 9], "Comentário da banca 2.") },
    ]);
    await admin.from("erros_redacao").insert({
      redacao_id: red!.id,
      usuario_id: usuarioLogado.id,
      linha: 2,
      trecho: "bombeiros chegou",
      tipo: "morfossintaxe",
      categoria: "concordancia",
      correcao: "bombeiros chegaram",
      explicacao: "O verbo concorda com o sujeito no plural.",
      canonico: "portugues/concordancia-verbal-e-nominal",
    });

    await page.goto(`/redacao/${red!.id}`);
    await expect(page.getByText("Acima do mínimo de 15")).toBeVisible();
    await expect(page.getByText("NPD = NC − 6 × NE ÷ TL = 22 − 6 × 1 ÷ 2 = 19")).toBeVisible();
    await expect(page.getByText("Banca 1: 10 · Banca 2: 12")).toBeVisible();
    await expect(page.getByText("Comentário da banca 1.")).toBeVisible();
    await expect(page.getByRole("link", { name: "bombeiros chegou (erro 1)" })).toHaveAttribute("href", "#erro-1");
    await expect(page.getByText("O verbo concorda com o sujeito no plural.")).toBeVisible();
    await semEstouroHorizontal(page);

    await page.goto("/redacao");
    const linha = page.getByRole("link").filter({ hasText: tema.enunciado });
    await expect(linha.getByText("Corrigida")).toBeVisible();
    await expect(linha.getByText("19", { exact: true })).toBeVisible();
    await semEstouroHorizontal(page);

    await page.goto(`/redacao/${red!.id}`);
    await page.getByRole("button", { name: "Treinar 10 itens" }).click();
    await expect(page).toHaveURL(/\/sessao\/[0-9a-f-]{36}$/);
  });
});

test("envia a foto, confere a transcrição e entrega", async ({ page, admin, usuarioLogado }) => {
  const tema = await criarTema(admin, "foto");
  const { data: red } = await admin.from("redacoes").insert({ usuario_id: usuarioLogado.id, tema_id: tema.id }).select("id").single();
  const id = red!.id;
  await page.goto(`/redacao/${id}`);

  // PNG 2×2 válido: o navegador reduz e converte para JPEG antes de enviar.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Escolher fotos da folha (até 2)").setInputFiles({ name: "folha.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Enviar para transcrição" }).click();
  await expect(page.getByText("Lendo a foto da folha")).toBeVisible();

  const { data: r1 } = await admin.from("redacoes").select("status, entrada, fotos").eq("id", id).single();
  expect(r1).toMatchObject({ status: "transcrevendo", entrada: "foto" });
  expect(r1!.fotos).toHaveLength(1);
  expect(r1!.fotos[0]).toMatch(new RegExp(`^${usuarioLogado.id}/${id}/\\d+-1\\.jpg$`));
  const { data: arquivos } = await admin.storage.from("redacoes-fotos").list(`${usuarioLogado.id}/${id}`);
  expect(arquivos).toHaveLength(1);

  // O worker não roda no E2E: simulamos a transcrição pronta.
  await admin.from("correcoes_discursiva").insert({
    redacao_id: id,
    papel: "transcricao",
    provedor: "anthropic",
    modelo: "m",
    resposta: { linhas: [{ texto: "Linha um.", ilegivel: false }, { texto: "Linha dios", ilegivel: true }] },
  });
  await admin.from("redacoes").update({ status: "aguardando_confirmacao", linhas: ["Linha um.", "Linha dios"] }).eq("id", id);
  await page.reload();
  await expect(page.getByRole("img", { name: "Foto 1 da folha" })).toBeVisible();
  const linha2 = page.getByLabel("Linha 2");
  await expect(linha2).toHaveValue("Linha dios");
  await expect(linha2).toHaveClass(/bg-marigold-claro/);
  await linha2.fill("Linha dois.");
  await page.getByRole("button", { name: "Confirmar e entregar para correção" }).click();
  await expect(page.getByText("Banca 1 avaliando o conteúdo")).toBeVisible();

  const { data: r2 } = await admin.from("redacoes").select("status, linhas").eq("id", id).single();
  expect(r2).toEqual({ status: "na_fila", linhas: ["Linha um.", "Linha dois."] });
});

test("pedir tema novo mostra o andamento e avisa quando a revisão reprova ou a geração falha", async ({ page, admin, usuarioLogado }) => {
  await page.goto("/redacao");
  await page.getByRole("button", { name: "Gerar tema novo" }).click();
  await expect(page.getByText(/Pedimos um tema novo/)).toBeVisible();
  // Enquanto gera, a página mostra o andamento no lugar do botão, que só volta quando o pedido termina.
  await expect(page.getByText("Gerando um tema novo…")).toBeVisible();
  await expect(page.getByText(/Começou há \d+ s/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar tema novo" })).toHaveCount(0);
  const { data: jobs } = await admin.from("jobs").select("tipo, status, payload").eq("payload->>pedido_por", usuarioLogado.id);
  expect(jobs).toEqual([{ tipo: "gerar_tema", status: "pendente", payload: { concurso: "cbmal-2026", pedido_por: usuarioLogado.id } }]);

  // O worker não roda no E2E: o teste termina o pedido como ele terminaria, sem gravar tema (a revisão reprovou).
  const pedido = admin.from("jobs").update({ status: "concluido" }).eq("payload->>pedido_por", usuarioLogado.id);
  expect((await pedido).error).toBeNull();
  await page.reload();
  await expect(page.getByText(/não passou na revisão e foi descartado/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar tema novo" })).toBeVisible();

  const falha = admin.from("jobs").update({ status: "falhou" }).eq("payload->>pedido_por", usuarioLogado.id);
  expect((await falha).error).toBeNull();
  await page.reload();
  await expect(page.getByText("Não foi possível gerar o último tema. Peça outro.")).toBeVisible();
});
```

- [ ] **Passo 2: Rodar contra o Supabase local**

Com o Supabase local de pé e as migrações até a 0013 aplicadas (veja `docs/testes.md`):

Run: `npm run test:e2e`
Esperado: os 17 testes passam.

Se o Supabase local não puder subir neste ambiente, registre o erro e siga. O CI do PR roda o E2E.

- [ ] **Passo 3: Commit**

```bash
git add e2e/geracao.spec.ts e2e/redacao.spec.ts
git commit -m "test(e2e): andamento da geração de tema e de itens"
```

---

## Validação feita antes deste plano

O código deste plano foi escrito e testado numa cópia à parte:
- **Testes:** 311 unitários e 60 de banco, além de typecheck e lint.
- **E2E:** com o build de produção contra o Supabase local (migrações até a 0013), passaram os 17 testes.
  - **Tema:** o cartão "Gerando um tema novo…" aparece com o tempo decorrido; o botão volta quando o pedido termina; aparecem os avisos de reprovação e de falha.
  - **Itens:** a faixa "Gerando itens para 1 tópico…" aparece no Início e em Treinar.
- **Visual:** capturas em 390 px e 1280 px do cartão de tema, da faixa de itens, do andamento com aviso de demora e do indicador no menu.

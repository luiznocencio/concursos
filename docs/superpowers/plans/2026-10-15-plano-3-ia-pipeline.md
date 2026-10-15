# Plano 3 — IA e pipeline de geração de itens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gerar itens Certo/Errado no estilo Cebraspe com duas IAs (uma gera, a outra julga sem ver o gabarito), deduplicar, gravar no banco com status `aprovado` ou `revisao`, registrar o custo de cada chamada e processar tudo por uma fila de jobs chamada por um worker.

**Architecture:** `src/ai/` define a interface `ProvedorIa` com dois provedores reais (Claude via `@anthropic-ai/sdk`, GPT via `openai`), ambos com saída estruturada validada por Zod v4, e um provedor falso para testes. `src/pipeline/` tem a lógica pura do lote (`gerarLote`) e do job (`executarProximoJob`), que dependem só de interfaces (`RepositorioPipeline`, `FilaJobs`), e por isso são testadas sem rede nem banco. `src/db/repositorios/pipeline.ts` implementa essas interfaces com o Supabase (chave secreta, só no servidor). A migração `0006_pipeline.sql` cria as funções SQL da fila e da gravação atômica do lote. A rota `POST /api/jobs/worker`, protegida por segredo, processa um job por chamada; o `pg_cron` do Supabase a chama a cada minuto.

**Tech Stack:** `@anthropic-ai/sdk` 0.134 (Claude Opus 5.5, `client.beta.messages.parse` + `betaZodOutputFormat`, fallback de recusa no servidor), `openai` 7 (`client.responses.parse` + `zodTextFormat`), Zod v4 (`zod/v4`, já incluso no pacote `zod` 3.25) nos schemas de IA, Supabase (`@supabase/supabase-js` com chave secreta), Vitest, Postgres local para testes de banco.

**Especificação:** `docs/superpowers/specs/2026-10-14-nucleo-simulador-design.md` (§5, §7, §8)

## Global Constraints

- Leia `AGENTS.md`: o Next.js 16 tem APIs novas; consulte `node_modules/next/dist/docs/` antes de escrever código Next.
- Schemas enviados às IAs usam `import { z } from "zod/v4"` (os helpers dos dois SDKs exigem Zod v4) e não usam limites numéricos (`min`, `max`, `int`): quantidade e dificuldade são normalizadas no código. O resto do projeto continua com `zod` (v3).
- Modelo Claude padrão: `claude-opus-5-5`, esforço `high`, `max_tokens: 16000`, `fallbacks: "default"` com o beta `server-side-fallback-2026-07-01`. O modelo e o preço do GPT vêm de variáveis de ambiente (`OPENAI_MODEL`, `OPENAI_PRECO_ENTRADA_USD_MTOK`, `OPENAI_PRECO_SAIDA_USD_MTOK`).
- O validador nunca recebe o gabarito nem a justificativa do gerador.
- Item só fica `aprovado` quando o gabarito do validador concorda com o do gerador **e** os dois são provedores diferentes. Se a validação tiver de cair no mesmo provedor que gerou, todos os itens do lote vão para `revisao` (regra mais estrita que a spec §7, que só pedia o uso do outro provedor).
- Tópicos com canônico em `legislacao-cbmal/` exigem fonte legal; sem ela, o job falha de vez, sem novas tentativas.
- Até 5 itens por lote; janela de 8 artigos da fonte por lote, deslocada a cada rodada.
- Chaves (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `WORKER_SECRET`) só em variáveis de ambiente do servidor. Nada de segredo no repositório.
- Funções SQL do pipeline: sem `DROP`, sem `DELETE ... USING`, pequenas (o MCP do Supabase trava em SQL que julga destrutivo); `EXECUTE` revogado de `public`, `anon` e `authenticated` e concedido a `service_role`.
- Testes automatizados nunca chamam IA real. A única chamada real é o script `npm run ia:lote`, executado manualmente.
- Mensagens de commit terminam com as linhas de atribuição da sessão.

## Estrutura de arquivos

```
src/ai/tipos.ts                      # ProvedorIa, UsoIa, ErroIa
src/ai/custo.ts                      # preços do Claude e cálculo de custo
src/ai/claude.ts                     # provedor Claude
src/ai/openai.ts                     # provedor GPT
src/ai/falso.ts                      # provedor falso para testes
src/core/fontes/dispositivos.ts      # divide uma lei em artigos; janela de artigos
src/core/fontes/manifesto.ts         # schema do editais/<slug>/fontes/fontes.yaml
supabase/migrations/0006_pipeline.sql
src/db/pipeline.dbtest.ts
src/pipeline/hash.ts                 # hash normalizado para deduplicação
src/pipeline/schemas.ts              # formatos de resposta das IAs
src/pipeline/prompts.ts              # prompts versionados e guia da banca
src/pipeline/gerar-lote.ts           # gerar → deduplicar → validar → gravar
src/pipeline/executar-job.ts         # reserva e executa um job da fila
src/pipeline/config.ts               # variáveis de IA e criação dos provedores
src/lib/auth/segredo.ts              # Bearer em tempo constante
src/db/supabase/servico.ts           # cliente Supabase com chave secreta
src/db/repositorios/pipeline.ts      # RepositorioPipeline, FilaJobs, contexto do tópico
src/app/api/jobs/worker/route.ts     # POST do worker
scripts/carregar-fontes.ts, gerar-lote.ts, enfileirar.ts
editais/cbmal-2026/fontes/fontes.yaml
```

---

### Task 1: Camada de IA

**Files:**
- Modify: `package.json` (dependências)
- Create: `src/ai/tipos.ts`, `src/ai/custo.ts`, `src/ai/claude.ts`, `src/ai/openai.ts`, `src/ai/falso.ts`
- Test: `src/ai/custo.test.ts`, `src/ai/falso.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Provedor = "anthropic" | "openai";
  interface UsoIa { provedor: Provedor; modelo: string; tokensEntrada: number; tokensSaida: number; custoUsd: number }
  interface PedidoJson<S extends z.ZodType> { finalidade: string; sistema: string; prompt: string; schema: S; nomeSchema: string }
  interface RespostaJson<T> { dados: T; uso: UsoIa }
  interface ProvedorIa { readonly nome: Provedor; gerarJson<S>(p: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> }
  class ErroIa extends Error { provedor; motivo: "api" | "recusa" | "saida_invalida"; uso?: UsoIa }
  interface PrecoModelo { entradaUsdPorMTok; saidaUsdPorMTok; cacheLeituraUsdPorMTok }
  const PRECOS_CLAUDE: Record<string, PrecoModelo>
  function custoUsd(preco: PrecoModelo, t: { entrada; saida; escritaCache?; leituraCache? }): number
  function criarProvedorClaude(config?: { apiKey?; modelo?; esforco? }): ProvedorIa
  function criarProvedorOpenAI(config: { apiKey?; modelo: string; preco: PrecoModelo }): ProvedorIa
  function criarProvedorFalso(nome: Provedor, respostas: unknown[]): { provedor: ProvedorIa; pedidos: PedidoJson<z.ZodType>[] }
  ```

- [ ] **Step 1: Instalar os SDKs**

```bash
npm install @anthropic-ai/sdk@0.134 openai@7
```

- [ ] **Step 2: Escrever os testes**

Create `src/ai/custo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { custoUsd, PRECOS_CLAUDE } from "./custo";

describe("custoUsd", () => {
  it("cobra entrada e saída pelo preço por milhão", () => {
    expect(custoUsd(PRECOS_CLAUDE["claude-opus-5-5"], { entrada: 1_000_000, saida: 100_000 })).toBeCloseTo(4 + 2, 10);
  });

  it("cobra escrita em cache a 1,25× e leitura pelo preço de cache", () => {
    const preco = PRECOS_CLAUDE["claude-opus-5-5"];
    expect(custoUsd(preco, { entrada: 0, saida: 0, escritaCache: 1_000_000, leituraCache: 1_000_000 })).toBeCloseTo(5 + 0.2, 10);
  });
});
```

Create `src/ai/falso.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { criarProvedorFalso } from "./falso";
import { ErroIa } from "./tipos";

const schema = z.object({ ok: z.boolean() });
const pedido = { finalidade: "teste", sistema: "s", prompt: "p", schema, nomeSchema: "teste" };

describe("provedor falso", () => {
  it("devolve as respostas em ordem, validadas pelo schema", async () => {
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [{ ok: true }]);
    const r = await provedor.gerarJson(pedido);
    expect(r.dados).toEqual({ ok: true });
    expect(r.uso.provedor).toBe("anthropic");
    expect(pedidos).toHaveLength(1);
  });

  it("lança ErroIa de saída inválida quando a resposta não bate com o schema", async () => {
    const { provedor } = criarProvedorFalso("openai", [{ ok: "sim" }]);
    await expect(provedor.gerarJson(pedido)).rejects.toMatchObject({ motivo: "saida_invalida", provedor: "openai" });
  });

  it("repassa erros configurados", async () => {
    const { provedor } = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora do ar")]);
    await expect(provedor.gerarJson(pedido)).rejects.toThrow("fora do ar");
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/ai`
Expected: FAIL (`Cannot find module './custo'` e `'./falso'`).

- [ ] **Step 4: Implementar os tipos, o custo e o provedor falso**

Create `src/ai/tipos.ts`:

```ts
import type { z } from "zod/v4";

export type Provedor = "anthropic" | "openai";

export interface UsoIa {
  provedor: Provedor;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
}

export interface PedidoJson<S extends z.ZodType> {
  finalidade: string;
  sistema: string;
  prompt: string;
  schema: S;
  nomeSchema: string;
}

export interface RespostaJson<T> {
  dados: T;
  uso: UsoIa;
}

export interface ProvedorIa {
  readonly nome: Provedor;
  gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>>;
}

export type MotivoErroIa = "api" | "recusa" | "saida_invalida";

export class ErroIa extends Error {
  constructor(
    public readonly provedor: Provedor,
    public readonly motivo: MotivoErroIa,
    mensagem: string,
    public readonly uso?: UsoIa,
  ) {
    super(mensagem);
    this.name = "ErroIa";
  }
}
```

Create `src/ai/custo.ts`:

```ts
export interface PrecoModelo {
  entradaUsdPorMTok: number;
  saidaUsdPorMTok: number;
  cacheLeituraUsdPorMTok: number;
}

// Preços da API da Anthropic (USD por milhão de tokens). Escrita em cache custa 1,25× a entrada.
export const PRECOS_CLAUDE: Record<string, PrecoModelo> = {
  "claude-opus-5-5": { entradaUsdPorMTok: 4, saidaUsdPorMTok: 20, cacheLeituraUsdPorMTok: 0.2 },
  "claude-sonnet-5-5": { entradaUsdPorMTok: 2, saidaUsdPorMTok: 10, cacheLeituraUsdPorMTok: 0.2 },
  "claude-haiku-5-5": { entradaUsdPorMTok: 0.1, saidaUsdPorMTok: 0.5, cacheLeituraUsdPorMTok: 0.01 },
};

export interface TokensCobrados {
  entrada: number;
  saida: number;
  escritaCache?: number;
  leituraCache?: number;
}

export function custoUsd(preco: PrecoModelo, t: TokensCobrados): number {
  const centavosPorMilhao =
    t.entrada * preco.entradaUsdPorMTok +
    (t.escritaCache ?? 0) * preco.entradaUsdPorMTok * 1.25 +
    (t.leituraCache ?? 0) * preco.cacheLeituraUsdPorMTok +
    t.saida * preco.saidaUsdPorMTok;
  return centavosPorMilhao / 1_000_000;
}
```

Create `src/ai/falso.ts`:

```ts
import type { z } from "zod/v4";
import { ErroIa, type PedidoJson, type Provedor, type ProvedorIa, type RespostaJson } from "./tipos";

export type RespostaFalsa = unknown | ErroIa;

// Provedor para testes: devolve as respostas na ordem dada e registra os pedidos recebidos.
export function criarProvedorFalso(nome: Provedor, respostas: RespostaFalsa[]) {
  const pedidos: PedidoJson<z.ZodType>[] = [];
  const fila = [...respostas];
  const provedor: ProvedorIa = {
    nome,
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      pedidos.push(pedido);
      const proxima = fila.shift();
      if (proxima === undefined) throw new ErroIa(nome, "api", "provedor falso sem respostas");
      if (proxima instanceof ErroIa) throw proxima;
      const r = pedido.schema.safeParse(proxima);
      if (!r.success) throw new ErroIa(nome, "saida_invalida", r.error.message);
      return {
        dados: r.data as z.infer<S>,
        uso: { provedor: nome, modelo: `${nome}-falso`, tokensEntrada: 100, tokensSaida: 50, custoUsd: 0.01 },
      };
    },
  };
  return { provedor, pedidos };
}
```

- [ ] **Step 5: Implementar os provedores reais**

Create `src/ai/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { custoUsd, PRECOS_CLAUDE } from "./custo";
import { ErroIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigClaude {
  apiKey?: string;
  modelo?: string;
  esforco?: "low" | "medium" | "high" | "xhigh" | "max";
}

export function criarProvedorClaude(config: ConfigClaude = {}): ProvedorIa {
  const client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  const modelo = config.modelo ?? "claude-opus-5-5";
  if (!PRECOS_CLAUDE[modelo]) throw new Error(`Preço desconhecido para o modelo ${modelo}`);

  return {
    nome: "anthropic",
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      let resposta;
      try {
        resposta = await client.beta.messages.parse({
          model: modelo,
          max_tokens: 16000,
          // Em recusa por política, a própria API refaz o pedido no modelo de fallback padrão.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: config.esforco ?? "high", format: betaZodOutputFormat(pedido.schema) },
          system: [{ type: "text", text: pedido.sistema, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: pedido.prompt }],
        });
      } catch (e) {
        throw new ErroIa("anthropic", "api", e instanceof Error ? e.message : String(e));
      }

      const u = resposta.usage;
      const preco = PRECOS_CLAUDE[resposta.model] ?? PRECOS_CLAUDE[modelo];
      const uso: UsoIa = {
        provedor: "anthropic",
        modelo: resposta.model,
        tokensEntrada: u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
        tokensSaida: u.output_tokens,
        custoUsd: custoUsd(preco, {
          entrada: u.input_tokens,
          saida: u.output_tokens,
          escritaCache: u.cache_creation_input_tokens ?? 0,
          leituraCache: u.cache_read_input_tokens ?? 0,
        }),
      };

      if (resposta.stop_reason === "refusal") {
        throw new ErroIa("anthropic", "recusa", "O modelo recusou o pedido", uso);
      }
      if (resposta.parsed_output == null) {
        throw new ErroIa("anthropic", "saida_invalida", `Saída fora do schema (stop_reason: ${resposta.stop_reason})`, uso);
      }
      return { dados: resposta.parsed_output as z.infer<S>, uso };
    },
  };
}
```

Create `src/ai/openai.ts`:

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";
import { custoUsd, type PrecoModelo } from "./custo";
import { ErroIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigOpenAI {
  apiKey?: string;
  modelo: string;
  preco: PrecoModelo;
}

export function criarProvedorOpenAI(config: ConfigOpenAI): ProvedorIa {
  const client = new OpenAI(config.apiKey ? { apiKey: config.apiKey } : {});

  return {
    nome: "openai",
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      let resposta;
      try {
        resposta = await client.responses.parse({
          model: config.modelo,
          instructions: pedido.sistema,
          input: pedido.prompt,
          text: { format: zodTextFormat(pedido.schema, pedido.nomeSchema) },
        });
      } catch (e) {
        throw new ErroIa("openai", "api", e instanceof Error ? e.message : String(e));
      }

      const entrada = resposta.usage?.input_tokens ?? 0;
      const saida = resposta.usage?.output_tokens ?? 0;
      const uso: UsoIa = {
        provedor: "openai",
        modelo: config.modelo,
        tokensEntrada: entrada,
        tokensSaida: saida,
        custoUsd: custoUsd(config.preco, { entrada, saida }),
      };
      if (resposta.output_parsed == null) {
        throw new ErroIa("openai", "saida_invalida", `Saída fora do schema (status: ${resposta.status})`, uso);
      }
      return { dados: resposta.output_parsed as z.infer<S>, uso };
    },
  };
}
```

- [ ] **Step 6: Rodar testes, tipos e lint**

Run: `npx vitest run src/ai && npm run typecheck && npm run lint`
Expected: 5 testes PASS; sem erros. O typecheck é o que garante que os provedores reais batem com os SDKs instalados.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ai): provedores Claude e GPT com saída estruturada e custo"
```

---

### Task 2: Fontes legais

**Files:**
- Create: `src/core/fontes/dispositivos.ts`, `src/core/fontes/manifesto.ts`
- Test: `src/core/fontes/dispositivos.test.ts`, `src/core/fontes/manifesto.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Dispositivo { referencia: string; texto: string }   // referencia: "art. 1", "art. 2-A"
  function dividirEmArtigos(texto: string): Dispositivo[]
  function janelaDeDispositivos(ds: Dispositivo[], rodada: number, tamanho: number): Dispositivo[]
  function parseManifestoFontes(texto: string): ManifestoFontes  // { fontes: [{ slug, tipo, titulo, url_oficial, arquivo, canonicos }] }
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/fontes/dispositivos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dividirEmArtigos, janelaDeDispositivos } from "./dispositivos";

const LEI = `LEI Nº 1, DE 2000
Dispõe sobre algo.
Art. 1º Esta lei regula o serviço.
Parágrafo único. Aplica-se a todos.
Art. 2º São deveres:
I - zelar;
II - cumprir.
Art. 2º-A Incluído depois.
Art. 10. Revogam-se as disposições em contrário.`;

describe("dividirEmArtigos", () => {
  it("separa os artigos com parágrafos e incisos", () => {
    const artigos = dividirEmArtigos(LEI);
    expect(artigos.map((a) => a.referencia)).toEqual(["art. 1", "art. 2", "art. 2-A", "art. 10"]);
    expect(artigos[0].texto).toBe("Art. 1º Esta lei regula o serviço.\nParágrafo único. Aplica-se a todos.");
    expect(artigos[1].texto).toContain("II - cumprir.");
  });

  it("ignora o preâmbulo e referências repetidas", () => {
    const artigos = dividirEmArtigos(`${LEI}\nArt. 1º Texto repetido de outra lei citada.`);
    expect(artigos).toHaveLength(4);
    expect(artigos[0].texto).not.toContain("LEI Nº");
  });
});

describe("janelaDeDispositivos", () => {
  const ds = Array.from({ length: 10 }, (_, i) => ({ referencia: `art. ${i + 1}`, texto: "" }));

  it("devolve tudo quando cabe na janela", () => {
    expect(janelaDeDispositivos(ds.slice(0, 3), 5, 8)).toHaveLength(3);
  });

  it("desloca a janela a cada rodada, de forma circular", () => {
    expect(janelaDeDispositivos(ds, 0, 4).map((d) => d.referencia)).toEqual(["art. 1", "art. 2", "art. 3", "art. 4"]);
    expect(janelaDeDispositivos(ds, 2, 4).map((d) => d.referencia)).toEqual(["art. 9", "art. 10", "art. 1", "art. 2"]);
  });
});
```

Create `src/core/fontes/manifesto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseManifestoFontes } from "./manifesto";

const valido = `
fontes:
  - slug: lei-5346-1992
    tipo: lei
    titulo: Lei Estadual nº 5.346/1992
    arquivo: lei-5346-1992.txt
    canonicos: [legislacao-cbmal/lei-5346-1992-estatuto]
`;

describe("parseManifestoFontes", () => {
  it("aceita um manifesto válido e preenche url_oficial nula", () => {
    expect(parseManifestoFontes(valido).fontes[0]).toMatchObject({ slug: "lei-5346-1992", url_oficial: null });
  });

  it("aponta o campo inválido", () => {
    expect(() => parseManifestoFontes(valido.replace("lei-5346-1992.txt", "lei.pdf"))).toThrow(
      "fontes.0.arquivo: arquivo deve ser um .txt na pasta fontes/",
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/fontes`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

Create `src/core/fontes/dispositivos.ts`:

```ts
export interface Dispositivo {
  referencia: string;
  texto: string;
}

// "Art. 1º", "Art. 12.", "Art. 31-A" no início de uma linha abrem um novo artigo.
const INICIO_ARTIGO = /^\s*Art\.?\s*(\d+)\s*[º°o]?\s*(-\s*[A-Z])?/i;

export function dividirEmArtigos(texto: string): Dispositivo[] {
  const artigos: Dispositivo[] = [];
  let atual: { referencia: string; linhas: string[] } | null = null;
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(INICIO_ARTIGO);
    if (m) {
      if (atual) artigos.push({ referencia: atual.referencia, texto: atual.linhas.join("\n").trim() });
      const sufixo = m[2] ? `-${m[2].replace(/[\s-]/g, "").toUpperCase()}` : "";
      atual = { referencia: `art. ${Number(m[1])}${sufixo}`, linhas: [linha.trim()] };
    } else if (atual && linha.trim()) {
      atual.linhas.push(linha.trim());
    }
  }
  if (atual) artigos.push({ referencia: atual.referencia, texto: atual.linhas.join("\n").trim() });

  const vistos = new Set<string>();
  return artigos.filter((a) => (vistos.has(a.referencia) ? false : (vistos.add(a.referencia), true)));
}

// Janela circular de artigos consecutivos; a rodada desloca a janela para variar o conteúdo coberto.
export function janelaDeDispositivos(dispositivos: Dispositivo[], rodada: number, tamanho: number): Dispositivo[] {
  if (dispositivos.length <= tamanho) return dispositivos;
  const inicio = (rodada * tamanho) % dispositivos.length;
  return Array.from({ length: tamanho }, (_, i) => dispositivos[(inicio + i) % dispositivos.length]);
}
```

Create `src/core/fontes/manifesto.ts`:

```ts
import { parse } from "yaml";
import { z } from "zod";

const slugCanonico = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)+$/, "slug canônico inválido");

export const manifestoFontesSchema = z.object({
  fontes: z
    .array(
      z.object({
        slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido"),
        tipo: z.enum(["lei", "decreto", "constituicao", "conceito"]),
        titulo: z.string().min(1),
        url_oficial: z.string().url().nullable().default(null),
        arquivo: z.string().regex(/^[\w.-]+\.txt$/, "arquivo deve ser um .txt na pasta fontes/"),
        canonicos: z.array(slugCanonico).min(1),
      }),
    )
    .min(1),
});

export type ManifestoFontes = z.infer<typeof manifestoFontesSchema>;

export function parseManifestoFontes(texto: string): ManifestoFontes {
  const r = manifestoFontesSchema.safeParse(parse(texto));
  if (!r.success) {
    throw new Error(`fontes.yaml inválido:\n${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n")}`);
  }
  return r.data;
}
```

- [ ] **Step 4: Rodar e confirmar que `core/` continua sem I/O**

Run: `npx vitest run src/core/fontes && npm run typecheck && npm run lint && grep -rnE "from \"(node:)?(fs|path|http|https)\"" src/core --include=*.ts | grep -v "\.test\.ts" | grep -v __fixtures__`
Expected: 6 testes PASS; o `grep` final não imprime nada.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(core): divisão de leis em artigos e manifesto de fontes"
```

---

### Task 3: Migração da fila de jobs e da gravação de lotes

**Files:**
- Create: `supabase/migrations/0006_pipeline.sql`
- Test: `src/db/pipeline.dbtest.ts`

**Interfaces:**
- Produces (funções SQL, executáveis só por `service_role`):
  - `jobs_enfileirar_geracao(p_concurso text, p_canonico text, p_quantidade int) returns uuid` — reaproveita o job pendente ou em processamento do mesmo tópico
  - `jobs_reservar() returns setof jobs` — pega o pendente mais antigo vencido, com `for update skip locked`, e soma uma tentativa
  - `jobs_concluir(p_id uuid)`; `jobs_falhar(p_id uuid, p_erro text, p_max_tentativas int)` — volta à fila com espera de tentativas² minutos ou marca `falhou`
  - `ia_registrar_uso(p_uso jsonb)`; `itens_registrar_lote(p_lote jsonb) returns int` — grava texto-base, itens (ignora hash repetido) e tópicos
  - coluna `fontes.canonicos text[]`

- [ ] **Step 1: Escrever os testes de banco**

Create `src/db/pipeline.dbtest.ts`:

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

beforeAll(async () => {
  ({ client, destruir } = await criarBancoDeTeste());
  await client.query(`
    insert into public.bancas (slug, nome) values ('cebraspe', 'Cebraspe');
    insert into public.topicos_canonicos (slug, titulo) values ('portugues/crase', 'Crase'), ('portugues/regencia', 'Regência');
    insert into public.fontes (slug, tipo, titulo, canonicos) values ('lei-x', 'lei', 'Lei X', array['legislacao/lei-x']);
  `);
});

afterAll(async () => {
  await destruir();
});

beforeEach(async () => {
  await client.query("delete from public.jobs");
});

describe("fila de jobs", () => {
  it("enfileira uma geração e não duplica enquanto ela estiver pendente", async () => {
    const a = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const b = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const c = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/regencia', 5)");
    expect(b).toBe(a);
    expect(c).not.toBe(a);
    expect(await valor<string>("select payload->>'quantidade' from public.jobs where id = $1", [a])).toBe("5");
  });

  it("reserva o job mais antigo, marca como processando e conta a tentativa", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    const r = await client.query("select * from public.jobs_reservar()");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ id, status: "processando", tentativas: 1 });
    expect((await client.query("select * from public.jobs_reservar()")).rows).toHaveLength(0);
  });

  it("devolve à fila com espera depois de uma falha e marca como falhou no limite", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_falhar($1, 'erro 1', 2)", [id]);
    let job = (await client.query("select status, erro, executar_apos > now() as adiado from public.jobs where id = $1", [id])).rows[0];
    expect(job).toEqual({ status: "pendente", erro: "erro 1", adiado: true });

    await client.query("update public.jobs set executar_apos = now() where id = $1", [id]);
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_falhar($1, 'erro 2', 2)", [id]);
    job = (await client.query("select status, erro from public.jobs where id = $1", [id])).rows[0];
    expect(job).toEqual({ status: "falhou", erro: "erro 2" });
  });

  it("conclui o job", async () => {
    const id = await valor<string>("select public.jobs_enfileirar_geracao('c1', 'portugues/crase', 5)");
    await client.query("select * from public.jobs_reservar()");
    await client.query("select public.jobs_concluir($1)", [id]);
    expect(await valor<string>("select status from public.jobs where id = $1", [id])).toBe("concluido");
  });
});

describe("itens_registrar_lote", () => {
  const lote = (hashes: string[]) => ({
    banca: "cebraspe",
    formato: "certo_errado",
    origem: "ia",
    texto_base: "Texto de apoio.",
    fonte: "lei-x",
    itens: hashes.map((h, i) => ({
      enunciado: `Item ${h}`,
      gabarito: i % 2 ? "E" : "C",
      justificativa: "Porque sim.",
      citacao: "art. 1",
      dificuldade: 2,
      hash: h,
      status: "aprovado",
      validacao: { concordancia: true },
      canonicos: ["portugues/crase"],
    })),
  });

  it("grava itens, texto-base, fonte e tópicos, ignorando hashes repetidos", async () => {
    expect(await valor<number>("select public.itens_registrar_lote($1)", [lote(["h1", "h2"])])).toBe(2);
    expect(await valor<number>("select public.itens_registrar_lote($1)", [lote(["h2", "h3"])])).toBe(1);
    expect(await valor<number>("select count(*)::int from public.itens")).toBe(3);
    expect(await valor<number>("select count(*)::int from public.item_topicos")).toBe(3);
    expect(await valor<number>("select count(*)::int from public.itens where texto_base_id is not null and fonte_id is not null")).toBe(3);
  });

  it("recusa banca desconhecida", async () => {
    await expect(client.query("select public.itens_registrar_lote($1)", [{ ...lote(["h9"]), banca: "x" }])).rejects.toThrow(
      /banca desconhecida: x/,
    );
  });
});

describe("uso de IA e permissões", () => {
  it("registra uso com job opcional", async () => {
    await client.query("select public.ia_registrar_uso($1)", [
      { provedor: "anthropic", modelo: "m", finalidade: "gerar", tokens_entrada: 10, tokens_saida: 5, custo_usd: 0.001, job_id: null },
    ]);
    expect(await valor<string>("select custo_usd::text from public.ai_usage")).toBe("0.001000");
  });

  it("usuários da API não executam as funções do pipeline", async () => {
    await expect(
      comoUsuario(client, "00000000-0000-0000-0000-00000000000a", () => client.query("select * from public.jobs_reservar()")),
    ).rejects.toThrow(/permission denied for function jobs_reservar/);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npm run db:test:start && npm run test:db`
Expected: FAIL nos testes de `pipeline.dbtest.ts` (`function public.jobs_enfileirar_geracao ... does not exist`).

- [ ] **Step 3: Escrever a migração**

Create `supabase/migrations/0006_pipeline.sql`:

```sql
-- Fila de jobs, gravação de lotes de itens e registro de uso de IA.
-- Funções pequenas e sem apagar objetos: o MCP do Supabase pede confirmação manual
-- (que não chega numa sessão remota) para SQL que julga destrutivo.

alter table public.fontes add column canonicos text[] not null default '{}';

create or replace function public.jobs_enfileirar_geracao(p_concurso text, p_canonico text, p_quantidade integer)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.jobs
  where tipo = 'gerar_itens' and status in ('pendente', 'processando')
    and payload->>'canonico' = p_canonico and payload->>'concurso' = p_concurso
  limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into public.jobs (tipo, payload)
  values ('gerar_itens', jsonb_build_object('concurso', p_concurso, 'canonico', p_canonico, 'quantidade', p_quantidade))
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.jobs_reservar()
returns setof public.jobs
language sql
set search_path = ''
as $$
  update public.jobs set status = 'processando', tentativas = tentativas + 1, atualizado_em = now()
  where id = (
    select id from public.jobs
    where status = 'pendente' and executar_apos <= now()
    order by executar_apos
    limit 1
    for update skip locked
  )
  returning *;
$$;

create or replace function public.jobs_concluir(p_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.jobs set status = 'concluido', erro = null, atualizado_em = now() where id = p_id;
$$;

-- Volta o job para a fila com espera crescente (1, 4, 9 minutos...) ou marca como falho
-- depois de p_max_tentativas.
create or replace function public.jobs_falhar(p_id uuid, p_erro text, p_max_tentativas integer)
returns void
language sql
set search_path = ''
as $$
  update public.jobs set
    status = case when tentativas >= p_max_tentativas then 'falhou' else 'pendente' end,
    erro = p_erro,
    executar_apos = now() + make_interval(mins => tentativas * tentativas),
    atualizado_em = now()
  where id = p_id;
$$;

create or replace function public.ia_registrar_uso(p_uso jsonb)
returns void
language sql
set search_path = ''
as $$
  insert into public.ai_usage (provedor, modelo, finalidade, tokens_entrada, tokens_saida, custo_usd, job_id)
  values (
    p_uso->>'provedor', p_uso->>'modelo', p_uso->>'finalidade',
    (p_uso->>'tokens_entrada')::integer, (p_uso->>'tokens_saida')::integer,
    (p_uso->>'custo_usd')::numeric, nullif(p_uso->>'job_id', '')::uuid
  );
$$;

-- Grava um lote: texto-base opcional, itens (ignorando hashes já existentes) e seus tópicos.
-- Devolve quantos itens novos foram gravados.
create or replace function public.itens_registrar_lote(p_lote jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_texto uuid;
  v_item uuid;
  v_fonte uuid;
  v_gravados integer := 0;
  i jsonb;
begin
  select id into v_banca from public.bancas where slug = p_lote->>'banca';
  if v_banca is null then
    raise exception 'banca desconhecida: %', p_lote->>'banca';
  end if;

  if nullif(p_lote->>'texto_base', '') is not null then
    insert into public.textos_base (conteudo, origem) values (p_lote->>'texto_base', p_lote->>'origem')
    returning id into v_texto;
  end if;

  select id into v_fonte from public.fontes where slug = p_lote->>'fonte';

  for i in select value from jsonb_array_elements(p_lote->'itens') loop
    v_item := null;
    insert into public.itens (banca_id, formato, texto_base_id, enunciado, gabarito, justificativa, citacao,
                              fonte_id, origem, status, dificuldade, hash_normalizado, validacao)
    values (
      v_banca, p_lote->>'formato', v_texto, i->>'enunciado', i->>'gabarito', i->>'justificativa',
      nullif(i->>'citacao', ''), v_fonte, p_lote->>'origem', i->>'status',
      (i->>'dificuldade')::smallint, i->>'hash', coalesce(i->'validacao', '{}')
    )
    on conflict (hash_normalizado) do nothing
    returning id into v_item;

    if v_item is not null then
      v_gravados := v_gravados + 1;
      insert into public.item_topicos (item_id, topico_canonico_id)
      select v_item, tc.id from public.topicos_canonicos tc
      where tc.slug in (select jsonb_array_elements_text(i->'canonicos'));
    end if;
  end loop;

  return v_gravados;
end
$$;

revoke all on function public.jobs_enfileirar_geracao(text, text, integer) from public, anon, authenticated;
revoke all on function public.jobs_reservar() from public, anon, authenticated;
revoke all on function public.jobs_concluir(uuid) from public, anon, authenticated;
revoke all on function public.jobs_falhar(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.ia_registrar_uso(jsonb) from public, anon, authenticated;
revoke all on function public.itens_registrar_lote(jsonb) from public, anon, authenticated;
grant execute on function public.jobs_enfileirar_geracao(text, text, integer) to service_role;
grant execute on function public.jobs_reservar() to service_role;
grant execute on function public.jobs_concluir(uuid) to service_role;
grant execute on function public.jobs_falhar(uuid, text, integer) to service_role;
grant execute on function public.ia_registrar_uso(jsonb) to service_role;
grant execute on function public.itens_registrar_lote(jsonb) to service_role;
```

- [ ] **Step 4: Rodar as duas suítes**

Run: `npm run test:db && npm test`
Expected: 24 testes de banco PASS (16 anteriores e 8 novos); suíte unitária PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): fila de jobs, gravação de lotes e registro de uso de IA"
```

---

### Task 4: Aplicar a migração no Supabase e atualizar os tipos

Feita pelo controlador da execução, que tem as ferramentas MCP do Supabase (projeto `gmcjgtpamdhqpclqxtvg`).

**Files:**
- Modify: `src/db/types.ts` (regenerado)

- [ ] **Step 1: Aplicar a `0006_pipeline.sql`**

Chame `apply_migration` com `name: "0006_pipeline"` e o conteúdo do arquivo. Se a chamada travar (tempo esgotado), confira em `supabase_migrations.schema_migrations` se ela entrou; se não, aplique o mesmo SQL em partes com `execute_sql` (o `alter table`, depois uma função por chamada, depois os `revoke`/`grant`) e registre a migração com `insert into supabase_migrations.schema_migrations (version, name) values ('<AAAAMMDDHHMMSS>', '0006_pipeline')`.

- [ ] **Step 2: Conferir as permissões**

```sql
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as service_role
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like any (array['jobs_%', 'itens_registrar_lote', 'ia_registrar_uso']);
```

Expected: 6 linhas, `authenticated = false` e `service_role = true` em todas.

- [ ] **Step 3: Regenerar os tipos**

Chame `generate_typescript_types` e grave em `src/db/types.ts`, mantendo o comentário de cabeçalho e removendo as entradas `_teste_mcp*` de `Functions`.

- [ ] **Step 4: Typecheck e commit**

Run: `npm run typecheck`

```bash
git add src/db/types.ts
git commit -m "feat(db): tipos com as funções do pipeline"
```

---

### Task 5: Prompts, formatos de resposta e deduplicação

**Files:**
- Create: `src/pipeline/hash.ts`, `src/pipeline/schemas.ts`, `src/pipeline/prompts.ts`
- Test: `src/pipeline/hash.test.ts`, `src/pipeline/prompts.test.ts`

**Interfaces:**
- Consumes: `Dispositivo` (Task 2)
- Produces:
  ```ts
  function normalizarTexto(texto: string): string
  function hashNormalizado(enunciado: string, textoBase: string | null): string   // sha256 hex
  const loteGeradoSchema, julgamentosSchema   // zod/v4
  const PROMPT_VERSAO: string; const GUIA_ESTILO: Record<string, string>
  const SISTEMA_GERADOR: string; const SISTEMA_VALIDADOR: string
  interface ContextoTopico { canonico: string; disciplina: string; programa: string }
  function promptGeracao(p: { banca; topico: ContextoTopico; quantidade; fonte: { titulo; dispositivos } | null; exemplos: { enunciado; gabarito }[] }): string
  function promptValidacao(p: { topico: ContextoTopico; textoBase: string | null; enunciados: string[]; fonte }): string
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/pipeline/hash.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashNormalizado, normalizarTexto } from "./hash";

describe("normalizarTexto", () => {
  it("ignora acentos, caixa, pontuação e espaços", () => {
    expect(normalizarTexto("  A crase é OBRIGATÓRIA, nesse caso!  ")).toBe("a crase e obrigatoria nesse caso");
  });
});

describe("hashNormalizado", () => {
  it("é igual para variações irrelevantes do mesmo item", () => {
    expect(hashNormalizado("A crase é obrigatória.", null)).toBe(hashNormalizado("a crase e obrigatoria", null));
  });

  it("diferencia o mesmo enunciado em textos-base diferentes", () => {
    expect(hashNormalizado("O texto é narrativo.", "Texto A")).not.toBe(hashNormalizado("O texto é narrativo.", "Texto B"));
  });
});
```

Create `src/pipeline/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { promptGeracao, promptValidacao } from "./prompts";

const topico = { canonico: "legislacao-cbmal/lei-x", disciplina: "Legislação", programa: "1 Lei X" };
const fonte = { titulo: "Lei X", dispositivos: [{ referencia: "art. 1", texto: "Art. 1º Texto da lei." }] };

describe("promptGeracao", () => {
  it("inclui o guia da banca, o tópico, a quantidade e o trecho legal", () => {
    const p = promptGeracao({ banca: "cebraspe", topico, quantidade: 5, fonte, exemplos: [] });
    expect(p).toContain("CERTA (C) ou ERRADA (E)");
    expect(p).toContain("Tópico do edital: 1 Lei X");
    expect(p).toContain("Escreva 5 itens");
    expect(p).toContain('<fonte titulo="Lei X">\nArt. 1º Texto da lei.\n</fonte>');
    expect(p).toContain("exclusivamente no trecho legal");
  });

  it("inclui exemplos reais quando existem e dispensa fonte em temas conceituais", () => {
    const p = promptGeracao({
      banca: "cebraspe",
      topico: { ...topico, programa: "5.7 Crase" },
      quantidade: 3,
      fonte: null,
      exemplos: [{ enunciado: "Exemplo real.", gabarito: "C" }],
    });
    expect(p).toContain("- (C) Exemplo real.");
    expect(p).not.toContain("<fonte");
  });
});

describe("promptValidacao", () => {
  it("numera os itens a partir de zero e não revela gabaritos", () => {
    const p = promptValidacao({ topico, textoBase: "Caso.", enunciados: ["Primeiro.", "Segundo."], fonte });
    expect(p).toContain("0. Primeiro.\n1. Segundo.");
    expect(p).toContain("Texto-base:\nCaso.");
    expect(p).not.toMatch(/gabarito: [CE]/);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/pipeline`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

Create `src/pipeline/hash.ts`:

```ts
import { createHash } from "node:crypto";

// Remove acentos, pontuação, caixa e espaços extras para que pequenas variações não escapem da deduplicação.
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function hashNormalizado(enunciado: string, textoBase: string | null): string {
  const base = `${normalizarTexto(textoBase ?? "")}|${normalizarTexto(enunciado)}`;
  return createHash("sha256").update(base).digest("hex");
}
```

Create `src/pipeline/schemas.ts`:

```ts
import { z } from "zod/v4";

// Schemas simples (sem limites numéricos) para caber nas saídas estruturadas dos dois provedores.
export const loteGeradoSchema = z.object({
  texto_base: z.string().nullable(),
  itens: z.array(
    z.object({
      enunciado: z.string(),
      gabarito: z.enum(["C", "E"]),
      justificativa: z.string(),
      citacao: z.string().nullable(),
      dificuldade: z.number(),
    }),
  ),
});
export type LoteGerado = z.infer<typeof loteGeradoSchema>;

export const julgamentosSchema = z.object({
  julgamentos: z.array(
    z.object({
      indice: z.number(),
      gabarito: z.enum(["C", "E"]),
      justificativa: z.string(),
    }),
  ),
});
export type Julgamentos = z.infer<typeof julgamentosSchema>;
```

Create `src/pipeline/prompts.ts`:

```ts
import type { Dispositivo } from "../core/fontes/dispositivos";

export const PROMPT_VERSAO = "2026-10-15.1";

export const GUIA_ESTILO: Record<string, string> = {
  cebraspe: `Itens no estilo Cebraspe (CESPE):
- Cada item é uma afirmação para julgar como CERTA (C) ou ERRADA (E). Não há alternativas.
- Itens podem vir agrupados sob um texto-base ou comando ("Julgue os itens a seguir, relativos a ...").
- Itens errados costumam trocar um único detalhe decisivo: prazo, quantidade, competência, exceção, generalização indevida ("sempre", "nunca", "exclusivamente"), inversão de causa e consequência ou de regra e exceção.
- Itens certos também podem parecer suspeitos: paráfrases fiéis da lei, exceções verdadeiras, conclusões corretas de raciocínio.
- A redação é formal, impessoal e precisa; um item tem uma única ideia julgável.
- Equilibre o gabarito: não deixe todos os itens com a mesma resposta.`,
};

export const SISTEMA_GERADOR = `Você é um elaborador experiente de questões de concursos públicos brasileiros.
Escreve itens inéditos, corretos e inequívocos, fiéis ao programa do edital e ao estilo da banca.
Nunca invente conteúdo de lei: quando um trecho legal for fornecido, use apenas o que está nele e cite o dispositivo exato.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_VALIDADOR = `Você é um revisor rigoroso de gabaritos de concursos públicos brasileiros.
Julgue cada item de forma independente, como um candidato muito bem preparado, e justifique com precisão.
Quando um trecho legal for fornecido, ele é a referência: julgue pelo que está escrito nele.
Responda somente no formato estruturado pedido.`;

export interface ContextoTopico {
  canonico: string;
  disciplina: string;
  programa: string;
}

function blocoFonte(fonte: { titulo: string; dispositivos: Dispositivo[] } | null): string {
  if (!fonte) return "";
  const texto = fonte.dispositivos.map((d) => d.texto).join("\n\n");
  return `\n\n<fonte titulo="${fonte.titulo}">\n${texto}\n</fonte>`;
}

export function promptGeracao(p: {
  banca: string;
  topico: ContextoTopico;
  quantidade: number;
  fonte: { titulo: string; dispositivos: Dispositivo[] } | null;
  exemplos: { enunciado: string; gabarito: string }[];
}): string {
  const guia = GUIA_ESTILO[p.banca] ?? "";
  const exemplos = p.exemplos.length
    ? `\n\nItens reais da banca sobre o mesmo assunto, só como referência de estilo (não os copie):\n${p.exemplos
        .map((e) => `- (${e.gabarito}) ${e.enunciado}`)
        .join("\n")}`
    : "";
  const instrucaoFonte = p.fonte
    ? "Baseie todos os itens exclusivamente no trecho legal abaixo e preencha `citacao` com o dispositivo (ex.: \"Lei 5.346/1992, art. 31, § 2º\")."
    : "Preencha `citacao` com o conceito ou a referência doutrinária usada, ou null se não houver.";

  return `${guia}

Disciplina: ${p.topico.disciplina}
Tópico do edital: ${p.topico.programa}

Escreva ${p.quantidade} itens inéditos sobre esse tópico.
- Use \`texto_base\` quando os itens dependerem de um texto, caso, tabela ou comando comum; senão, null.
- \`justificativa\` explica por que o item está certo ou errado, apontando o detalhe decisivo.
- \`dificuldade\`: 1 (fácil), 2 (média) ou 3 (difícil); varie entre os itens.
- ${instrucaoFonte}${exemplos}${blocoFonte(p.fonte)}`;
}

export function promptValidacao(p: {
  topico: ContextoTopico;
  textoBase: string | null;
  enunciados: string[];
  fonte: { titulo: string; dispositivos: Dispositivo[] } | null;
}): string {
  const texto = p.textoBase ? `\n\nTexto-base:\n${p.textoBase}` : "";
  const itens = p.enunciados.map((e, i) => `${i}. ${e}`).join("\n");
  return `Disciplina: ${p.topico.disciplina}
Tópico do edital: ${p.topico.programa}

Julgue cada item como C (certo) ou E (errado). Devolva um julgamento por item, com o mesmo \`indice\` da lista, e uma justificativa curta que aponte o fundamento.${texto}

Itens:
${itens}${blocoFonte(p.fonte)}`;
}
```

- [ ] **Step 4: Rodar, typecheck, lint e commit**

Run: `npx vitest run src/pipeline && npm run typecheck && npm run lint`
Expected: 6 testes PASS.

```bash
git add -A
git commit -m "feat(pipeline): prompts versionados, formatos de resposta e hash de deduplicação"
```

---

### Task 6: Geração e validação de um lote

**Files:**
- Create: `src/pipeline/gerar-lote.ts`
- Test: `src/pipeline/gerar-lote.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 2 e 5
- Produces:
  ```ts
  const MAX_ITENS_POR_LOTE = 5; const TAMANHO_JANELA_FONTE = 8;
  interface FonteLegal { slug; titulo; dispositivos: Dispositivo[] }
  interface LoteParaGravar { banca; formato: "certo_errado"; origem: "ia"; texto_base; fonte; itens: ItemParaGravar[] }
  interface RepositorioPipeline {
    hashesExistentes(hashes: string[]): Promise<Set<string>>;
    exemplosReais(canonico: string, limite: number): Promise<{ enunciado: string; gabarito: string }[]>;
    registrarLote(lote: LoteParaGravar): Promise<number>;
    registrarUso(uso: UsoIa, finalidade: string, jobId: string | null): Promise<void>;
  }
  interface DepsPipeline { provedores: [ProvedorIa, ProvedorIa]; repo: RepositorioPipeline; jobId: string | null }
  interface EntradaLote { banca; topico: ContextoTopico; quantidade; rodada; fonte: FonteLegal | null }
  interface ResumoLote { gerados; duplicados; aprovados; revisao; gravados; custoUsd; gerador: Provedor | null; validador: Provedor | null }
  class ErroPipeline extends Error { definitivo: boolean }
  function gerarLote(deps: DepsPipeline, e: EntradaLote): Promise<ResumoLote>
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/pipeline/gerar-lote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso, type RespostaFalsa } from "../ai/falso";
import { ErroIa, type UsoIa } from "../ai/tipos";
import { gerarLote, type EntradaLote, type LoteParaGravar, type RepositorioPipeline } from "./gerar-lote";
import { hashNormalizado } from "./hash";

function repoFalso(hashes: string[] = []) {
  const lotes: LoteParaGravar[] = [];
  const usos: { uso: UsoIa; finalidade: string; jobId: string | null }[] = [];
  const repo: RepositorioPipeline = {
    async hashesExistentes(lista) {
      return new Set(lista.filter((h) => hashes.includes(h)));
    },
    async exemplosReais() {
      return [];
    },
    async registrarLote(lote) {
      lotes.push(lote);
      return lote.itens.length;
    },
    async registrarUso(uso, finalidade, jobId) {
      usos.push({ uso, finalidade, jobId });
    },
  };
  return { repo, lotes, usos };
}

const item = (enunciado: string, gabarito: "C" | "E", extra: Partial<{ dificuldade: number }> = {}) => ({
  enunciado,
  gabarito,
  justificativa: `Por que ${enunciado}`,
  citacao: null,
  dificuldade: extra.dificuldade ?? 2,
});
const lote = (...itens: ReturnType<typeof item>[]) => ({ texto_base: null, itens });
const julgamentos = (...gabaritos: ("C" | "E")[]) => ({
  julgamentos: gabaritos.map((g, indice) => ({ indice, gabarito: g, justificativa: `j${indice}` })),
});

const entrada: EntradaLote = {
  banca: "cebraspe",
  topico: { canonico: "portugues/crase", disciplina: "Língua Portuguesa", programa: "5.7 Crase" },
  quantidade: 3,
  rodada: 0,
  fonte: null,
};

function cenario(anthropic: RespostaFalsa[], openai: RespostaFalsa[], hashes: string[] = []) {
  const a = criarProvedorFalso("anthropic", anthropic);
  const o = criarProvedorFalso("openai", openai);
  const r = repoFalso(hashes);
  return { a, o, r, deps: { provedores: [a.provedor, o.provedor] as [typeof a.provedor, typeof o.provedor], repo: r.repo, jobId: "job-1" } };
}

describe("gerarLote", () => {
  it("aprova os itens em que o validador concorda e registra o uso das duas chamadas", async () => {
    const c = cenario([lote(item("A", "C"), item("B", "E"))], [julgamentos("C", "E")]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerados: 2, duplicados: 0, aprovados: 2, revisao: 0, gravados: 2, gerador: "anthropic", validador: "openai" });
    expect(resumo.custoUsd).toBeCloseTo(0.02, 10);
    expect(c.r.usos.map((u) => [u.finalidade, u.uso.provedor, u.jobId])).toEqual([
      ["gerar_itens", "anthropic", "job-1"],
      ["validar_itens", "openai", "job-1"],
    ]);
    const gravado = c.r.lotes[0].itens[0];
    expect(gravado).toMatchObject({ status: "aprovado", canonicos: ["portugues/crase"], hash: hashNormalizado("A", null) });
    expect(gravado.validacao).toMatchObject({ concordancia: true, mesmo_provedor: false, gabarito_validador: "C" });
  });

  it("não mostra o gabarito ao validador", async () => {
    const c = cenario([lote(item("A", "C"))], [julgamentos("C")]);
    await gerarLote(c.deps, entrada);
    expect(c.o.pedidos[0].prompt).not.toContain("Por que A");
    expect(c.o.pedidos[0].prompt).toContain("0. A");
  });

  it("alterna o gerador conforme a rodada", async () => {
    const c = cenario([julgamentos("C")], [lote(item("A", "C"))]);
    const resumo = await gerarLote(c.deps, { ...entrada, rodada: 1 });
    expect(resumo).toMatchObject({ gerador: "openai", validador: "anthropic", aprovados: 1 });
  });

  it("manda para revisão os itens com discordância ou sem julgamento", async () => {
    const c = cenario([lote(item("A", "C"), item("B", "E"), item("C", "C"))], [{ julgamentos: [{ indice: 0, gabarito: "E", justificativa: "x" }, { indice: 1, gabarito: "E", justificativa: "y" }] }]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ aprovados: 1, revisao: 2 });
    expect(c.r.lotes[0].itens.map((i) => i.status)).toEqual(["revisao", "aprovado", "revisao"]);
    expect(c.r.lotes[0].itens[2].validacao.gabarito_validador).toBeNull();
  });

  it("descarta duplicados já gravados ou repetidos no lote e só valida os novos", async () => {
    const c = cenario([lote(item("A", "C"), item("a!", "C"), item("B", "E"))], [julgamentos("E")], [hashNormalizado("B", null)]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerados: 3, duplicados: 2, gravados: 1 });
    expect(c.o.pedidos[0].prompt).toContain("0. A");
    expect(c.o.pedidos[0].prompt).not.toContain("B");
  });

  it("não chama o validador quando todos os itens são duplicados", async () => {
    const c = cenario([lote(item("A", "C"))], [], [hashNormalizado("A", null)]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gravados: 0, validador: null });
    expect(c.o.pedidos).toHaveLength(0);
    expect(c.r.lotes).toHaveLength(0);
  });

  it("usa o outro provedor quando o gerador falha", async () => {
    const c = cenario([new ErroIa("anthropic", "api", "fora do ar"), julgamentos("C")], [lote(item("A", "C"))]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerador: "openai", validador: "anthropic", aprovados: 1 });
  });

  it("valida com o mesmo provedor quando o outro falha, mas manda tudo para revisão", async () => {
    const c = cenario([lote(item("A", "C")), julgamentos("C")], [new ErroIa("openai", "api", "limite")]);
    const resumo = await gerarLote(c.deps, entrada);
    expect(resumo).toMatchObject({ gerador: "anthropic", validador: "anthropic", aprovados: 0, revisao: 1 });
    expect(c.r.lotes[0].itens[0].validacao.mesmo_provedor).toBe(true);
  });

  it("falha quando os dois provedores falham, registrando o uso cobrado", async () => {
    const uso: UsoIa = { provedor: "anthropic", modelo: "m", tokensEntrada: 1, tokensSaida: 1, custoUsd: 0.5 };
    const c = cenario([new ErroIa("anthropic", "recusa", "recusou", uso)], [new ErroIa("openai", "saida_invalida", "json")]);
    await expect(gerarLote(c.deps, entrada)).rejects.toThrow(/gerar_itens falhou em todos os provedores/);
    expect(c.r.usos).toHaveLength(1);
  });

  it("exige fonte legal para tópicos de legislação", async () => {
    const c = cenario([], []);
    await expect(
      gerarLote(c.deps, { ...entrada, topico: { ...entrada.topico, canonico: "legislacao-cbmal/lei-x" } }),
    ).rejects.toThrow("Fonte legal ausente para legislacao-cbmal/lei-x");
    expect(c.a.pedidos).toHaveLength(0);
  });

  it("envia a janela da fonte às duas IAs e grava o slug da fonte", async () => {
    const dispositivos = Array.from({ length: 10 }, (_, i) => ({ referencia: `art. ${i + 1}`, texto: `Art. ${i + 1}º Texto ${i + 1}.` }));
    const c = cenario([lote(item("A", "C"))], [julgamentos("C")]);
    await gerarLote(c.deps, {
      ...entrada,
      topico: { ...entrada.topico, canonico: "legislacao-cbmal/lei-x" },
      fonte: { slug: "lei-x", titulo: "Lei X", dispositivos },
    });
    expect(c.a.pedidos[0].prompt).toContain("Art. 8º Texto 8.");
    expect(c.a.pedidos[0].prompt).not.toContain("Art. 9º Texto 9.");
    expect(c.o.pedidos[0].prompt).toContain("Art. 1º Texto 1.");
    expect(c.r.lotes[0].fonte).toBe("lei-x");
  });

  it("limita a quantidade e normaliza a dificuldade", async () => {
    const muitos = Array.from({ length: 7 }, (_, i) => item(`I${i}`, "C", { dificuldade: i === 0 ? 7 : 0.2 }));
    const c = cenario([lote(...muitos)], [julgamentos("C", "C", "C", "C", "C")]);
    const resumo = await gerarLote(c.deps, { ...entrada, quantidade: 9 });
    expect(resumo.gerados).toBe(5);
    expect(c.a.pedidos[0].prompt).toContain("Escreva 5 itens");
    expect(c.r.lotes[0].itens.map((i) => i.dificuldade)).toEqual([3, 1, 1, 1, 1]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/pipeline/gerar-lote.test.ts`
Expected: FAIL (`Cannot find module './gerar-lote'`).

- [ ] **Step 3: Implementar**

Create `src/pipeline/gerar-lote.ts`:

```ts
import { ErroIa, type Provedor, type ProvedorIa, type RespostaJson, type UsoIa } from "../ai/tipos";
import { janelaDeDispositivos, type Dispositivo } from "../core/fontes/dispositivos";
import { hashNormalizado } from "./hash";
import {
  PROMPT_VERSAO,
  promptGeracao,
  promptValidacao,
  SISTEMA_GERADOR,
  SISTEMA_VALIDADOR,
  type ContextoTopico,
} from "./prompts";
import { julgamentosSchema, loteGeradoSchema } from "./schemas";

export const MAX_ITENS_POR_LOTE = 5;
export const TAMANHO_JANELA_FONTE = 8;
const AREAS_COM_FONTE_OBRIGATORIA = ["legislacao-cbmal/"];

export interface FonteLegal {
  slug: string;
  titulo: string;
  dispositivos: Dispositivo[];
}

export interface ValidacaoItem {
  prompt_versao: string;
  gerador: { provedor: Provedor; modelo: string };
  validador: { provedor: Provedor; modelo: string };
  gabarito_validador: "C" | "E" | null;
  justificativa_validador: string | null;
  concordancia: boolean;
  mesmo_provedor: boolean;
}

export interface ItemParaGravar {
  enunciado: string;
  gabarito: "C" | "E";
  justificativa: string;
  citacao: string | null;
  dificuldade: 1 | 2 | 3;
  hash: string;
  status: "aprovado" | "revisao";
  validacao: ValidacaoItem;
  canonicos: string[];
}

export interface LoteParaGravar {
  banca: string;
  formato: "certo_errado";
  origem: "ia";
  texto_base: string | null;
  fonte: string | null;
  itens: ItemParaGravar[];
}

export interface RepositorioPipeline {
  hashesExistentes(hashes: string[]): Promise<Set<string>>;
  exemplosReais(canonico: string, limite: number): Promise<{ enunciado: string; gabarito: string }[]>;
  registrarLote(lote: LoteParaGravar): Promise<number>;
  registrarUso(uso: UsoIa, finalidade: string, jobId: string | null): Promise<void>;
}

export interface DepsPipeline {
  provedores: [ProvedorIa, ProvedorIa];
  repo: RepositorioPipeline;
  jobId: string | null;
}

export interface EntradaLote {
  banca: string;
  topico: ContextoTopico;
  quantidade: number;
  rodada: number;
  fonte: FonteLegal | null;
}

export interface ResumoLote {
  gerados: number;
  duplicados: number;
  aprovados: number;
  revisao: number;
  gravados: number;
  custoUsd: number;
  gerador: Provedor | null;
  validador: Provedor | null;
}

// `definitivo` indica que repetir o job não adianta (ex.: falta configurar uma fonte).
export class ErroPipeline extends Error {
  constructor(
    mensagem: string,
    public readonly definitivo = false,
  ) {
    super(mensagem);
    this.name = "ErroPipeline";
  }
}

// Tenta os provedores na ordem dada; registra o uso de cada chamada (inclusive as que falham depois de cobrar).
async function chamarComReserva<T>(
  deps: DepsPipeline,
  ordem: ProvedorIa[],
  finalidade: string,
  custo: { total: number },
  chamada: (p: ProvedorIa) => Promise<RespostaJson<T>>,
): Promise<RespostaJson<T> & { provedor: ProvedorIa }> {
  const erros: string[] = [];
  for (const provedor of ordem) {
    try {
      const r = await chamada(provedor);
      custo.total += r.uso.custoUsd;
      await deps.repo.registrarUso(r.uso, finalidade, deps.jobId);
      return { ...r, provedor };
    } catch (e) {
      if (!(e instanceof ErroIa)) throw e;
      if (e.uso) {
        custo.total += e.uso.custoUsd;
        await deps.repo.registrarUso(e.uso, finalidade, deps.jobId);
      }
      erros.push(`${provedor.nome}: ${e.motivo} (${e.message})`);
    }
  }
  throw new ErroPipeline(`${finalidade} falhou em todos os provedores: ${erros.join("; ")}`);
}

function dificuldade(valor: number): 1 | 2 | 3 {
  return Math.min(3, Math.max(1, Math.round(valor))) as 1 | 2 | 3;
}

export async function gerarLote(deps: DepsPipeline, e: EntradaLote): Promise<ResumoLote> {
  const { canonico } = e.topico;
  if (!e.fonte && AREAS_COM_FONTE_OBRIGATORIA.some((a) => canonico.startsWith(a))) {
    throw new ErroPipeline(`Fonte legal ausente para ${canonico}`, true);
  }

  const quantidade = Math.min(MAX_ITENS_POR_LOTE, Math.max(1, Math.floor(e.quantidade)));
  const [a, b] = deps.provedores;
  const principal = e.rodada % 2 === 0 ? a : b;
  const outro = principal === a ? b : a;
  const fonte = e.fonte
    ? { titulo: e.fonte.titulo, dispositivos: janelaDeDispositivos(e.fonte.dispositivos, e.rodada, TAMANHO_JANELA_FONTE) }
    : null;
  const custo = { total: 0 };

  const exemplos = await deps.repo.exemplosReais(canonico, 5);
  const geracao = await chamarComReserva(deps, [principal, outro], "gerar_itens", custo, (p) =>
    p.gerarJson({
      finalidade: "gerar_itens",
      sistema: SISTEMA_GERADOR,
      prompt: promptGeracao({ banca: e.banca, topico: e.topico, quantidade, fonte, exemplos }),
      schema: loteGeradoSchema,
      nomeSchema: "lote_itens",
    }),
  );

  const textoBase = geracao.dados.texto_base?.trim() || null;
  const itens = geracao.dados.itens.slice(0, quantidade).map((i) => ({ ...i, hash: hashNormalizado(i.enunciado, textoBase) }));
  const existentes = await deps.repo.hashesExistentes(itens.map((i) => i.hash));
  const vistos = new Set<string>();
  const novos = itens.filter((i) => {
    if (existentes.has(i.hash) || vistos.has(i.hash)) return false;
    vistos.add(i.hash);
    return true;
  });

  const resumo: ResumoLote = {
    gerados: itens.length,
    duplicados: itens.length - novos.length,
    aprovados: 0,
    revisao: 0,
    gravados: 0,
    custoUsd: 0,
    gerador: geracao.provedor.nome,
    validador: null,
  };
  if (novos.length === 0) return { ...resumo, custoUsd: custo.total };

  const ordemValidacao = geracao.provedor === a ? [b, a] : [a, b];
  const validacao = await chamarComReserva(deps, ordemValidacao, "validar_itens", custo, (p) =>
    p.gerarJson({
      finalidade: "validar_itens",
      sistema: SISTEMA_VALIDADOR,
      prompt: promptValidacao({ topico: e.topico, textoBase, enunciados: novos.map((n) => n.enunciado), fonte }),
      schema: julgamentosSchema,
      nomeSchema: "julgamentos",
    }),
  );
  const mesmoProvedor = validacao.provedor === geracao.provedor;
  const julgamentos = new Map(validacao.dados.julgamentos.map((j) => [j.indice, j]));

  const paraGravar: ItemParaGravar[] = novos.map((n, indice) => {
    const j = julgamentos.get(indice);
    const concordancia = j?.gabarito === n.gabarito;
    return {
      enunciado: n.enunciado,
      gabarito: n.gabarito,
      justificativa: n.justificativa,
      citacao: n.citacao,
      dificuldade: dificuldade(n.dificuldade),
      hash: n.hash,
      status: concordancia && !mesmoProvedor ? "aprovado" : "revisao",
      validacao: {
        prompt_versao: PROMPT_VERSAO,
        gerador: { provedor: geracao.uso.provedor, modelo: geracao.uso.modelo },
        validador: { provedor: validacao.uso.provedor, modelo: validacao.uso.modelo },
        gabarito_validador: j?.gabarito ?? null,
        justificativa_validador: j?.justificativa ?? null,
        concordancia,
        mesmo_provedor: mesmoProvedor,
      },
      canonicos: [canonico],
    };
  });

  const gravados = await deps.repo.registrarLote({
    banca: e.banca,
    formato: "certo_errado",
    origem: "ia",
    texto_base: textoBase,
    fonte: e.fonte?.slug ?? null,
    itens: paraGravar,
  });

  return {
    ...resumo,
    aprovados: paraGravar.filter((i) => i.status === "aprovado").length,
    revisao: paraGravar.filter((i) => i.status === "revisao").length,
    gravados,
    custoUsd: custo.total,
    validador: validacao.provedor.nome,
  };
}
```

- [ ] **Step 4: Rodar, typecheck, lint e commit**

Run: `npx vitest run src/pipeline && npm run typecheck && npm run lint`
Expected: 18 testes PASS em `src/pipeline`.

```bash
git add -A
git commit -m "feat(pipeline): lote com geração, deduplicação e validação cruzada"
```

---

### Task 7: Execução de jobs e configuração da IA

**Files:**
- Create: `src/pipeline/executar-job.ts`, `src/pipeline/config.ts`
- Test: `src/pipeline/executar-job.test.ts`, `src/pipeline/config.test.ts`

**Interfaces:**
- Consumes: `gerarLote`, `ErroPipeline`, `EntradaLote`, `ResumoLote`, `FonteLegal` (Task 6); provedores (Task 1)
- Produces:
  ```ts
  const MAX_TENTATIVAS = 3;
  interface Job { id: string; tipo: string; payload: unknown; tentativas: number }
  interface FilaJobs { reservar(): Promise<Job | null>; concluir(id): Promise<void>; falhar(id, erro, maxTentativas): Promise<void> }
  interface ContextoGeracao { banca: string; topico: ContextoTopico; fonte: FonteLegal | null }
  interface DepsJob { fila: FilaJobs; carregarContexto(concurso, canonico): Promise<ContextoGeracao>; gerar(entrada: EntradaLote, jobId: string): Promise<ResumoLote> }
  type ResultadoJob = { status: "vazio" } | { status: "concluido"; jobId; resumo } | { status: "falhou"; jobId; erro }
  function rodadaDoJob(job: Job): number
  function executarProximoJob(deps: DepsJob): Promise<ResultadoJob>
  function lerConfigIa(env?): ConfigIa
  function criarProvedores(config?: ConfigIa): [ProvedorIa, ProvedorIa]   // [Claude, GPT]
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/pipeline/executar-job.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { executarProximoJob, rodadaDoJob, type DepsJob, type Job } from "./executar-job";
import { ErroPipeline, type EntradaLote, type ResumoLote } from "./gerar-lote";

const resumo: ResumoLote = {
  gerados: 1, duplicados: 0, aprovados: 1, revisao: 0, gravados: 1, custoUsd: 0.1, gerador: "anthropic", validador: "openai",
};

function deps(job: Job | null, gerar: DepsJob["gerar"] = async () => resumo) {
  const chamadas: string[] = [];
  const entradas: EntradaLote[] = [];
  const d: DepsJob = {
    fila: {
      async reservar() {
        return job;
      },
      async concluir(id) {
        chamadas.push(`concluir ${id}`);
      },
      async falhar(id, erro, max) {
        chamadas.push(`falhar ${id} ${max} ${erro}`);
      },
    },
    async carregarContexto(concurso, canonico) {
      return { banca: "cebraspe", topico: { canonico, disciplina: "D", programa: `${concurso} P` }, fonte: null };
    },
    async gerar(entrada, jobId) {
      entradas.push(entrada);
      return gerar(entrada, jobId);
    },
  };
  return { d, chamadas, entradas };
}

const job = (extra: Partial<Job> = {}): Job => ({
  id: "0000000a-0000-0000-0000-000000000000",
  tipo: "gerar_itens",
  payload: { concurso: "cbmal-2026", canonico: "portugues/crase", quantidade: 5 },
  tentativas: 1,
  ...extra,
});

describe("executarProximoJob", () => {
  it("não faz nada com a fila vazia", async () => {
    expect(await executarProximoJob(deps(null).d)).toEqual({ status: "vazio" });
  });

  it("gera o lote com o contexto do tópico e conclui o job", async () => {
    const t = deps(job());
    const r = await executarProximoJob(t.d);
    expect(r).toEqual({ status: "concluido", jobId: job().id, resumo });
    expect(t.entradas[0]).toMatchObject({ banca: "cebraspe", quantidade: 5, rodada: 10, topico: { programa: "cbmal-2026 P" } });
    expect(t.chamadas).toEqual([`concluir ${job().id}`]);
  });

  it("devolve à fila com o limite normal de tentativas quando a geração falha", async () => {
    const t = deps(job(), async () => {
      throw new ErroPipeline("gerar_itens falhou em todos os provedores");
    });
    const r = await executarProximoJob(t.d);
    expect(r).toMatchObject({ status: "falhou", erro: "gerar_itens falhou em todos os provedores" });
    expect(t.chamadas).toEqual([`falhar ${job().id} 3 gerar_itens falhou em todos os provedores`]);
  });

  it("falha de vez em erros definitivos e payloads inválidos", async () => {
    const t1 = deps(job(), async () => {
      throw new ErroPipeline("Fonte legal ausente", true);
    });
    await executarProximoJob(t1.d);
    expect(t1.chamadas[0]).toMatch(/^falhar \S+ 0 Fonte legal ausente/);

    const t2 = deps(job({ payload: { canonico: "x" } }));
    await executarProximoJob(t2.d);
    expect(t2.chamadas[0]).toMatch(/^falhar \S+ 0 Payload inválido/);
    expect(t2.entradas).toHaveLength(0);
  });
});

describe("rodadaDoJob", () => {
  it("varia com o id e com a tentativa", () => {
    expect(rodadaDoJob(job())).toBe(10);
    expect(rodadaDoJob(job({ tentativas: 2 }))).toBe(11);
  });
});
```

Create `src/pipeline/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { lerConfigIa } from "./config";

const completo = {
  ANTHROPIC_API_KEY: "a",
  OPENAI_API_KEY: "o",
  OPENAI_MODEL: "modelo-gpt",
  OPENAI_PRECO_ENTRADA_USD_MTOK: "1.5",
  OPENAI_PRECO_SAIDA_USD_MTOK: "6",
};

describe("lerConfigIa", () => {
  it("usa o Claude Opus 5.5 por padrão e converte os preços", () => {
    expect(lerConfigIa(completo)).toMatchObject({ CLAUDE_MODEL: "claude-opus-5-5", OPENAI_PRECO_ENTRADA_USD_MTOK: 1.5 });
  });

  it("lista as variáveis que faltam", () => {
    expect(() => lerConfigIa({ ANTHROPIC_API_KEY: "a" })).toThrow(
      "Configuração de IA ausente ou inválida: OPENAI_API_KEY, OPENAI_MODEL, OPENAI_PRECO_ENTRADA_USD_MTOK, OPENAI_PRECO_SAIDA_USD_MTOK",
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/pipeline/executar-job.test.ts src/pipeline/config.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

Create `src/pipeline/executar-job.ts`:

```ts
import { z } from "zod/v4";
import { ErroPipeline, type EntradaLote, type FonteLegal, type ResumoLote } from "./gerar-lote";
import type { ContextoTopico } from "./prompts";

export const MAX_TENTATIVAS = 3;

export const payloadGerarItensSchema = z.object({
  concurso: z.string().min(1),
  canonico: z.string().min(1),
  quantidade: z.number().int().min(1).max(5),
});

export interface Job {
  id: string;
  tipo: string;
  payload: unknown;
  tentativas: number;
}

export interface FilaJobs {
  reservar(): Promise<Job | null>;
  concluir(id: string): Promise<void>;
  falhar(id: string, erro: string, maxTentativas: number): Promise<void>;
}

export interface ContextoGeracao {
  banca: string;
  topico: ContextoTopico;
  fonte: FonteLegal | null;
}

export interface DepsJob {
  fila: FilaJobs;
  carregarContexto(concurso: string, canonico: string): Promise<ContextoGeracao>;
  gerar(entrada: EntradaLote, jobId: string): Promise<ResumoLote>;
}

export type ResultadoJob =
  | { status: "vazio" }
  | { status: "concluido"; jobId: string; resumo: ResumoLote }
  | { status: "falhou"; jobId: string; erro: string };

// A rodada vem do id do job (varia entre jobs) e da tentativa (troca o gerador numa nova tentativa).
export function rodadaDoJob(job: Job): number {
  return parseInt(job.id.replace(/-/g, "").slice(0, 8), 16) + job.tentativas - 1;
}

export async function executarProximoJob(deps: DepsJob): Promise<ResultadoJob> {
  const job = await deps.fila.reservar();
  if (!job) return { status: "vazio" };
  try {
    if (job.tipo !== "gerar_itens") throw new ErroPipeline(`Tipo de job desconhecido: ${job.tipo}`, true);
    const payload = payloadGerarItensSchema.safeParse(job.payload);
    if (!payload.success) throw new ErroPipeline(`Payload inválido: ${payload.error.message}`, true);
    const { concurso, canonico, quantidade } = payload.data;
    const contexto = await deps.carregarContexto(concurso, canonico);
    const resumo = await deps.gerar(
      { banca: contexto.banca, topico: contexto.topico, fonte: contexto.fonte, quantidade, rodada: rodadaDoJob(job) },
      job.id,
    );
    await deps.fila.concluir(job.id);
    return { status: "concluido", jobId: job.id, resumo };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    const definitivo = e instanceof ErroPipeline && e.definitivo;
    await deps.fila.falhar(job.id, erro, definitivo ? 0 : MAX_TENTATIVAS);
    return { status: "falhou", jobId: job.id, erro };
  }
}
```

Create `src/pipeline/config.ts`:

```ts
import { z } from "zod/v4";
import { criarProvedorClaude } from "../ai/claude";
import { criarProvedorOpenAI } from "../ai/openai";
import type { ProvedorIa } from "../ai/tipos";

const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  CLAUDE_MODEL: z.string().min(1).default("claude-opus-5-5"),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1),
  OPENAI_PRECO_ENTRADA_USD_MTOK: z.coerce.number().positive(),
  OPENAI_PRECO_SAIDA_USD_MTOK: z.coerce.number().positive(),
});

export type ConfigIa = z.infer<typeof schema>;

export function lerConfigIa(env: Record<string, string | undefined> = process.env): ConfigIa {
  const r = schema.safeParse(env);
  if (!r.success) {
    const campos = [...new Set(r.error.issues.map((i) => i.path.join(".")))];
    throw new Error(`Configuração de IA ausente ou inválida: ${campos.join(", ")}`);
  }
  return r.data;
}

export function criarProvedores(config: ConfigIa = lerConfigIa()): [ProvedorIa, ProvedorIa] {
  return [
    criarProvedorClaude({ apiKey: config.ANTHROPIC_API_KEY, modelo: config.CLAUDE_MODEL }),
    criarProvedorOpenAI({
      apiKey: config.OPENAI_API_KEY,
      modelo: config.OPENAI_MODEL,
      preco: {
        entradaUsdPorMTok: config.OPENAI_PRECO_ENTRADA_USD_MTOK,
        saidaUsdPorMTok: config.OPENAI_PRECO_SAIDA_USD_MTOK,
        cacheLeituraUsdPorMTok: config.OPENAI_PRECO_ENTRADA_USD_MTOK,
      },
    }),
  ];
}
```

- [ ] **Step 4: Rodar, typecheck, lint e commit**

Run: `npx vitest run src/pipeline && npm run typecheck && npm run lint`
Expected: 25 testes PASS em `src/pipeline`.

```bash
git add -A
git commit -m "feat(pipeline): execução de jobs com novas tentativas e configuração da IA"
```

---

### Task 8: Supabase do pipeline e rota do worker

**Files:**
- Create: `src/lib/auth/segredo.ts`, `src/db/supabase/servico.ts`, `src/db/repositorios/pipeline.ts`, `src/app/api/jobs/worker/route.ts`
- Modify: `src/lib/auth/rotas.ts`, `src/lib/auth/rotas.test.ts`
- Test: `src/lib/auth/segredo.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 6 e 7 (`Database` com as funções do pipeline)
- Produces:
  ```ts
  function bearerValido(cabecalho: string | null, segredo: string | undefined): boolean
  function criarClienteServico(): SupabaseClient<Database>   // usa SUPABASE_SECRET_KEY
  function criarRepositorioPipeline(db): RepositorioPipeline
  function criarFilaJobs(db): FilaJobs
  function enfileirarGeracao(db, concurso: string, canonico: string, quantidade: number): Promise<string>
  function carregarContexto(db, concurso: string, canonico: string): Promise<ContextoGeracao>
  POST /api/jobs/worker   // Authorization: Bearer $WORKER_SECRET → ResultadoJob
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/lib/auth/segredo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bearerValido } from "./segredo";

describe("bearerValido", () => {
  it("aceita só o segredo exato", () => {
    expect(bearerValido("Bearer s3gredo", "s3gredo")).toBe(true);
    expect(bearerValido("Bearer s3gred0", "s3gredo")).toBe(false);
    expect(bearerValido("s3gredo", "s3gredo")).toBe(false);
  });

  it("recusa quando o segredo não está configurado ou o cabeçalho falta", () => {
    expect(bearerValido("Bearer ", "")).toBe(false);
    expect(bearerValido("Bearer x", undefined)).toBe(false);
    expect(bearerValido(null, "x")).toBe(false);
  });
});
```

Em `src/lib/auth/rotas.test.ts`, logo depois do teste `"libera login e callback"`, adicione:

```ts
  it("libera o worker de jobs, que se autentica com segredo próprio", () => {
    expect(rotaPublica("/api/jobs/worker")).toBe(true);
    expect(rotaPublica("/api/outra")).toBe(false);
  });
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/lib`
Expected: FAIL (`./segredo` inexistente e `/api/jobs/worker` não público).

- [ ] **Step 3: Implementar a autenticação do worker**

Create `src/lib/auth/segredo.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

// Compara "Authorization: Bearer <segredo>" em tempo constante.
export function bearerValido(cabecalho: string | null, segredo: string | undefined): boolean {
  if (!segredo || !cabecalho) return false;
  const recebido = Buffer.from(cabecalho);
  const esperado = Buffer.from(`Bearer ${segredo}`);
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado);
}
```

Em `src/lib/auth/rotas.ts`, troque a constante de rotas públicas por:

```ts
// /api/jobs tem autenticação própria (segredo do worker).
const ROTAS_PUBLICAS = ["/entrar", "/auth/callback", "/api/jobs"];
```

- [ ] **Step 4: Implementar o acesso ao Supabase**

Create `src/db/supabase/servico.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

// Cliente com a chave secreta: ignora RLS. Use só no servidor (worker, scripts), nunca no navegador.
export function criarClienteServico() {
  const { url } = lerEnvSupabase();
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não configurada");
  return createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type ClienteServico = ReturnType<typeof criarClienteServico>;
```

Create `src/db/repositorios/pipeline.ts`:

```ts
import type { UsoIa } from "../../ai/tipos";
import type { ContextoGeracao, FilaJobs } from "../../pipeline/executar-job";
import type { LoteParaGravar, RepositorioPipeline } from "../../pipeline/gerar-lote";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export function criarRepositorioPipeline(db: ClienteServico): RepositorioPipeline {
  return {
    async hashesExistentes(hashes) {
      if (hashes.length === 0) return new Set();
      const { data, error } = await db.from("itens").select("hash_normalizado").in("hash_normalizado", hashes);
      if (error) falhou("hashesExistentes", error);
      return new Set(data.map((d) => d.hash_normalizado));
    },

    async exemplosReais(canonico, limite) {
      const { data, error } = await db
        .from("itens")
        .select("enunciado, gabarito, item_topicos!inner(topicos_canonicos!inner(slug))")
        .eq("origem", "real")
        .eq("status", "aprovado")
        .eq("item_topicos.topicos_canonicos.slug", canonico)
        .limit(limite);
      if (error) falhou("exemplosReais", error);
      return data.map((d) => ({ enunciado: d.enunciado, gabarito: d.gabarito }));
    },

    async registrarLote(lote: LoteParaGravar) {
      const { data, error } = await db.rpc("itens_registrar_lote", { p_lote: lote as unknown as Json });
      if (error) falhou("registrarLote", error);
      return data;
    },

    async registrarUso(uso: UsoIa, finalidade, jobId) {
      const { error } = await db.rpc("ia_registrar_uso", {
        p_uso: {
          provedor: uso.provedor,
          modelo: uso.modelo,
          finalidade,
          tokens_entrada: uso.tokensEntrada,
          tokens_saida: uso.tokensSaida,
          custo_usd: uso.custoUsd,
          job_id: jobId,
        },
      });
      if (error) falhou("registrarUso", error);
    },
  };
}

export function criarFilaJobs(db: ClienteServico): FilaJobs {
  return {
    async reservar() {
      const { data, error } = await db.rpc("jobs_reservar");
      if (error) falhou("reservar job", error);
      const job = data[0];
      return job ? { id: job.id, tipo: job.tipo, payload: job.payload, tentativas: job.tentativas } : null;
    },
    async concluir(id) {
      const { error } = await db.rpc("jobs_concluir", { p_id: id });
      if (error) falhou("concluir job", error);
    },
    async falhar(id, erro, maxTentativas) {
      const { error } = await db.rpc("jobs_falhar", { p_id: id, p_erro: erro, p_max_tentativas: maxTentativas });
      if (error) falhou("registrar falha do job", error);
    },
  };
}

export async function enfileirarGeracao(db: ClienteServico, concurso: string, canonico: string, quantidade: number) {
  const { data, error } = await db.rpc("jobs_enfileirar_geracao", {
    p_concurso: concurso,
    p_canonico: canonico,
    p_quantidade: quantidade,
  });
  if (error) falhou("enfileirar geração", error);
  return data;
}

// Monta o contexto do tópico canônico no concurso: banca, disciplina, caminho no programa e fonte legal.
export async function carregarContexto(db: ClienteServico, concurso: string, canonico: string): Promise<ContextoGeracao> {
  const { data: c, error: e1 } = await db.from("concursos").select("id, bancas(slug)").eq("slug", concurso).single();
  if (e1) falhou(`concurso ${concurso}`, e1);

  const { data: topicos, error: e2 } = await db
    .from("topicos")
    .select("codigo, titulo, parent_id, disciplinas!inner(nome, concurso_id), topicos_canonicos!inner(slug)")
    .eq("topicos_canonicos.slug", canonico)
    .eq("disciplinas.concurso_id", c.id)
    .order("ordem")
    .limit(1);
  if (e2) falhou(`tópico ${canonico}`, e2);
  const topico = topicos[0];
  if (!topico) throw new Error(`Tópico ${canonico} não existe no concurso ${concurso}`);

  const caminho = [`${topico.codigo} ${topico.titulo}`];
  let pai = topico.parent_id;
  while (pai) {
    const { data, error } = await db.from("topicos").select("codigo, titulo, parent_id").eq("id", pai).single();
    if (error) falhou("tópico pai", error);
    caminho.unshift(`${data.codigo} ${data.titulo}`);
    pai = data.parent_id;
  }

  const { data: fonte, error: e3 } = await db
    .from("fontes")
    .select("slug, titulo, fonte_dispositivos(referencia, texto, ordem)")
    .contains("canonicos", [canonico])
    .maybeSingle();
  if (e3) falhou("fonte legal", e3);

  return {
    banca: c.bancas.slug,
    topico: { canonico, disciplina: topico.disciplinas.nome, programa: caminho.join(" > ") },
    fonte: fonte
      ? {
          slug: fonte.slug,
          titulo: fonte.titulo,
          dispositivos: [...fonte.fonte_dispositivos]
            .sort((x, y) => x.ordem - y.ordem)
            .map((d) => ({ referencia: d.referencia, texto: d.texto })),
        }
      : null,
  };
}
```

- [ ] **Step 5: Implementar a rota do worker**

Antes, leia `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.

Create `src/app/api/jobs/worker/route.ts`:

```ts
import { carregarContexto, criarFilaJobs, criarRepositorioPipeline } from "@/db/repositorios/pipeline";
import { criarClienteServico } from "@/db/supabase/servico";
import { bearerValido } from "@/lib/auth/segredo";
import { criarProvedores } from "@/pipeline/config";
import { executarProximoJob } from "@/pipeline/executar-job";
import { gerarLote } from "@/pipeline/gerar-lote";

// Uma geração (gerar + validar até 5 itens) pode levar alguns minutos.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!bearerValido(request.headers.get("authorization"), process.env.WORKER_SECRET)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const db = criarClienteServico();
  const provedores = criarProvedores();
  const resultado = await executarProximoJob({
    fila: criarFilaJobs(db),
    carregarContexto: (concurso, canonico) => carregarContexto(db, concurso, canonico),
    gerar: (entrada, jobId) => gerarLote({ provedores, repo: criarRepositorioPipeline(db), jobId }, entrada),
  });
  return Response.json(resultado);
}
```

- [ ] **Step 6: Verificar**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: todos PASS; o build lista `ƒ /api/jobs/worker`.

```bash
WORKER_SECRET=teste npm run start -- -p 3100 &
sleep 5
curl -s -w " %{http_code}\n" -X POST http://localhost:3100/api/jobs/worker
curl -s -w " %{http_code}\n" -X POST -H "Authorization: Bearer errado" http://localhost:3100/api/jobs/worker
kill %1
```

Expected: as duas chamadas devolvem `{"erro":"não autorizado"} 401`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(pipeline): repositório Supabase e rota do worker protegida por segredo"
```

---

### Task 9: Scripts, variáveis e guia de operação

**Files:**
- Create: `scripts/carregar-fontes.ts`, `scripts/gerar-lote.ts`, `scripts/enfileirar.ts`
- Create: `editais/cbmal-2026/fontes/fontes.yaml`
- Modify: `package.json` (scripts), `.env.example`, `docs/deploy.md`

- [ ] **Step 1: Scripts de linha de comando**

Create `scripts/carregar-fontes.ts`:

```ts
// Carrega as leis de editais/<slug>/fontes/ no Supabase (tabelas fontes e fonte_dispositivos).
// Uso: npm run fontes:carregar -- <slug-do-concurso>   (precisa de SUPABASE_SECRET_KEY no .env.local)
import { readFileSync } from "node:fs";
import { dividirEmArtigos } from "../src/core/fontes/dispositivos";
import { parseManifestoFontes } from "../src/core/fontes/manifesto";
import { criarClienteServico } from "../src/db/supabase/servico";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: npm run fontes:carregar -- <slug-do-concurso>");
  const pasta = `editais/${slug}/fontes`;
  const manifesto = parseManifestoFontes(readFileSync(`${pasta}/fontes.yaml`, "utf8"));
  const db = criarClienteServico();

  for (const f of manifesto.fontes) {
    const dispositivos = dividirEmArtigos(readFileSync(`${pasta}/${f.arquivo}`, "utf8"));
    if (dispositivos.length === 0) throw new Error(`${f.arquivo}: nenhum artigo encontrado`);

    const { data: fonte, error } = await db
      .from("fontes")
      .upsert({ slug: f.slug, tipo: f.tipo, titulo: f.titulo, url_oficial: f.url_oficial, canonicos: f.canonicos }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw new Error(`${f.slug}: ${error.message}`);

    const { error: eDel } = await db.from("fonte_dispositivos").delete().eq("fonte_id", fonte.id);
    if (eDel) throw new Error(`${f.slug}: ${eDel.message}`);
    const { error: eIns } = await db
      .from("fonte_dispositivos")
      .insert(dispositivos.map((d, ordem) => ({ fonte_id: fonte.id, referencia: d.referencia, texto: d.texto, ordem })));
    if (eIns) throw new Error(`${f.slug}: ${eIns.message}`);

    console.log(`${f.slug}: ${dispositivos.length} artigos`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

Create `scripts/gerar-lote.ts`:

```ts
// Gera um lote agora, sem passar pela fila, e mostra o resultado e o custo. Faz chamadas reais às IAs.
// Uso: npm run ia:lote -- <slug-do-concurso> <topico-canonico> [quantidade]
import { carregarContexto, criarRepositorioPipeline } from "../src/db/repositorios/pipeline";
import { criarClienteServico } from "../src/db/supabase/servico";
import { criarProvedores } from "../src/pipeline/config";
import { gerarLote } from "../src/pipeline/gerar-lote";

async function main() {
  const [concurso, canonico, quantidade = "3"] = process.argv.slice(2);
  if (!concurso || !canonico) throw new Error("uso: npm run ia:lote -- <slug-do-concurso> <topico-canonico> [quantidade]");
  const db = criarClienteServico();
  const contexto = await carregarContexto(db, concurso, canonico);
  const resumo = await gerarLote(
    { provedores: criarProvedores(), repo: criarRepositorioPipeline(db), jobId: null },
    { ...contexto, quantidade: Number(quantidade), rodada: Math.floor(Date.now() / 1000) },
  );
  console.log(JSON.stringify(resumo, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

Create `scripts/enfileirar.ts`:

```ts
// Enfileira a geração de itens para um tópico; o worker processa a fila.
// Uso: npm run ia:enfileirar -- <slug-do-concurso> <topico-canonico> [quantidade]
import { enfileirarGeracao } from "../src/db/repositorios/pipeline";
import { criarClienteServico } from "../src/db/supabase/servico";

async function main() {
  const [concurso, canonico, quantidade = "5"] = process.argv.slice(2);
  if (!concurso || !canonico) throw new Error("uso: npm run ia:enfileirar -- <slug-do-concurso> <topico-canonico> [quantidade]");
  const id = await enfileirarGeracao(criarClienteServico(), concurso, canonico, Number(quantidade));
  console.log(`job ${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

Em `package.json`, dentro de `"scripts"`, adicione:

```json
"fontes:carregar": "tsx --env-file=.env.local scripts/carregar-fontes.ts",
"ia:lote": "tsx --env-file=.env.local scripts/gerar-lote.ts",
"ia:enfileirar": "tsx --env-file=.env.local scripts/enfileirar.ts"
```

- [ ] **Step 2: Manifesto das leis do CBM-AL**

Create `editais/cbmal-2026/fontes/fontes.yaml`:

```yaml
# Textos das leis em .txt nesta pasta (um artigo por "Art." no início da linha).
# Carregue no banco com: npm run fontes:carregar -- cbmal-2026
fontes:
  - slug: lei-al-5346-1992
    tipo: lei
    titulo: Lei Estadual nº 5.346/1992 — Estatuto dos Policiais Militares de Alagoas
    arquivo: lei-al-5346-1992.txt
    canonicos: [legislacao-cbmal/lei-5346-1992-estatuto]
  - slug: decreto-al-37042-1996
    tipo: decreto
    titulo: Decreto Estadual nº 37.042/1996 — Regulamento Disciplinar da PM de Alagoas
    arquivo: decreto-al-37042-1996.txt
    canonicos: [legislacao-cbmal/decreto-37042-1996-regulamento-disciplinar]
  - slug: lei-al-6514-2004
    tipo: lei
    titulo: Lei Estadual nº 6.514/2004 — Promoção de Oficiais e Praças da PM e do CBM de Alagoas
    arquivo: lei-al-6514-2004.txt
    canonicos: [legislacao-cbmal/lei-6514-2004-promocao-oficiais]
  - slug: lei-al-6544-2004
    tipo: lei
    titulo: Lei Estadual nº 6.544/2004 — Promoção de Soldados, Cabos e Subtenentes da PM e do CBM de Alagoas
    arquivo: lei-al-6544-2004.txt
    canonicos: [legislacao-cbmal/lei-6544-2004-promocao-pracas]
  - slug: lei-federal-14751-2023
    tipo: lei
    titulo: Lei Federal nº 14.751/2023 — Lei Orgânica Nacional das Polícias Militares e dos Corpos de Bombeiros Militares
    url_oficial: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/L14751.htm
    arquivo: lei-federal-14751-2023.txt
    canonicos: [legislacao-cbmal/lei-14751-2023-lei-organica-militares]
```

Os `.txt` ainda não existem: os sites oficiais estão bloqueados no ambiente de nuvem, e o usuário vai fornecer os textos. Até lá, jobs de tópicos de legislação falham de vez com "Fonte legal ausente", que é o comportamento esperado.

Run: `npx tsx -e 'import {readFileSync} from "fs"; import {parseManifestoFontes} from "./src/core/fontes/manifesto"; console.log(parseManifestoFontes(readFileSync("editais/cbmal-2026/fontes/fontes.yaml","utf8")).fontes.length)'`
Expected: `5`.

- [ ] **Step 3: Variáveis de ambiente**

Em `.env.example`, acrescente ao final:

```bash
# Somente servidor (Vercel e .env.local). Nunca use prefixo NEXT_PUBLIC_ nestas.
SUPABASE_SECRET_KEY=
WORKER_SECRET=
ANTHROPIC_API_KEY=
# Opcional; padrão claude-opus-5-5
CLAUDE_MODEL=
OPENAI_API_KEY=
OPENAI_MODEL=
# Preço do modelo GPT escolhido, em USD por milhão de tokens (para o registro de custo)
OPENAI_PRECO_ENTRADA_USD_MTOK=
OPENAI_PRECO_SAIDA_USD_MTOK=
```

- [ ] **Step 4: Guia de operação**

Ao final de `docs/deploy.md`, acrescente:

~~~markdown
## Geração de questões por IA

### Variáveis (Vercel → Settings → Environment Variables, e `.env.local` para os scripts)

| Variável | Onde obter |
|---|---|
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → chave secreta (`sb_secret_…`) |
| `WORKER_SECRET` | Gere com `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `CLAUDE_MODEL` | Opcional; padrão `claude-opus-5-5` |
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
~~~

- [ ] **Step 5: Verificar e commit**

Run: `npm test && npm run test:db && npm run typecheck && npm run lint && npm run ia:lote`
Expected: suítes PASS; o último comando imprime `uso: npm run ia:lote -- <slug-do-concurso> <topico-canonico> [quantidade]` e sai com código 1 (sem argumentos, nenhuma chamada é feita).

```bash
git add -A
git commit -m "feat(pipeline): scripts de geração e fontes, variáveis e guia de operação"
```

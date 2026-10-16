# Plano 7 — Corretor de discursiva, etapa 2: pipeline de IA

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** fazer o worker corrigir redações (duas bancas de conteúdo independentes, revisão de língua e terceira correção), transcrever fotos da folha e gerar temas, com os resultados gravados no banco da etapa 1.

**Arquitetura:**
- A camada de IA passa a aceitar imagens no pedido.
- O executor de jobs ganha processadores por tipo.
- Em `src/pipeline/discursiva/` ficam:
  - schemas e prompts;
  - uma função pura que consolida as correções na nota do edital;
  - os orquestradores de correção, transcrição e tema, que dependem só da interface `RepositorioDiscursiva` e por isso são testados com IA e repositório falsos.
- O controlador escreve o repositório Supabase, a migração 0010 e a ligação com o worker.

**Stack:** TypeScript, zod/v4 (saídas estruturadas), SDKs `@anthropic-ai/sdk` 0.134 e `openai` 7.34, Vitest, Supabase.

Especificação: `docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md` (§5). Núcleo usado: `src/core/discursiva/` (plano 6).

## Restrições globais

- Código, comentários e commits em português, no estilo do código existente.
- Nenhum teste chama IA real: use `criarProvedorFalso` (`src/ai/falso.ts`).
- Agentes: **não** deem push; **não** alterem `.env.local`, `src/db/types.ts`, `supabase/migrations/` nem o Supabase remoto. A Tarefa 8 é do controlador.
- Cada tarefa termina com `npm run typecheck`, `npm run lint` e `npm test` passando, e um commit com as linhas finais:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011ToQbiqbi5jXjUo6r9BQ2G
  ```
- Papéis fixos: `provedores = [Claude, GPT]`.
  - **Banca 1:** Claude.
  - **Banca 2:** GPT.
  - **Língua:** Claude.
  - **Terceira correção:** Claude, com a instrução de terceiro examinador.
  - **Transcrição e geração de tema:** Claude, com o GPT de reserva.
  - **Avaliação do tema:** feita pelo outro provedor. Se o próprio gerador avaliar, o tema vai para revisão.
- Respostas da IA são gravadas em `correcoes_discursiva` antes do registro de custo, e cada etapa gravada não é refeita na nova tentativa.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/ai/tipos.ts`, `claude.ts`, `openai.ts` | `imagens` opcionais no pedido |
| `src/pipeline/executar-job.ts` | processadores por tipo de job |
| `src/pipeline/gerar-lote.ts` | exporta `chamarComReserva` |
| `src/pipeline/discursiva/schemas.ts` | saídas estruturadas (conteúdo, língua, transcrição, tema, avaliação) |
| `src/pipeline/discursiva/prompts.ts` | sistemas e prompts versionados |
| `src/pipeline/discursiva/hash.ts` | hash de tema igual ao do SQL de importação |
| `src/pipeline/discursiva/consolidar.ts` | correções → nota do edital (pura) |
| `src/pipeline/discursiva/tipos.ts` | `RepositorioDiscursiva`, `DepsDiscursiva` |
| `src/pipeline/discursiva/corrigir.ts` | orquestra a correção |
| `src/pipeline/discursiva/transcrever.ts` | orquestra a transcrição |
| `src/pipeline/discursiva/gerar-tema.ts` | orquestra a geração de tema |
| `src/pipeline/discursiva/jobs.ts` | processadores `corrigir_redacao`, `transcrever_redacao`, `gerar_tema` |
| `src/db/repositorios/discursiva.ts` | repositório Supabase (controlador) |
| `src/app/api/jobs/worker/route.ts` | liga os processadores e a limpeza de fotos (controlador) |
| `supabase/migrations/0010_redacoes_detalhes.sql` | coluna `detalhes` (controlador) |

---

### Tarefa 1: imagens no pedido de IA

**Arquivos:**
- Modificar: `src/ai/tipos.ts`, `src/ai/claude.ts`, `src/ai/openai.ts`
- Teste: `src/ai/imagens.test.ts`

**Interfaces:**
- Produz:
  - `ImagemIa` (`{ midia: "image/jpeg" | "image/png" | "image/webp"; base64: string }`);
  - `PedidoJson.imagens?: ImagemIa[]`;
  - `conteudoClaude(prompt, imagens?)`;
  - `entradaOpenAI(prompt, imagens?)`.

- [ ] **Passo 1: Escrever o teste**

`src/ai/imagens.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { conteudoClaude } from "./claude";
import { entradaOpenAI } from "./openai";

const foto = { midia: "image/jpeg" as const, base64: "QUJD" };

describe("imagens no pedido", () => {
  it("sem imagens, o prompt vai como texto puro", () => {
    expect(conteudoClaude("oi")).toBe("oi");
    expect(entradaOpenAI("oi", [])).toBe("oi");
  });

  it("Claude recebe as imagens em base64 antes do texto", () => {
    expect(conteudoClaude("leia", [foto])).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
      { type: "text", text: "leia" },
    ]);
  });

  it("OpenAI recebe o texto e as imagens como data URL", () => {
    expect(entradaOpenAI("leia", [foto])).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "leia" },
          { type: "input_image", image_url: "data:image/jpeg;base64,QUJD", detail: "high" },
        ],
      },
    ]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/ai/imagens.test.ts`
Esperado: FALHA (`conteudoClaude` e `entradaOpenAI` não existem).

- [ ] **Passo 3: Implementar**

Substitua os três arquivos pelo conteúdo abaixo. As mudanças são:
- o tipo `ImagemIa` e o campo `imagens` em `tipos.ts`;
- as funções `conteudoClaude` e `entradaOpenAI`;
- o uso delas em `messages` (Claude) e em `input` (OpenAI).

`src/ai/tipos.ts`:

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

export interface ImagemIa {
  midia: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}

export interface PedidoJson<S extends z.ZodType> {
  finalidade: string;
  sistema: string;
  prompt: string;
  schema: S;
  nomeSchema: string;
  // Imagens enviadas antes do texto do prompt (ex.: fotos da folha de redação).
  imagens?: ImagemIa[];
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

`src/ai/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod/v4";
import { custoUsd, PRECOS_CLAUDE } from "./custo";
import { ErroIa, type ImagemIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigClaude {
  apiKey?: string;
  modelo?: string;
  esforco?: "low" | "medium" | "high" | "xhigh" | "max";
}

// O Haiku 5.5 não tem fallback no servidor: com "default" a recusa continua recusa.
export function suportaFallbackServidor(modelo: string): boolean {
  return !modelo.startsWith("claude-haiku-");
}

// Conteúdo da mensagem do usuário: só texto, ou as imagens seguidas do texto.
export function conteudoClaude(prompt: string, imagens: ImagemIa[] = []) {
  if (imagens.length === 0) return prompt;
  return [
    ...imagens.map((i) => ({
      type: "image" as const,
      source: { type: "base64" as const, media_type: i.midia, data: i.base64 },
    })),
    { type: "text" as const, text: prompt },
  ];
}

export function criarProvedorClaude(config: ConfigClaude = {}): ProvedorIa {
  const client = new Anthropic(config.apiKey ? { apiKey: config.apiKey } : {});
  const modelo = config.modelo ?? "claude-opus-5-5";
  if (!PRECOS_CLAUDE[modelo]) throw new Error(`Preço desconhecido para o modelo ${modelo}`);
  // Em recusa por política, a própria API refaz o pedido no modelo de fallback padrão.
  const fallback = suportaFallbackServidor(modelo)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};

  return {
    nome: "anthropic",
    async gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>> {
      let resposta;
      try {
        resposta = await client.beta.messages.parse({
          model: modelo,
          max_tokens: 16000,
          ...fallback,
          output_config: { effort: config.esforco ?? "high", format: betaZodOutputFormat(pedido.schema) },
          system: [{ type: "text", text: pedido.sistema, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: conteudoClaude(pedido.prompt, pedido.imagens) }],
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

`src/ai/openai.ts`:

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod/v4";
import { custoUsd, type PrecoModelo } from "./custo";
import { ErroIa, type ImagemIa, type PedidoJson, type ProvedorIa, type RespostaJson, type UsoIa } from "./tipos";

export interface ConfigOpenAI {
  apiKey?: string;
  modelo: string;
  preco: PrecoModelo;
}

// Entrada da Responses API: só texto, ou uma mensagem com o texto e as imagens em data URL.
export function entradaOpenAI(prompt: string, imagens: ImagemIa[] = []) {
  if (imagens.length === 0) return prompt;
  return [
    {
      role: "user" as const,
      content: [
        { type: "input_text" as const, text: prompt },
        ...imagens.map((i) => ({
          type: "input_image" as const,
          image_url: `data:${i.midia};base64,${i.base64}`,
          detail: "high" as const,
        })),
      ],
    },
  ];
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
          input: entradaOpenAI(pedido.prompt, pedido.imagens),
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

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/ai && npm run typecheck`
Esperado: PASSA (3 testes novos).

- [ ] **Passo 5: Commit**

```bash
git add src/ai
git commit -m "feat(ia): imagens no pedido para Claude e OpenAI"
```

---

### Tarefa 2: processadores por tipo de job

**Arquivos:**
- Modificar: `src/pipeline/executar-job.ts`, `src/pipeline/gerar-lote.ts`
- Teste: `src/pipeline/executar-job.test.ts`

**Interfaces:**
- Produz:
  - `ProcessadorJob = (job: Job) => Promise<unknown>`;
  - `DepsJob.processadores?: Record<string, ProcessadorJob>`;
  - `ResultadoJob` concluído com `resumo: unknown`;
  - `chamarComReserva` exportada, com `deps: { repo: Pick<RepositorioPipeline, "registrarUso">; jobId: string | null }`.
- `gerar_itens` continua com o caminho atual. Um tipo sem processador falha de vez.

- [ ] **Passo 1: Escrever o teste**

Em `src/pipeline/executar-job.test.ts`, antes de `describe("rodadaDoJob", ...)`, acrescente:

```ts
describe("executarProximoJob com outros tipos de job", () => {
  it("entrega o job ao processador do tipo e conclui", async () => {
    const t = deps(job({ tipo: "corrigir_redacao", payload: { redacao_id: "r1" } }));
    const recebidos: Job[] = [];
    t.d.processadores = {
      async corrigir_redacao(j) {
        recebidos.push(j);
        return { status: "corrigida" };
      },
    };
    const r = await executarProximoJob(t.d);
    expect(r).toEqual({ status: "concluido", jobId: job().id, resumo: { status: "corrigida" } });
    expect(recebidos[0].payload).toEqual({ redacao_id: "r1" });
    expect(t.entradas).toHaveLength(0);
  });

  it("falha de vez em tipo sem processador", async () => {
    const t = deps(job({ tipo: "desconhecido" }));
    await executarProximoJob(t.d);
    expect(t.chamadas[0]).toMatch(/^falhar \S+ 0 Tipo de job desconhecido: desconhecido/);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/executar-job.test.ts`
Esperado: FALHA (erro de tipo em `processadores` ou job não processado).

- [ ] **Passo 3: Implementar**

Substitua `src/pipeline/executar-job.ts` por:

`src/pipeline/executar-job.ts`:

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

// Processa um job de outro tipo (ex.: corrigir_redacao) e devolve um resumo para o log do worker.
export type ProcessadorJob = (job: Job) => Promise<unknown>;

export interface DepsJob {
  fila: FilaJobs;
  carregarContexto(concurso: string, canonico: string): Promise<ContextoGeracao>;
  gerar(entrada: EntradaLote, jobId: string): Promise<ResumoLote>;
  processadores?: Record<string, ProcessadorJob>;
}

export type ResultadoJob =
  | { status: "vazio" }
  | { status: "concluido"; jobId: string; resumo: unknown }
  | { status: "falhou"; jobId: string; erro: string };

// A rodada vem do id do job (varia entre jobs) e da tentativa (troca o gerador numa nova tentativa).
export function rodadaDoJob(job: Job): number {
  return parseInt(job.id.replace(/-/g, "").slice(0, 8), 16) + job.tentativas - 1;
}

async function gerarItens(deps: DepsJob, job: Job): Promise<ResumoLote> {
  const payload = payloadGerarItensSchema.safeParse(job.payload);
  if (!payload.success) throw new ErroPipeline(`Payload inválido: ${payload.error.message}`, true);
  const { concurso, canonico, quantidade } = payload.data;
  const contexto = await deps.carregarContexto(concurso, canonico);
  return deps.gerar(
    { banca: contexto.banca, topico: contexto.topico, fonte: contexto.fonte, quantidade, rodada: rodadaDoJob(job) },
    job.id,
  );
}

async function processarOutro(deps: DepsJob, job: Job): Promise<unknown> {
  const processar = deps.processadores?.[job.tipo];
  if (!processar) throw new ErroPipeline(`Tipo de job desconhecido: ${job.tipo}`, true);
  return processar(job);
}

export async function executarProximoJob(deps: DepsJob): Promise<ResultadoJob> {
  const job = await deps.fila.reservar();
  if (!job) return { status: "vazio" };
  try {
    const resumo = job.tipo === "gerar_itens" ? await gerarItens(deps, job) : await processarOutro(deps, job);
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

Em `src/pipeline/gerar-lote.ts`, troque o início de `chamarComReserva`:

```ts
async function chamarComReserva<T>(
  deps: DepsPipeline,
```

por:

```ts
export async function chamarComReserva<T>(
  deps: { repo: Pick<RepositorioPipeline, "registrarUso">; jobId: string | null },
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline && npm run typecheck`
Esperado: PASSA (2 testes novos; os de `gerar_itens` continuam passando).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/executar-job.ts src/pipeline/executar-job.test.ts src/pipeline/gerar-lote.ts
git commit -m "feat(pipeline): processadores por tipo de job no worker"
```

---

### Tarefa 3: schemas, prompts e hash de tema

**Arquivos:**
- Criar: `src/pipeline/discursiva/schemas.ts`, `src/pipeline/discursiva/prompts.ts`, `src/pipeline/discursiva/hash.ts`
- Testes: `src/pipeline/discursiva/prompts.test.ts`, `src/pipeline/discursiva/hash.test.ts`

**Interfaces:**
- Consome: `CATEGORIAS_ERRO`, `TIPOS_ERRO`, `ROTULO_CATEGORIA` de `src/core/discursiva/`.
- Produz:
  - **Schemas e tipos:** `correcaoConteudoSchema`/`CorrecaoConteudo`, `correcaoLinguaSchema`/`CorrecaoLingua`, `transcricaoSchema`/`Transcricao`, `temaGeradoSchema`/`TemaGerado`, `avaliacaoTemaSchema`/`AvaliacaoTema`.
  - **Tipos de tema:** `AspectoPadrao`, `TemaParaPrompt`.
  - **Constantes:** `PROMPT_VERSAO_DISCURSIVA`, `SISTEMA_EXAMINADOR`, `SISTEMA_REVISOR_LINGUA`, `SISTEMA_TRANSCRITOR`, `SISTEMA_ELABORADOR_TEMA`, `SISTEMA_REVISOR_TEMA`.
  - **Prompts:** `promptConteudo({tema, linhas, variante?})`, `promptLingua({linhas})`, `promptTranscricao({linhasMax})`, `promptTema(ctx)`, `promptAvaliarTema({tema, pontuacaoMaxima})`.
  - **Hash:** `hashTema(enunciado)`.

- [ ] **Passo 1: Escrever os testes**

`src/pipeline/discursiva/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { promptAvaliarTema, promptConteudo, promptLingua, promptTema, promptTranscricao, type TemaParaPrompt } from "./prompts";

const tema: TemaParaPrompt = {
  enunciado: "Prevenção de desastres",
  textosApoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "Adaptado" }],
  padrao: { aspectos: [{ codigo: "2.1", descricao: "Causas", pontos: 13.5 }], expectativas: "Citar causas." },
};

describe("prompts da discursiva", () => {
  it("conteúdo: tema, padrão com pontuação e linhas numeradas", () => {
    const p = promptConteudo({ tema, linhas: ["Primeira linha.", ""] });
    expect(p).toContain("Prevenção de desastres");
    expect(p).toContain("- Texto I: Dados. (Adaptado)");
    expect(p).toContain("- [2.1] Causas (0 a 13.5 pontos)");
    expect(p).toContain("01| Primeira linha.\n02| ");
    expect(p).not.toContain("terceiro examinador");
    expect(promptConteudo({ tema, linhas: ["x"], variante: "terceira" })).toContain("terceiro examinador");
  });

  it("língua: lista as categorias fechadas com rótulo", () => {
    const p = promptLingua({ linhas: ["Texto."] });
    expect(p).toContain("- concordancia: concordância");
    expect(p).toContain("- propriedade_vocabular: propriedade vocabular");
    expect(p).toContain("01| Texto.");
  });

  it("transcrição, tema e avaliação levam os limites do edital", () => {
    expect(promptTranscricao({ linhasMax: 30 })).toContain("até no máximo 30 linhas");
    const t = promptTema({
      banca: "cebraspe",
      concurso: "CBM-AL",
      disciplina: "Atualidades",
      programa: "Temas atuais",
      pontuacaoMaxima: 30,
      linhasMax: 30,
      temasRecentes: ["Tema velho"],
    });
    expect(t).toContain("com 3 pontos");
    expect(t).toContain("é exatamente 30");
    expect(t).toContain("- Tema velho");
    expect(promptAvaliarTema({ tema, pontuacaoMaxima: 30 })).toContain("as pontuações somam 30");
  });
});
```

`src/pipeline/discursiva/hash.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { hashTema } from "./hash";

describe("hashTema", () => {
  it("coincide com o hash calculado pelo Postgres na importação de temas", () => {
    // Valores obtidos com: select md5(lower(regexp_replace(trim(x), '\s+', ' ', 'g')))
    expect(hashTema("  Tema   REAL ")).toBe("51022a7fca2c7d6ed87e8182758e9432");
    expect(hashTema("Ação\tNOVA")).toBe("cccc4a771a36535ae65ef59f86339c1b");
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/discursiva`
Esperado: FALHA (módulos não existem).

- [ ] **Passo 3: Implementar**

`src/pipeline/discursiva/schemas.ts`:

```ts
import { z } from "zod/v4";
import { CATEGORIAS_ERRO, TIPOS_ERRO } from "../../core/discursiva/tipos";

// Schemas simples (sem limites numéricos) para caber nas saídas estruturadas dos dois provedores.

export const correcaoConteudoSchema = z.object({
  aspectos: z.array(z.object({ codigo: z.string(), nota: z.number(), justificativa: z.string() })),
  fuga_tema: z.boolean(),
  comentario: z.string(),
});
export type CorrecaoConteudo = z.infer<typeof correcaoConteudoSchema>;

export const correcaoLinguaSchema = z.object({
  erros: z.array(
    z.object({
      linha: z.number(),
      trecho: z.string(),
      tipo: z.enum(TIPOS_ERRO),
      categoria: z.enum(CATEGORIAS_ERRO),
      correcao: z.string(),
      explicacao: z.string(),
    }),
  ),
});
export type CorrecaoLingua = z.infer<typeof correcaoLinguaSchema>;

export const transcricaoSchema = z.object({
  linhas: z.array(z.object({ texto: z.string(), ilegivel: z.boolean() })),
});
export type Transcricao = z.infer<typeof transcricaoSchema>;

export const temaGeradoSchema = z.object({
  enunciado: z.string(),
  textos_apoio: z.array(z.object({ titulo: z.string(), texto: z.string(), fonte: z.string() })),
  padrao_resposta: z.object({
    aspectos: z.array(z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() })),
    expectativas: z.string(),
  }),
});
export type TemaGerado = z.infer<typeof temaGeradoSchema>;

export const avaliacaoTemaSchema = z.object({
  aprovado: z.boolean(),
  problemas: z.array(z.string()),
});
export type AvaliacaoTema = z.infer<typeof avaliacaoTemaSchema>;
```

`src/pipeline/discursiva/prompts.ts`:

```ts
import { ROTULO_CATEGORIA } from "../../core/discursiva/erros";
import { CATEGORIAS_ERRO } from "../../core/discursiva/tipos";

export const PROMPT_VERSAO_DISCURSIVA = "2026-10-16.1";

export interface AspectoPadrao {
  codigo: string;
  descricao: string;
  pontos: number;
}

export interface TemaParaPrompt {
  enunciado: string;
  textosApoio: { titulo: string; texto: string; fonte: string }[];
  padrao: { aspectos: AspectoPadrao[]; expectativas: string };
}

export const SISTEMA_EXAMINADOR = `Você é examinador da banca Cebraspe na correção de provas discursivas de concursos públicos.
Corrige com rigor e imparcialidade, seguindo apenas o padrão de resposta e os critérios do edital.
Não é generoso nem punitivo: cada nota precisa de justificativa que aponte o trecho do texto que a sustenta.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_REVISOR_LINGUA = `Você é revisor de Língua Portuguesa da banca Cebraspe na correção de provas discursivas.
Conta os erros de grafia, morfossintaxe e propriedade vocabular conforme a norma-padrão, sem considerar estilo ou conteúdo.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_TRANSCRITOR = `Você transcreve folhas de texto manuscritas de provas discursivas, linha por linha, com fidelidade absoluta.
Não corrige, não completa e não melhora o texto: copia exatamente o que está escrito, inclusive os erros.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_ELABORADOR_TEMA = `Você é elaborador de provas discursivas da banca Cebraspe para concursos públicos.
Cria propostas de redação inéditas, atuais e plausíveis, com padrão de resposta objetivo e avaliável.
Responda somente no formato estruturado pedido.`;

export const SISTEMA_REVISOR_TEMA = `Você revisa propostas de redação de concursos antes da publicação.
Verifica se o tema é atual, claro, plausível para a banca e se o padrão de resposta é coerente e avaliável.
Responda somente no formato estruturado pedido.`;

function blocoTema(t: TemaParaPrompt): string {
  const apoio = t.textosApoio.length
    ? `\n\nTextos de apoio:\n${t.textosApoio.map((a) => `- ${a.titulo}: ${a.texto} (${a.fonte})`).join("\n")}`
    : "";
  const aspectos = t.padrao.aspectos.map((a) => `- [${a.codigo}] ${a.descricao} (0 a ${a.pontos} pontos)`).join("\n");
  return `Proposta:\n${t.enunciado}${apoio}\n\nPadrão de resposta (aspectos e pontuação máxima de cada um):\n${aspectos}\n\nO que a banca espera:\n${t.padrao.expectativas}`;
}

function blocoLinhas(linhas: string[]): string {
  return linhas.map((l, i) => `${String(i + 1).padStart(2, "0")}| ${l}`).join("\n");
}

// `variante` muda a ordem de leitura pedida na terceira correção, para não repetir a mesma avaliação.
export function promptConteudo(p: { tema: TemaParaPrompt; linhas: string[]; variante?: "terceira" }): string {
  const terceira =
    p.variante === "terceira"
      ? "\nVocê é o terceiro examinador: as duas primeiras notas divergiram. Leia o texto inteiro antes de avaliar qualquer aspecto e decida com independência.\n"
      : "";
  return `${blocoTema(p.tema)}
${terceira}
Avalie o domínio do conteúdo (apresentação, estrutura textual e desenvolvimento do tema) do texto abaixo.
- Dê a cada aspecto do padrão uma nota de 0 até o máximo dele, com uma casa decimal, e uma justificativa curta que cite o trecho decisivo.
- Use exatamente os códigos dos aspectos do padrão.
- Não desconte erros de português aqui: eles são avaliados à parte.
- Marque \`fuga_tema\` como true somente se o texto não trata do tema proposto (abordar mal não é fugir do tema).
- Em \`comentario\`, resuma em até 3 frases o que mais pesou na nota.

Texto do candidato (linha numerada | conteúdo):
${blocoLinhas(p.linhas)}`;
}

export function promptLingua(p: { linhas: string[] }): string {
  const categorias = CATEGORIAS_ERRO.map((c) => `- ${c}: ${ROTULO_CATEGORIA[c]}`).join("\n");
  return `Aponte cada erro de Língua Portuguesa do texto abaixo, segundo a norma-padrão.
- \`linha\`: número da linha onde o erro está.
- \`trecho\`: cópia exata das palavras erradas, como estão na linha (sem corrigir).
- \`tipo\`: grafia (ortografia, acentuação, hífen), morfossintaxe (concordância, regência, crase, pontuação, colocação, flexão) ou propriedade_vocabular (palavra imprópria para o sentido).
- \`categoria\`: uma destas:
${categorias}
- \`correcao\`: como o trecho deveria estar.
- \`explicacao\`: a regra, em uma frase.
Conte cada ocorrência uma vez. Não aponte escolhas de estilo, repetições aceitáveis nem questões de conteúdo. Se não houver erros, devolva a lista vazia.

Texto do candidato (linha numerada | conteúdo):
${blocoLinhas(p.linhas)}`;
}

export function promptTranscricao(p: { linhasMax: number }): string {
  return `As imagens são a folha de texto definitivo de uma prova discursiva (se houver duas, a segunda continua a primeira).
Transcreva o texto linha por linha, na ordem, até no máximo ${p.linhasMax} linhas.
- Uma entrada em \`linhas\` para cada linha escrita da folha, inclusive linhas em branco entre parágrafos (texto vazio).
- Copie exatamente o que está escrito, com os erros, a pontuação e as palavras riscadas omitidas.
- Marque \`ilegivel\` como true na linha que você não conseguiu ler com segurança, e transcreva o melhor palpite.
- Ignore cabeçalho, numeração impressa das linhas e anotações fora da área de texto.`;
}

export function promptTema(p: {
  banca: string;
  concurso: string;
  disciplina: string;
  programa: string;
  pontuacaoMaxima: number;
  linhasMax: number;
  temasRecentes: string[];
}): string {
  const recentes = p.temasRecentes.length
    ? `\n\nNão repita estes temas já usados:\n${p.temasRecentes.map((t) => `- ${t}`).join("\n")}`
    : "";
  return `Crie uma proposta de redação inédita para a prova discursiva do concurso ${p.concurso} (banca ${p.banca}).
- Gênero: texto dissertativo de até ${p.linhasMax} linhas.
- Conteúdo cobrado: ${p.disciplina} — ${p.programa}.
- \`enunciado\`: o comando da prova, com o tema e de 2 a 4 tópicos que o candidato deve abordar, no estilo da banca.
- \`textos_apoio\`: 1 a 3 textos motivadores curtos (até 600 caracteres cada), com dados plausíveis e fonte genérica (ex.: "Adaptado de reportagem sobre ...").
- \`padrao_resposta.aspectos\`: o primeiro aspecto é "Apresentação e estrutura textual" com ${(p.pontuacaoMaxima * 0.1).toFixed(0)} pontos; os demais são um por tópico do enunciado, e a soma de todos os pontos é exatamente ${p.pontuacaoMaxima}. Códigos "1", "2.1", "2.2", ...
- \`padrao_resposta.expectativas\`: o que um texto nota máxima deve conter em cada tópico, de forma objetiva.${recentes}`;
}

export function promptAvaliarTema(p: { tema: TemaParaPrompt; pontuacaoMaxima: number }): string {
  return `${blocoTema(p.tema)}

Avalie esta proposta de redação. Aprove somente se:
- o tema é atual e plausível para uma prova da banca;
- o enunciado é claro e os tópicos são abordáveis em um texto de até 30 linhas;
- os textos de apoio não trazem dados absurdos nem tomam partido de forma que direcione a resposta;
- o padrão de resposta corresponde aos tópicos do enunciado e as pontuações somam ${p.pontuacaoMaxima}.
Liste em \`problemas\` cada falha encontrada (lista vazia se não houver).`;
}
```

`src/pipeline/discursiva/hash.ts`:

```ts
import { createHash } from "node:crypto";

// Mesmo hash da função SQL discursiva_importar_temas: md5(lower(regexp_replace(trim(enunciado), '\s+', ' ', 'g'))).
export function hashTema(enunciado: string): string {
  return createHash("md5").update(enunciado.trim().replace(/\s+/g, " ").toLowerCase()).digest("hex");
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline/discursiva && npm run typecheck`
Esperado: PASSA (4 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/discursiva
git commit -m "feat(discursiva): schemas, prompts e hash de tema"
```

---

### Tarefa 4: consolidação das correções na nota do edital

**Arquivos:**
- Criar: `src/pipeline/discursiva/consolidar.ts`
- Teste: `src/pipeline/discursiva/consolidar.test.ts`

**Interfaces:**
- Consome: `notaConteudo`, `calcularNPD`, `arredondar2`, `contarTL`, `filtrarErrosValidos`, `escolherPrioridades` (`@/core` via caminhos relativos) e os tipos da Tarefa 3.
- Produz:
  - `ResultadoCorrecao`: `{ nc, ne, tl, npd, zeradaMotivo, terceiraCorrecao, usadas: [number, number], aspectos: AspectoAvaliado[], erros: ErroLingua[], errosDescartados, prioridades }`;
  - `Consolidacao`;
  - `notasPorAspecto(c, aspectos)`;
  - `consolidarCorrecao({aspectos, pontuacaoMaxima, linhas, conteudos, lingua})`;
  - `resultadoSemTexto(aspectos)`.

- [ ] **Passo 1: Escrever o teste**

`src/pipeline/discursiva/consolidar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { consolidarCorrecao, notasPorAspecto, resultadoSemTexto } from "./consolidar";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

const aspectos = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];
const linhas = ["O Brasil precisa investir em prevenção.", "", "Os bombeiros chegou cedo ao local."];

function banca(notas: [number, number, number], fuga = false): CorrecaoConteudo {
  return {
    aspectos: aspectos.map((a, k) => ({ codigo: a.codigo, nota: notas[k], justificativa: "j" })),
    fuga_tema: fuga,
    comentario: "c",
  };
}

const semErros: CorrecaoLingua = { erros: [] };
const umErro: CorrecaoLingua = {
  erros: [
    { linha: 3, trecho: "bombeiros chegou", tipo: "morfossintaxe", categoria: "concordancia", correcao: "bombeiros chegaram", explicacao: "x" },
    { linha: 9, trecho: "inexistente", tipo: "grafia", categoria: "ortografia", correcao: "y", explicacao: "z" },
  ],
};

const base = { aspectos, pontuacaoMaxima: 30, linhas };

describe("notasPorAspecto", () => {
  it("ignora código desconhecido, zera ausente e limita ao máximo do aspecto", () => {
    const c: CorrecaoConteudo = {
      aspectos: [
        { codigo: " 1 ", nota: 5, justificativa: "" },
        { codigo: "9", nota: 10, justificativa: "" },
        { codigo: "2.2", nota: -1, justificativa: "" },
      ],
      fuga_tema: false,
      comentario: "",
    };
    expect(notasPorAspecto(c, aspectos)).toEqual([3, 0, 0]);
  });
});

describe("consolidarCorrecao", () => {
  it("duas notas convergentes: média, erros válidos e NPD", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 10, 8]), banca([2, 12, 9])], lingua: umErro });
    expect(r.precisaTerceira).toBe(false);
    if (r.precisaTerceira) return;
    // NC = (21 + 23) / 2 = 22; NE = 1 (o erro da linha 9 é descartado); TL = 2; NPD = 22 − 6 × 1 ÷ 2 = 19
    expect(r.resultado).toMatchObject({
      nc: 22,
      ne: 1,
      tl: 2,
      npd: 19,
      zeradaMotivo: null,
      terceiraCorrecao: false,
      usadas: [0, 1],
      errosDescartados: 1,
    });
    expect(r.resultado.aspectos.map((a) => a.nota)).toEqual([2.5, 11, 8.5]);
    expect(r.resultado.prioridades[0]).toMatchObject({ tipo: "aspecto", codigo: "2.2" });
  });

  it("notas divergentes pedem terceira correção", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 13, 13]), banca([1, 3, 3])], lingua: semErros });
    expect(r).toEqual({ precisaTerceira: true });
  });

  it("só uma banca apontando fuga ao tema pede terceira correção", () => {
    const r = consolidarCorrecao({ ...base, conteudos: [banca([3, 10, 10], true), banca([3, 10, 10])], lingua: semErros });
    expect(r).toEqual({ precisaTerceira: true });
  });

  it("com a terceira, usa as duas notas mais próximas", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([3, 13, 13]), banca([1, 3, 3]), banca([3, 12, 12])],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ nc: 28, usadas: [0, 2], terceiraCorrecao: true, npd: 28 });
  });

  it("fuga ao tema confirmada pelas duas correções usadas zera a nota", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([1, 2, 2], true), banca([2, 3, 3]), banca([1, 2, 3], true)],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ usadas: [0, 2], npd: 0, zeradaMotivo: "fuga_tema" });
  });

  it("fuga apontada só por uma das correções usadas não zera", () => {
    const r = consolidarCorrecao({
      ...base,
      conteudos: [banca([1, 2, 2], true), banca([3, 13, 13]), banca([1, 2, 3])],
      lingua: semErros,
    });
    if (r.precisaTerceira) throw new Error("não devia pedir outra correção");
    expect(r.resultado).toMatchObject({ usadas: [0, 2], zeradaMotivo: null });
  });
});

describe("resultadoSemTexto", () => {
  it("zera tudo com o motivo sem_texto", () => {
    expect(resultadoSemTexto(aspectos)).toMatchObject({ npd: 0, tl: 0, zeradaMotivo: "sem_texto", prioridades: [] });
    expect(resultadoSemTexto(aspectos).aspectos.map((a) => a.nota)).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/discursiva/consolidar.test.ts`
Esperado: FALHA (módulo não existe).

- [ ] **Passo 3: Implementar**

`src/pipeline/discursiva/consolidar.ts`:

```ts
import { filtrarErrosValidos } from "../../core/discursiva/erros";
import { contarTL } from "../../core/discursiva/linhas";
import { arredondar2, calcularNPD, notaConteudo } from "../../core/discursiva/nota";
import { escolherPrioridades, type AspectoAvaliado, type PrioridadeRedacao } from "../../core/discursiva/prioridades";
import type { ErroLingua, MotivoZero } from "../../core/discursiva/tipos";
import type { AspectoPadrao } from "./prompts";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

export interface ResultadoCorrecao {
  nc: number;
  ne: number;
  tl: number;
  npd: number;
  zeradaMotivo: MotivoZero | null;
  terceiraCorrecao: boolean;
  // Índices (em `conteudos`) das correções que entraram na nota.
  usadas: [number, number];
  aspectos: AspectoAvaliado[];
  erros: ErroLingua[];
  errosDescartados: number;
  prioridades: PrioridadeRedacao[];
}

export type Consolidacao = { precisaTerceira: true } | { precisaTerceira: false; resultado: ResultadoCorrecao };

// Nota de um examinador por aspecto: códigos desconhecidos são ignorados, ausentes valem 0, e cada nota fica entre 0 e o máximo.
export function notasPorAspecto(c: CorrecaoConteudo, aspectos: AspectoPadrao[]): number[] {
  const dadas = new Map(c.aspectos.map((a) => [a.codigo.trim(), a.nota]));
  return aspectos.map((a) => Math.min(a.pontos, Math.max(0, dadas.get(a.codigo) ?? 0)));
}

const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/**
 * Junta as correções de conteúdo (2 ou 3) e a de língua na nota final, pelas regras do edital (9.7.4 e 9.7.5).
 * Com 2 correções, pede a terceira se as notas divergirem ou se só uma apontar fuga ao tema.
 * Fuga ao tema só zera a nota quando as duas correções usadas concordam.
 */
export function consolidarCorrecao(e: {
  aspectos: AspectoPadrao[];
  pontuacaoMaxima: number;
  linhas: string[];
  conteudos: CorrecaoConteudo[];
  lingua: CorrecaoLingua;
}): Consolidacao {
  const porAspecto = e.conteudos.map((c) => notasPorAspecto(c, e.aspectos));
  const conteudo = notaConteudo(porAspecto.map(soma), e.pontuacaoMaxima);
  if (conteudo.precisaTerceira) return { precisaTerceira: true };
  if (e.conteudos.length === 2 && e.conteudos[0].fuga_tema !== e.conteudos[1].fuga_tema) return { precisaTerceira: true };

  const [i, j] = conteudo.usadas;
  const fugaTema = e.conteudos[i].fuga_tema && e.conteudos[j].fuga_tema;
  const tl = contarTL(e.linhas);
  const { validos, descartados } = filtrarErrosValidos(e.lingua.erros, e.linhas);
  const nc = arredondar2(conteudo.nc);
  const { npd, motivoZero } = calcularNPD({ nc, ne: validos.length, tl, fugaTema });
  const aspectos = e.aspectos.map((a, k) => ({ ...a, nota: arredondar2((porAspecto[i][k] + porAspecto[j][k]) / 2) }));

  return {
    precisaTerceira: false,
    resultado: {
      nc,
      ne: validos.length,
      tl,
      npd,
      zeradaMotivo: motivoZero,
      terceiraCorrecao: e.conteudos.length === 3,
      usadas: [i, j],
      aspectos,
      erros: validos,
      errosDescartados: descartados,
      prioridades: escolherPrioridades(aspectos, validos),
    },
  };
}

// Texto vazio: nota zero sem chamar IA (edital, 9.7.5, alínea f).
export function resultadoSemTexto(aspectos: AspectoPadrao[]): ResultadoCorrecao {
  return {
    nc: 0,
    ne: 0,
    tl: 0,
    npd: 0,
    zeradaMotivo: "sem_texto",
    terceiraCorrecao: false,
    usadas: [0, 1],
    aspectos: aspectos.map((a) => ({ ...a, nota: 0 })),
    erros: [],
    errosDescartados: 0,
    prioridades: [],
  };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline/discursiva/consolidar.test.ts`
Esperado: PASSA (8 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/discursiva/consolidar.ts src/pipeline/discursiva/consolidar.test.ts
git commit -m "feat(discursiva): consolidação das bancas na nota do edital"
```

---

### Tarefa 5: correção da redação

**Arquivos:**
- Criar: `src/pipeline/discursiva/tipos.ts`, `src/pipeline/discursiva/__fixtures__/repo-falso.ts`, `src/pipeline/discursiva/corrigir.ts`
- Teste: `src/pipeline/discursiva/corrigir.test.ts`

**Interfaces:**
- Produz:
  - **Tipos:** `PapelCorrecao`, `RedacaoParaProcessar`, `TranscricaoParaGravar`, `ContextoTema`.
  - **`RepositorioDiscursiva`:** com os métodos abaixo.
    - `carregarRedacao`, `correcoes`, `gravarCorrecao`, `marcarStatus`, `gravarResultado`;
    - `baixarFotos`, `gravarTranscricao`;
    - `contextoTema`, `gravarTema`;
    - `registrarUso`.
  - **`DepsDiscursiva`:** `{ provedores: [ProvedorIa, ProvedorIa]; repo; jobId }`.
  - **Fixture:** `criarRepoFalso(redacao?, feitas?)` → `{ repo, estado }` e `redacao(extra?)`.
  - **Correção:** `corrigirRedacao(deps, redacaoId): Promise<ResumoCorrecao>`.

- [ ] **Passo 1: Escrever tipos, fixture e teste**

`src/pipeline/discursiva/tipos.ts`:

```ts
import type { ImagemIa, ProvedorIa, UsoIa } from "../../ai/tipos";
import type { ConfigDiscursiva } from "../../core/discursiva/tipos";
import type { ResultadoCorrecao } from "./consolidar";
import type { TemaParaPrompt } from "./prompts";
import type { TemaGerado } from "./schemas";

export type PapelCorrecao = "conteudo_1" | "conteudo_2" | "conteudo_3" | "lingua" | "transcricao";

export interface RedacaoParaProcessar {
  id: string;
  usuarioId: string;
  status: string;
  linhas: string[];
  fotos: string[];
  tema: TemaParaPrompt;
  config: ConfigDiscursiva;
}

export type TranscricaoParaGravar =
  | { ok: true; linhas: string[]; excedente: string[] }
  | { ok: false; aviso: string };

export interface ContextoTema {
  banca: string;
  concurso: string;
  disciplina: string;
  programa: string;
  pontuacaoMaxima: number;
  linhasMax: number;
  temasRecentes: string[];
}

export interface RepositorioDiscursiva {
  carregarRedacao(id: string): Promise<RedacaoParaProcessar | null>;
  // Respostas já gravadas, por papel (o que torna a correção retomável sem pagar de novo).
  correcoes(redacaoId: string): Promise<Partial<Record<PapelCorrecao, unknown>>>;
  gravarCorrecao(redacaoId: string, papel: PapelCorrecao, uso: UsoIa, resposta: unknown): Promise<void>;
  marcarStatus(redacaoId: string, status: "corrigindo" | "falhou", aviso?: string): Promise<void>;
  gravarResultado(redacao: RedacaoParaProcessar, resultado: ResultadoCorrecao): Promise<void>;
  baixarFotos(caminhos: string[]): Promise<ImagemIa[]>;
  gravarTranscricao(redacao: RedacaoParaProcessar, transcricao: TranscricaoParaGravar): Promise<void>;
  contextoTema(concurso: string): Promise<ContextoTema>;
  // Devolve false quando já existe tema com o mesmo enunciado no concurso.
  gravarTema(concurso: string, tema: TemaGerado, status: "aprovado" | "revisao"): Promise<boolean>;
  registrarUso(uso: UsoIa, finalidade: string, jobId: string | null): Promise<void>;
}

export interface DepsDiscursiva {
  // [Claude, GPT]: as duas bancas de conteúdo são provedores diferentes, como os dois examinadores do edital.
  provedores: [ProvedorIa, ProvedorIa];
  repo: RepositorioDiscursiva;
  jobId: string | null;
}
```

`src/pipeline/discursiva/__fixtures__/repo-falso.ts`:

```ts
import type { UsoIa } from "../../../ai/tipos";
import type { ResultadoCorrecao } from "../consolidar";
import type { TemaGerado } from "../schemas";
import type { ContextoTema, PapelCorrecao, RedacaoParaProcessar, RepositorioDiscursiva, TranscricaoParaGravar } from "../tipos";

export const ASPECTOS = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];

export function redacao(extra: Partial<RedacaoParaProcessar> = {}): RedacaoParaProcessar {
  return {
    id: "r1",
    usuarioId: "u1",
    status: "na_fila",
    linhas: ["O Brasil precisa investir em prevenção.", "Os bombeiros chegou cedo."],
    fotos: [],
    tema: { enunciado: "Prevenção de incêndios", textosApoio: [], padrao: { aspectos: ASPECTOS, expectativas: "x" } },
    config: { pontuacaoMaxima: 30, linhasMax: 30, notaMinima: 15, caracteresPorLinha: 70 },
    ...extra,
  };
}

// Repositório em memória que registra tudo o que o pipeline grava.
export function criarRepoFalso(r: RedacaoParaProcessar | null = redacao(), feitas: Partial<Record<PapelCorrecao, unknown>> = {}) {
  const estado = {
    redacao: r,
    correcoes: { ...feitas } as Partial<Record<PapelCorrecao, unknown>>,
    status: [] as string[],
    resultado: null as ResultadoCorrecao | null,
    transcricao: null as TranscricaoParaGravar | null,
    temas: [] as { tema: TemaGerado; status: string }[],
    usos: [] as { finalidade: string; custo: number }[],
    fotosBaixadas: [] as string[],
  };
  const contexto: ContextoTema = {
    banca: "cebraspe",
    concurso: "CBM-AL 2026",
    disciplina: "Atualidades",
    programa: "Tópicos relevantes e atuais",
    pontuacaoMaxima: 30,
    linhasMax: 30,
    temasRecentes: ["Tema antigo"],
  };
  const repo: RepositorioDiscursiva = {
    async carregarRedacao() {
      return estado.redacao;
    },
    async correcoes() {
      return { ...estado.correcoes };
    },
    async gravarCorrecao(_id, papel, _uso: UsoIa, resposta) {
      estado.correcoes[papel] = resposta;
    },
    async marcarStatus(_id, status, aviso) {
      estado.status.push(aviso ? `${status}: ${aviso}` : status);
    },
    async gravarResultado(_r, resultado) {
      estado.resultado = resultado;
    },
    async baixarFotos(caminhos) {
      estado.fotosBaixadas.push(...caminhos);
      return caminhos.map(() => ({ midia: "image/jpeg" as const, base64: "QUJD" }));
    },
    async gravarTranscricao(_r, t) {
      estado.transcricao = t;
    },
    async contextoTema() {
      return contexto;
    },
    async gravarTema(_c, tema, status) {
      if (estado.temas.some((t) => t.tema.enunciado === tema.enunciado)) return false;
      estado.temas.push({ tema, status });
      return true;
    },
    async registrarUso(uso, finalidade) {
      estado.usos.push({ finalidade, custo: uso.custoUsd });
    },
  };
  return { repo, estado };
}
```

`src/pipeline/discursiva/corrigir.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { ErroPipeline } from "../gerar-lote";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { corrigirRedacao } from "./corrigir";
import type { CorrecaoConteudo, CorrecaoLingua } from "./schemas";

function banca(notas: [number, number, number], fuga = false): CorrecaoConteudo {
  return {
    aspectos: [
      { codigo: "1", nota: notas[0], justificativa: "j" },
      { codigo: "2.1", nota: notas[1], justificativa: "j" },
      { codigo: "2.2", nota: notas[2], justificativa: "j" },
    ],
    fuga_tema: fuga,
    comentario: "c",
  };
}
const lingua: CorrecaoLingua = {
  erros: [{ linha: 2, trecho: "bombeiros chegou", tipo: "morfossintaxe", categoria: "concordancia", correcao: "chegaram", explicacao: "x" }],
};

describe("corrigirRedacao", () => {
  it("roda as duas bancas e a língua, consolida e grava o resultado", async () => {
    // Claude responde na ordem de chamada: conteudo_1 e depois lingua (as etapas começam em paralelo, na ordem da lista).
    const claude = criarProvedorFalso("anthropic", [banca([3, 10, 8]), lingua]);
    const gpt = criarProvedorFalso("openai", [banca([2, 12, 9])]);
    const { repo, estado } = criarRepoFalso();
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: "j1" }, "r1");
    // NC 22; NE 1; TL 2 → NPD = 22 − 6 × 1 ÷ 2 = 19
    expect(r).toEqual({ status: "corrigida", npd: 19, terceiraCorrecao: false });
    expect(estado.status).toEqual(["corrigindo"]);
    expect(Object.keys(estado.correcoes).sort()).toEqual(["conteudo_1", "conteudo_2", "lingua"]);
    expect(estado.resultado).toMatchObject({ nc: 22, ne: 1, tl: 2 });
    expect(estado.usos.map((u) => u.finalidade).sort()).toEqual(["discursiva_conteudo", "discursiva_conteudo", "discursiva_lingua"]);
    expect(claude.pedidos[0].prompt).toContain("01| O Brasil precisa investir em prevenção.");
    expect(gpt.pedidos[0].prompt).not.toContain("terceiro examinador");
  });

  it("chama a terceira banca (Claude) só quando as notas divergem", async () => {
    const claude = criarProvedorFalso("anthropic", [banca([3, 13, 13]), lingua, banca([3, 12, 12])]);
    const gpt = criarProvedorFalso("openai", [banca([1, 3, 3])]);
    const { repo, estado } = criarRepoFalso();
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toMatchObject({ status: "corrigida", terceiraCorrecao: true });
    expect(estado.correcoes.conteudo_3).toBeDefined();
    expect(claude.pedidos[2].prompt).toContain("terceiro examinador");
    expect(estado.resultado).toMatchObject({ nc: 28, usadas: [0, 2] });
  });

  it("retoma sem refazer as etapas já gravadas", async () => {
    const claude = criarProvedorFalso("anthropic", [lingua]);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ status: "corrigindo" }), {
      conteudo_1: banca([3, 10, 8]),
      conteudo_2: banca([2, 12, 9]),
    });
    await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(claude.pedidos).toHaveLength(1);
    expect(gpt.pedidos).toHaveLength(0);
    expect(estado.resultado).toMatchObject({ npd: 19 });
  });

  it("grava o que deu certo e falha para tentar de novo quando uma etapa falha", async () => {
    const claude = criarProvedorFalso("anthropic", [banca([3, 10, 8]), lingua]);
    const gpt = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora do ar")]);
    const { repo, estado } = criarRepoFalso();
    await expect(
      corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1"),
    ).rejects.toThrow(/conteudo_2: fora do ar/);
    expect(Object.keys(estado.correcoes).sort()).toEqual(["conteudo_1", "lingua"]);
    expect(estado.resultado).toBeNull();
  });

  it("texto vazio recebe zero sem chamar IA", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ linhas: ["", "  "] }));
    const r = await corrigirRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "corrigida", npd: 0, terceiraCorrecao: false });
    expect(estado.resultado?.zeradaMotivo).toBe("sem_texto");
    expect(claude.pedidos).toHaveLength(0);
  });

  it("ignora redação já corrigida e recusa estado fora da fila", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const gpt = criarProvedorFalso("openai", []);
    const deps = (status: string) => ({
      provedores: [claude.provedor, gpt.provedor] as [typeof claude.provedor, typeof gpt.provedor],
      repo: criarRepoFalso(redacao({ status })).repo,
      jobId: null,
    });
    expect(await corrigirRedacao(deps("corrigida"), "r1")).toEqual({ status: "ignorada", motivo: "já corrigida" });
    const erro = await corrigirRedacao(deps("rascunho"), "r1").catch((e) => e);
    expect(erro).toBeInstanceOf(ErroPipeline);
    expect(erro.definitivo).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/discursiva/corrigir.test.ts`
Esperado: FALHA (módulo `./corrigir` não existe).

- [ ] **Passo 3: Implementar**

`src/pipeline/discursiva/corrigir.ts`:

```ts
import { ErroIa, type ProvedorIa } from "../../ai/tipos";
import { contarTL } from "../../core/discursiva/linhas";
import { ErroPipeline } from "../gerar-lote";
import { consolidarCorrecao, resultadoSemTexto, type ResultadoCorrecao } from "./consolidar";
import { promptConteudo, promptLingua, SISTEMA_EXAMINADOR, SISTEMA_REVISOR_LINGUA } from "./prompts";
import { correcaoConteudoSchema, correcaoLinguaSchema, type CorrecaoConteudo, type CorrecaoLingua } from "./schemas";
import type { DepsDiscursiva, PapelCorrecao, RedacaoParaProcessar } from "./tipos";

export type ResumoCorrecao =
  | { status: "corrigida"; npd: number; terceiraCorrecao: boolean }
  | { status: "ignorada"; motivo: string };

interface Etapa {
  papel: PapelCorrecao;
  provedor: ProvedorIa;
  finalidade: string;
  pedir(p: ProvedorIa): ReturnType<ProvedorIa["gerarJson"]>;
}

function etapaConteudo(r: RedacaoParaProcessar, papel: PapelCorrecao, provedor: ProvedorIa): Etapa {
  return {
    papel,
    provedor,
    finalidade: "discursiva_conteudo",
    pedir: (p) =>
      p.gerarJson({
        finalidade: "discursiva_conteudo",
        sistema: SISTEMA_EXAMINADOR,
        prompt: promptConteudo({ tema: r.tema, linhas: r.linhas, variante: papel === "conteudo_3" ? "terceira" : undefined }),
        schema: correcaoConteudoSchema,
        nomeSchema: "correcao_conteudo",
      }),
  };
}

function etapaLingua(r: RedacaoParaProcessar, provedor: ProvedorIa): Etapa {
  return {
    papel: "lingua",
    provedor,
    finalidade: "discursiva_lingua",
    pedir: (p) =>
      p.gerarJson({
        finalidade: "discursiva_lingua",
        sistema: SISTEMA_REVISOR_LINGUA,
        prompt: promptLingua({ linhas: r.linhas }),
        schema: correcaoLinguaSchema,
        nomeSchema: "correcao_lingua",
      }),
  };
}

// Roda as etapas em paralelo; grava cada resposta assim que chega e registra o custo mesmo das que falham.
async function executarEtapas(deps: DepsDiscursiva, redacaoId: string, etapas: Etapa[]): Promise<void> {
  const resultados = await Promise.allSettled(
    etapas.map(async (e) => {
      try {
        const r = await e.pedir(e.provedor);
        // Grava a resposta antes do custo: uma falha no registro de uso não perde uma resposta já paga.
        await deps.repo.gravarCorrecao(redacaoId, e.papel, r.uso, r.dados);
        await deps.repo.registrarUso(r.uso, e.finalidade, deps.jobId);
      } catch (erro) {
        if (erro instanceof ErroIa && erro.uso) await deps.repo.registrarUso(erro.uso, e.finalidade, deps.jobId);
        throw erro;
      }
    }),
  );
  const falhas = resultados.flatMap((r, i) =>
    r.status === "rejected" ? [`${etapas[i].papel}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : [],
  );
  if (falhas.length) throw new ErroPipeline(`Correção incompleta: ${falhas.join("; ")}`);
}

/**
 * Corrige uma redação entregue: duas bancas de conteúdo independentes (Claude e GPT) e a revisão de língua em paralelo,
 * a terceira correção quando o edital exige, e a nota final calculada pelo código. Etapas já gravadas não são refeitas.
 */
export async function corrigirRedacao(deps: DepsDiscursiva, redacaoId: string): Promise<ResumoCorrecao> {
  const r = await deps.repo.carregarRedacao(redacaoId);
  if (!r) throw new ErroPipeline(`Redação ${redacaoId} não encontrada`, true);
  if (r.status === "corrigida") return { status: "ignorada", motivo: "já corrigida" };
  if (r.status !== "na_fila" && r.status !== "corrigindo") {
    throw new ErroPipeline(`Redação ${redacaoId} não está na fila (estado ${r.status})`, true);
  }
  await deps.repo.marcarStatus(r.id, "corrigindo");

  let resultado: ResultadoCorrecao;
  if (contarTL(r.linhas) === 0) {
    resultado = resultadoSemTexto(r.tema.padrao.aspectos);
  } else {
    const [claude, gpt] = deps.provedores;
    let feitas = await deps.repo.correcoes(r.id);
    const pendentes = [
      etapaConteudo(r, "conteudo_1", claude),
      etapaConteudo(r, "conteudo_2", gpt),
      etapaLingua(r, claude),
    ].filter((e) => feitas[e.papel] === undefined);
    if (pendentes.length) {
      await executarEtapas(deps, r.id, pendentes);
      feitas = await deps.repo.correcoes(r.id);
    }

    const conteudos: CorrecaoConteudo[] = [
      correcaoConteudoSchema.parse(feitas.conteudo_1),
      correcaoConteudoSchema.parse(feitas.conteudo_2),
    ];
    const lingua: CorrecaoLingua = correcaoLinguaSchema.parse(feitas.lingua);
    const entrada = { aspectos: r.tema.padrao.aspectos, pontuacaoMaxima: r.config.pontuacaoMaxima, linhas: r.linhas, lingua };

    let consolidacao = consolidarCorrecao({ ...entrada, conteudos });
    if (consolidacao.precisaTerceira) {
      if (feitas.conteudo_3 === undefined) {
        await executarEtapas(deps, r.id, [etapaConteudo(r, "conteudo_3", claude)]);
        feitas = await deps.repo.correcoes(r.id);
      }
      conteudos.push(correcaoConteudoSchema.parse(feitas.conteudo_3));
      consolidacao = consolidarCorrecao({ ...entrada, conteudos });
    }
    if (consolidacao.precisaTerceira) throw new ErroPipeline("Correção sem consolidação após a terceira banca", true);
    resultado = consolidacao.resultado;
  }

  await deps.repo.gravarResultado(r, resultado);
  return { status: "corrigida", npd: resultado.npd, terceiraCorrecao: resultado.terceiraCorrecao };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline/discursiva && npm run typecheck`
Esperado: PASSA (6 testes novos).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/discursiva
git commit -m "feat(discursiva): correção com duas bancas, língua e terceira correção"
```

---

### Tarefa 6: transcrição da foto e geração de tema

**Arquivos:**
- Criar: `src/pipeline/discursiva/transcrever.ts`, `src/pipeline/discursiva/gerar-tema.ts`
- Testes: `src/pipeline/discursiva/transcrever.test.ts`, `src/pipeline/discursiva/gerar-tema.test.ts`

**Interfaces:**
- Produz:
  - **Transcrição:** `LIMITE_ILEGIVEIS = 0.2`, `avaliarTranscricao(t, linhasMax): TranscricaoParaGravar`, `transcreverRedacao(deps, id): Promise<ResumoTranscricao>`.
  - **Tema:** `problemasDoPadrao(tema, pontuacaoMaxima): string[]`, `gerarTema(deps, concurso): Promise<ResumoTema>`.

- [ ] **Passo 1: Escrever os testes**

`src/pipeline/discursiva/transcrever.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { avaliarTranscricao, transcreverRedacao } from "./transcrever";

const l = (texto: string, ilegivel = false) => ({ texto, ilegivel });

describe("avaliarTranscricao", () => {
  it("aceita até 20% de linhas ilegíveis e tira as linhas em branco do fim", () => {
    const t = { linhas: [l(" a "), l(""), l("b"), l("c"), l("d"), l("e", true), l(""), l("")] };
    expect(avaliarTranscricao(t, 30)).toEqual({ ok: true, linhas: ["a", "", "b", "c", "d", "e"], excedente: [] });
  });

  it("pede outra foto acima de 20% de linhas ilegíveis", () => {
    const t = { linhas: [l("a"), l("b", true), l("c"), l("d", true)] };
    expect(avaliarTranscricao(t, 30)).toEqual({
      ok: false,
      aviso: "A foto ficou difícil de ler (2 de 4 linhas). Envie outra, com boa luz e a folha inteira.",
    });
  });

  it("pede outra foto quando não há texto", () => {
    expect(avaliarTranscricao({ linhas: [l(""), l(" ")] }, 30).ok).toBe(false);
  });

  it("separa o que passa do máximo de linhas", () => {
    expect(avaliarTranscricao({ linhas: [l("a"), l("b"), l("c")] }, 2)).toEqual({ ok: true, linhas: ["a", "b"], excedente: ["c"] });
  });
});

describe("transcreverRedacao", () => {
  it("envia as fotos ao Claude, guarda a resposta e a transcrição", async () => {
    const claude = criarProvedorFalso("anthropic", [{ linhas: [l("Texto da folha.")] }]);
    const gpt = criarProvedorFalso("openai", []);
    const { repo, estado } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    const r = await transcreverRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "transcrita", ok: true });
    expect(estado.fotosBaixadas).toEqual(["u1/r1/1.jpg"]);
    expect(claude.pedidos[0].imagens).toHaveLength(1);
    expect(estado.correcoes.transcricao).toEqual({ linhas: [l("Texto da folha.")] });
    expect(estado.transcricao).toEqual({ ok: true, linhas: ["Texto da folha."], excedente: [] });
  });

  it("usa o GPT de reserva quando o Claude falha", async () => {
    const claude = criarProvedorFalso("anthropic", [new ErroIa("anthropic", "api", "erro")]);
    const gpt = criarProvedorFalso("openai", [{ linhas: [l("Texto.")] }]);
    const { repo } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    await transcreverRedacao({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "r1");
    expect(gpt.pedidos[0].imagens).toHaveLength(1);
  });

  it("ignora redação que não está esperando transcrição", async () => {
    const claude = criarProvedorFalso("anthropic", []);
    const { repo } = criarRepoFalso(redacao({ status: "rascunho" }));
    const r = await transcreverRedacao({ provedores: [claude.provedor, claude.provedor], repo, jobId: null }, "r1");
    expect(r).toEqual({ status: "ignorada", motivo: "estado rascunho" });
  });
});
```

`src/pipeline/discursiva/gerar-tema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import { criarRepoFalso } from "./__fixtures__/repo-falso";
import { gerarTema, problemasDoPadrao } from "./gerar-tema";
import type { TemaGerado } from "./schemas";

function tema(pontos: number[] = [3, 13.5, 13.5]): TemaGerado {
  return {
    enunciado: "  Prevenção de desastres climáticos ",
    textos_apoio: [{ titulo: "Texto I", texto: "Dados.", fonte: "Adaptado" }],
    padrao_resposta: {
      aspectos: pontos.map((p, i) => ({ codigo: i === 0 ? "1" : ` 2.${i} `, descricao: `A${i}`, pontos: p })),
      expectativas: "x",
    },
  };
}

describe("problemasDoPadrao", () => {
  it("aceita padrão com pontuação que soma o máximo", () => {
    expect(problemasDoPadrao(tema(), 30)).toEqual([]);
  });

  it("aponta soma errada, aspecto sem pontos e códigos repetidos", () => {
    const t = tema([3, 0, 13.5]);
    t.padrao_resposta.aspectos[2].codigo = "1";
    expect(problemasDoPadrao(t, 30)).toEqual([
      "códigos de aspecto repetidos",
      "aspecto sem pontuação positiva",
      "pontuações somam 16.5, não 30",
    ]);
  });
});

describe("gerarTema", () => {
  it("Claude gera, GPT avalia; aprovado vai direto para os alunos", async () => {
    const claude = criarProvedorFalso("anthropic", [tema()]);
    const gpt = criarProvedorFalso("openai", [{ aprovado: true, problemas: [] }]);
    const { repo, estado } = criarRepoFalso();
    const r = await gerarTema({ provedores: [claude.provedor, gpt.provedor], repo, jobId: "j" }, "cbmal-2026");
    expect(r).toEqual({ status: "aprovado", gravado: true, problemas: [], gerador: "anthropic", avaliador: "openai" });
    expect(estado.temas[0].tema.enunciado).toBe("Prevenção de desastres climáticos");
    expect(estado.temas[0].tema.padrao_resposta.aspectos[1].codigo).toBe("2.1");
    expect(claude.pedidos[0].prompt).toContain("- Tema antigo");
  });

  it("vai para revisão quando a avaliação reprova ou o padrão tem problema", async () => {
    const claude = criarProvedorFalso("anthropic", [tema(), tema([3, 10, 10])]);
    const gpt = criarProvedorFalso("openai", [{ aprovado: false, problemas: ["tema datado"] }, { aprovado: true, problemas: [] }]);
    const { repo } = criarRepoFalso();
    const deps = { provedores: [claude.provedor, gpt.provedor] as [typeof claude.provedor, typeof gpt.provedor], repo, jobId: null };
    expect(await gerarTema(deps, "c")).toMatchObject({ status: "revisao", problemas: ["tema datado"] });
    const t = tema([3, 10, 10]);
    t.enunciado = "Outro tema";
    const claude2 = criarProvedorFalso("anthropic", [t]);
    const r = await gerarTema({ ...deps, provedores: [claude2.provedor, gpt.provedor] }, "c");
    expect(r).toMatchObject({ status: "revisao", problemas: ["pontuações somam 23, não 30"] });
  });

  it("se o GPT não puder avaliar, o próprio Claude avalia e o tema vai para revisão", async () => {
    const claude = criarProvedorFalso("anthropic", [tema(), { aprovado: true, problemas: [] }]);
    const gpt = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora")]);
    const { repo } = criarRepoFalso();
    const r = await gerarTema({ provedores: [claude.provedor, gpt.provedor], repo, jobId: null }, "c");
    expect(r).toMatchObject({ status: "revisao", avaliador: "anthropic" });
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/discursiva`
Esperado: FALHA (módulos não existem).

- [ ] **Passo 3: Implementar**

`src/pipeline/discursiva/transcrever.ts`:

```ts
import { chamarComReserva, ErroPipeline } from "../gerar-lote";
import { promptTranscricao, SISTEMA_TRANSCRITOR } from "./prompts";
import { transcricaoSchema, type Transcricao } from "./schemas";
import type { DepsDiscursiva, TranscricaoParaGravar } from "./tipos";

// Acima desta fração de linhas ilegíveis, pedimos outra foto em vez de corrigir uma transcrição ruim.
export const LIMITE_ILEGIVEIS = 0.2;

export function avaliarTranscricao(t: Transcricao, linhasMax: number): TranscricaoParaGravar {
  const linhas = t.linhas.map((l) => ({ texto: l.texto.trim(), ilegivel: l.ilegivel }));
  while (linhas.length > 0 && linhas[linhas.length - 1].texto === "") linhas.pop();
  const escritas = linhas.filter((l) => l.texto !== "");
  if (escritas.length === 0) {
    return { ok: false, aviso: "Não encontramos texto na foto. Envie uma foto da folha de texto definitivo." };
  }
  const ilegiveis = escritas.filter((l) => l.ilegivel).length;
  if (ilegiveis / escritas.length > LIMITE_ILEGIVEIS) {
    return {
      ok: false,
      aviso: `A foto ficou difícil de ler (${ilegiveis} de ${escritas.length} linhas). Envie outra, com boa luz e a folha inteira.`,
    };
  }
  const textos = linhas.map((l) => l.texto);
  return { ok: true, linhas: textos.slice(0, linhasMax), excedente: textos.slice(linhasMax) };
}

export type ResumoTranscricao = { status: "transcrita"; ok: boolean } | { status: "ignorada"; motivo: string };

// Lê as fotos da folha (Claude, com o GPT de reserva) e deixa a transcrição para o usuário conferir.
export async function transcreverRedacao(deps: DepsDiscursiva, redacaoId: string): Promise<ResumoTranscricao> {
  const r = await deps.repo.carregarRedacao(redacaoId);
  if (!r) throw new ErroPipeline(`Redação ${redacaoId} não encontrada`, true);
  if (r.status !== "transcrevendo") return { status: "ignorada", motivo: `estado ${r.status}` };
  if (r.fotos.length === 0) throw new ErroPipeline(`Redação ${redacaoId} sem fotos`, true);

  const imagens = await deps.repo.baixarFotos(r.fotos);
  const resposta = await chamarComReserva(deps, deps.provedores, "discursiva_transcricao", { total: 0 }, (p) =>
    p.gerarJson({
      finalidade: "discursiva_transcricao",
      sistema: SISTEMA_TRANSCRITOR,
      prompt: promptTranscricao({ linhasMax: r.config.linhasMax }),
      schema: transcricaoSchema,
      nomeSchema: "transcricao",
      imagens,
    }),
  );
  await deps.repo.gravarCorrecao(r.id, "transcricao", resposta.uso, resposta.dados);
  const avaliacao = avaliarTranscricao(resposta.dados, r.config.linhasMax);
  await deps.repo.gravarTranscricao(r, avaliacao);
  return { status: "transcrita", ok: avaliacao.ok };
}
```

`src/pipeline/discursiva/gerar-tema.ts`:

```ts
import { chamarComReserva } from "../gerar-lote";
import {
  promptAvaliarTema,
  promptTema,
  SISTEMA_ELABORADOR_TEMA,
  SISTEMA_REVISOR_TEMA,
  type TemaParaPrompt,
} from "./prompts";
import { avaliacaoTemaSchema, temaGeradoSchema, type TemaGerado } from "./schemas";
import type { DepsDiscursiva } from "./tipos";

// Problemas que o código detecta sozinho no padrão de resposta (o tema vai para revisão se houver algum).
export function problemasDoPadrao(tema: TemaGerado, pontuacaoMaxima: number): string[] {
  const problemas: string[] = [];
  const aspectos = tema.padrao_resposta.aspectos;
  if (tema.enunciado.trim() === "") problemas.push("enunciado vazio");
  if (aspectos.length < 2) problemas.push("padrão com menos de 2 aspectos");
  if (new Set(aspectos.map((a) => a.codigo.trim())).size !== aspectos.length) problemas.push("códigos de aspecto repetidos");
  if (aspectos.some((a) => !(a.pontos > 0))) problemas.push("aspecto sem pontuação positiva");
  const soma = aspectos.reduce((s, a) => s + a.pontos, 0);
  if (Math.abs(soma - pontuacaoMaxima) > 0.01) problemas.push(`pontuações somam ${soma}, não ${pontuacaoMaxima}`);
  return problemas;
}

function paraPrompt(t: TemaGerado): TemaParaPrompt {
  return { enunciado: t.enunciado, textosApoio: t.textos_apoio, padrao: t.padrao_resposta };
}

export interface ResumoTema {
  status: "aprovado" | "revisao";
  gravado: boolean;
  problemas: string[];
  gerador: string;
  avaliador: string;
}

// Uma IA cria o tema e o padrão de resposta; a outra avalia. Só vai para os alunos se a avaliação e o código aprovarem.
export async function gerarTema(deps: DepsDiscursiva, concurso: string): Promise<ResumoTema> {
  const ctx = await deps.repo.contextoTema(concurso);
  const [a, b] = deps.provedores;
  const custo = { total: 0 };
  const geracao = await chamarComReserva(deps, [a, b], "discursiva_tema", custo, (p) =>
    p.gerarJson({
      finalidade: "discursiva_tema",
      sistema: SISTEMA_ELABORADOR_TEMA,
      prompt: promptTema(ctx),
      schema: temaGeradoSchema,
      nomeSchema: "tema_redacao",
    }),
  );
  const tema: TemaGerado = {
    enunciado: geracao.dados.enunciado.trim(),
    textos_apoio: geracao.dados.textos_apoio,
    padrao_resposta: {
      aspectos: geracao.dados.padrao_resposta.aspectos.map((x) => ({ ...x, codigo: x.codigo.trim() })),
      expectativas: geracao.dados.padrao_resposta.expectativas,
    },
  };
  const outro = geracao.provedor === a ? b : a;
  const avaliacao = await chamarComReserva(deps, [outro, geracao.provedor], "discursiva_tema_avaliacao", custo, (p) =>
    p.gerarJson({
      finalidade: "discursiva_tema_avaliacao",
      sistema: SISTEMA_REVISOR_TEMA,
      prompt: promptAvaliarTema({ tema: paraPrompt(tema), pontuacaoMaxima: ctx.pontuacaoMaxima }),
      schema: avaliacaoTemaSchema,
      nomeSchema: "avaliacao_tema",
    }),
  );

  const doPadrao = problemasDoPadrao(tema, ctx.pontuacaoMaxima);
  const independente = avaliacao.provedor !== geracao.provedor;
  const status = avaliacao.dados.aprovado && independente && doPadrao.length === 0 ? "aprovado" : "revisao";
  const problemas = [...doPadrao, ...avaliacao.dados.problemas];
  const gravado = await deps.repo.gravarTema(concurso, tema, status);
  return { status, gravado, problemas, gerador: geracao.provedor.nome, avaliador: avaliacao.provedor.nome };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline/discursiva && npm run typecheck`
Esperado: PASSA (7 testes de transcrição e 5 de tema).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/discursiva
git commit -m "feat(discursiva): transcrição da foto e geração de tema com avaliação cruzada"
```

---

### Tarefa 7: processadores dos jobs da discursiva

**Arquivos:**
- Criar: `src/pipeline/discursiva/jobs.ts`
- Teste: `src/pipeline/discursiva/jobs.test.ts`

**Interfaces:**
- Consome: `MAX_TENTATIVAS`, `Job`, `ProcessadorJob` (Tarefa 2); `corrigirRedacao`, `transcreverRedacao`, `gerarTema`.
- Produz:
  - `payloadRedacaoSchema`, `payloadTemaSchema`;
  - `AVISO_CORRECAO_FALHOU`, `AVISO_TRANSCRICAO_FALHOU`;
  - `processadoresDiscursiva(base: Omit<DepsDiscursiva, "jobId">): Record<string, ProcessadorJob>`, com as chaves `corrigir_redacao`, `transcrever_redacao` e `gerar_tema`.
- Na última tentativa (`job.tentativas >= MAX_TENTATIVAS`) ou em erro definitivo, a redação sai da fila com aviso:
  - correção: vai para `falhou`;
  - transcrição: volta ao rascunho e as fotos são apagadas.

- [ ] **Passo 1: Escrever o teste**

`src/pipeline/discursiva/jobs.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { criarProvedorFalso } from "../../ai/falso";
import { ErroIa } from "../../ai/tipos";
import type { Job } from "../executar-job";
import { ErroPipeline } from "../gerar-lote";
import { criarRepoFalso, redacao } from "./__fixtures__/repo-falso";
import { AVISO_CORRECAO_FALHOU, AVISO_TRANSCRICAO_FALHOU, processadoresDiscursiva } from "./jobs";

const job = (tipo: string, payload: unknown, tentativas = 1): Job => ({ id: "j1", tipo, payload, tentativas });
const falha = (nome: "anthropic" | "openai") => criarProvedorFalso(nome, [new ErroIa(nome, "api", "fora"), new ErroIa(nome, "api", "fora")]);

describe("processadoresDiscursiva", () => {
  it("corrige a redação do payload", async () => {
    const { repo, estado } = criarRepoFalso(redacao({ linhas: [] }));
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    expect(await p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }))).toMatchObject({ status: "corrigida", npd: 0 });
    expect(estado.resultado?.zeradaMotivo).toBe("sem_texto");
  });

  it("só marca a redação como falhou na última tentativa", async () => {
    const { repo, estado } = criarRepoFalso();
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    await expect(p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }, 1))).rejects.toThrow();
    expect(estado.status).toEqual(["corrigindo"]);
    await expect(p.corrigir_redacao(job("corrigir_redacao", { redacao_id: "r1" }, 3))).rejects.toThrow();
    expect(estado.status.at(-1)).toBe(`falhou: ${AVISO_CORRECAO_FALHOU}`);
  });

  it("transcrição que falha de vez volta ao rascunho com aviso", async () => {
    const { repo, estado } = criarRepoFalso(redacao({ status: "transcrevendo", fotos: ["u1/r1/1.jpg"] }));
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    await expect(p.transcrever_redacao(job("transcrever_redacao", { redacao_id: "r1" }, 3))).rejects.toThrow();
    expect(estado.transcricao).toEqual({ ok: false, aviso: AVISO_TRANSCRICAO_FALHOU });
  });

  it("recusa payload inválido de vez", async () => {
    const { repo } = criarRepoFalso();
    const p = processadoresDiscursiva({ provedores: [falha("anthropic").provedor, falha("openai").provedor], repo });
    const erro = await p.gerar_tema(job("gerar_tema", {})).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPipeline);
    expect((erro as ErroPipeline).definitivo).toBe(true);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/pipeline/discursiva/jobs.test.ts`
Esperado: FALHA (módulo não existe).

- [ ] **Passo 3: Implementar**

`src/pipeline/discursiva/jobs.ts`:

```ts
import { z } from "zod/v4";
import { MAX_TENTATIVAS, type Job, type ProcessadorJob } from "../executar-job";
import { ErroPipeline } from "../gerar-lote";
import { corrigirRedacao } from "./corrigir";
import { gerarTema } from "./gerar-tema";
import { transcreverRedacao } from "./transcrever";
import type { DepsDiscursiva } from "./tipos";

export const payloadRedacaoSchema = z.object({ redacao_id: z.string().min(1) });
export const payloadTemaSchema = z.object({ concurso: z.string().min(1) });

export const AVISO_CORRECAO_FALHOU = "Não conseguimos corrigir agora. Seu texto está salvo: tente de novo em alguns minutos.";
export const AVISO_TRANSCRICAO_FALHOU = "Não conseguimos ler a foto agora. Envie de novo em alguns minutos.";

function redacaoDoJob(job: Job): string {
  const p = payloadRedacaoSchema.safeParse(job.payload);
  if (!p.success) throw new ErroPipeline(`Payload inválido: ${p.error.message}`, true);
  return p.data.redacao_id;
}

// Na última tentativa (ou em erro definitivo), a redação sai da fila com um aviso, para o usuário não esperar à toa.
function ultimaTentativa(job: Job, e: unknown): boolean {
  return (e instanceof ErroPipeline && e.definitivo) || job.tentativas >= MAX_TENTATIVAS;
}

export function processadoresDiscursiva(base: Omit<DepsDiscursiva, "jobId">): Record<string, ProcessadorJob> {
  return {
    async corrigir_redacao(job) {
      const id = redacaoDoJob(job);
      try {
        return await corrigirRedacao({ ...base, jobId: job.id }, id);
      } catch (e) {
        if (ultimaTentativa(job, e)) await base.repo.marcarStatus(id, "falhou", AVISO_CORRECAO_FALHOU);
        throw e;
      }
    },
    async transcrever_redacao(job) {
      const id = redacaoDoJob(job);
      try {
        return await transcreverRedacao({ ...base, jobId: job.id }, id);
      } catch (e) {
        if (ultimaTentativa(job, e)) {
          const r = await base.repo.carregarRedacao(id);
          if (r) await base.repo.gravarTranscricao(r, { ok: false, aviso: AVISO_TRANSCRICAO_FALHOU });
        }
        throw e;
      }
    },
    async gerar_tema(job) {
      const p = payloadTemaSchema.safeParse(job.payload);
      if (!p.success) throw new ErroPipeline(`Payload inválido: ${p.error.message}`, true);
      return gerarTema({ ...base, jobId: job.id }, p.data.concurso);
    },
  };
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/pipeline && npm run typecheck && npm run lint && npm test`
Esperado: tudo passa (4 testes novos).

- [ ] **Passo 5: Commit**

```bash
git add src/pipeline/discursiva/jobs.ts src/pipeline/discursiva/jobs.test.ts
git commit -m "feat(discursiva): processadores dos jobs de correção, transcrição e tema"
```

---

### Tarefa 8 (controlador): repositório Supabase, migração 0010 e worker

Feita pelo controlador, não por agente.

**Arquivos:**
- Criar: `supabase/migrations/0010_redacoes_detalhes.sql`, `src/db/repositorios/discursiva.ts`
- Modificar: `src/db/types.ts` (coluna `detalhes`), `src/app/api/jobs/worker/route.ts`

**Interfaces:**
- Produz:
  - `criarRepositorioDiscursiva(db): RepositorioDiscursiva`;
  - `limparFotosVencidas(db, limite = 20): Promise<number>`;
  - `BUCKET_FOTOS`.
- **`redacoes.detalhes`:** `{ aspectos: [{codigo, descricao, pontos, nota}], usadas: [papel, papel], erros_descartados }`, para a tela de resultado (etapa 3).

- [ ] **Passo 1: Migração**

`supabase/migrations/0010_redacoes_detalhes.sql`:

```sql
-- Detalhes da nota consolidada da redação, para a tela de resultado:
-- {aspectos: [{codigo, descricao, pontos, nota}], usadas: [papel, papel], erros_descartados}.
alter table public.redacoes add column detalhes jsonb;
```

Aplicar no remoto com `apply_migration` (nome `0010_redacoes_detalhes`) e acrescentar `detalhes: Json | null` (Row) e `detalhes?: Json | null` (Insert e Update) em `redacoes` no `src/db/types.ts`.

- [ ] **Passo 2: Repositório**

`src/db/repositorios/discursiva.ts`:

```ts
import { z } from "zod/v4";
import { CANONICO_POR_CATEGORIA } from "../../core/discursiva/erros";
import type { ImagemIa } from "../../ai/tipos";
import { hashTema } from "../../pipeline/discursiva/hash";
import type { PapelCorrecao, RepositorioDiscursiva } from "../../pipeline/discursiva/tipos";
import type { ClienteServico } from "../supabase/servico";
import type { Json } from "../types";
import { criarRepositorioPipeline } from "./pipeline";

export const BUCKET_FOTOS = "redacoes-fotos";
const DIAS_GUARDAR_FOTOS = 30;
const PAPEIS: PapelCorrecao[] = ["conteudo_1", "conteudo_2", "conteudo_3", "lingua", "transcricao"];

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

const temaSchema = z.object({
  enunciado: z.string(),
  textos_apoio: z.array(z.object({ titulo: z.string().default(""), texto: z.string(), fonte: z.string().default("") })),
  padrao_resposta: z.object({
    aspectos: z.array(z.object({ codigo: z.string(), descricao: z.string(), pontos: z.number() })),
    expectativas: z.string().default(""),
  }),
});

const configSchema = z.object({
  pontuacao_maxima: z.number(),
  linhas_max: z.number(),
  nota_minima: z.number(),
  caracteres_por_linha: z.number().default(70),
});

function daquiADias(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString();
}

function midiaDoCaminho(caminho: string): ImagemIa["midia"] {
  const ext = caminho.toLowerCase().split(".").pop();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export function criarRepositorioDiscursiva(db: ClienteServico): RepositorioDiscursiva {
  const pipeline = criarRepositorioPipeline(db);

  async function idsDoConcurso(concurso: string) {
    const { data, error } = await db
      .from("provas")
      .select("id, concurso_id, config_discursiva, concursos!inner(slug)")
      .eq("tipo", "discursiva")
      .eq("concursos.slug", concurso)
      .limit(1)
      .maybeSingle();
    if (error) falhou(`prova discursiva de ${concurso}`, error);
    if (!data) throw new Error(`Concurso ${concurso} sem prova discursiva`);
    return { provaId: data.id, concursoId: data.concurso_id, config: configSchema.parse(data.config_discursiva) };
  }

  return {
    async carregarRedacao(id) {
      const { data, error } = await db
        .from("redacoes")
        .select(
          "id, usuario_id, status, linhas, fotos, temas_discursiva!inner(enunciado, textos_apoio, padrao_resposta, provas!inner(config_discursiva))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) falhou("carregar redação", error);
      if (!data) return null;
      const tema = temaSchema.parse(data.temas_discursiva);
      const config = configSchema.parse(data.temas_discursiva.provas.config_discursiva);
      return {
        id: data.id,
        usuarioId: data.usuario_id,
        status: data.status,
        linhas: data.linhas,
        fotos: data.fotos,
        tema: { enunciado: tema.enunciado, textosApoio: tema.textos_apoio, padrao: tema.padrao_resposta },
        config: {
          pontuacaoMaxima: config.pontuacao_maxima,
          linhasMax: config.linhas_max,
          notaMinima: config.nota_minima,
          caracteresPorLinha: config.caracteres_por_linha,
        },
      };
    },

    async correcoes(redacaoId) {
      const { data, error } = await db.from("correcoes_discursiva").select("papel, resposta").eq("redacao_id", redacaoId);
      if (error) falhou("ler correções", error);
      const feitas: Partial<Record<PapelCorrecao, unknown>> = {};
      for (const c of data) if (PAPEIS.includes(c.papel as PapelCorrecao)) feitas[c.papel as PapelCorrecao] = c.resposta;
      return feitas;
    },

    async gravarCorrecao(redacaoId, papel, uso, resposta) {
      const { error } = await db.from("correcoes_discursiva").upsert(
        {
          redacao_id: redacaoId,
          papel,
          provedor: uso.provedor,
          modelo: uso.modelo,
          resposta: resposta as Json,
          custo_usd: uso.custoUsd,
        },
        { onConflict: "redacao_id,papel" },
      );
      if (error) falhou(`gravar correção ${papel}`, error);
    },

    async marcarStatus(redacaoId, status, aviso) {
      const { error } = await db
        .from("redacoes")
        .update({ status, aviso: aviso ?? null, atualizado_em: new Date().toISOString() })
        .eq("id", redacaoId);
      if (error) falhou(`marcar redação como ${status}`, error);
    },

    // Erros primeiro e o estado "corrigida" por último: se algo falhar no meio, a nova tentativa refaz tudo.
    async gravarResultado(r, res) {
      const { error: e1 } = await db.from("erros_redacao").delete().eq("redacao_id", r.id);
      if (e1) falhou("limpar erros da redação", e1);
      if (res.erros.length) {
        const { error: e2 } = await db.from("erros_redacao").insert(
          res.erros.map((e) => ({
            redacao_id: r.id,
            usuario_id: r.usuarioId,
            linha: e.linha,
            trecho: e.trecho,
            tipo: e.tipo,
            categoria: e.categoria,
            correcao: e.correcao,
            explicacao: e.explicacao,
            canonico: CANONICO_POR_CATEGORIA[e.categoria],
          })),
        );
        if (e2) falhou("gravar erros da redação", e2);
      }
      const papeis = ["conteudo_1", "conteudo_2", "conteudo_3"];
      const agora = new Date().toISOString();
      const { error: e3 } = await db
        .from("redacoes")
        .update({
          status: "corrigida",
          aviso: null,
          nc: res.nc,
          ne: res.ne,
          tl: res.tl,
          npd: res.npd,
          zerada_motivo: res.zeradaMotivo,
          terceira_correcao: res.terceiraCorrecao,
          prioridades: res.prioridades as unknown as Json,
          detalhes: {
            aspectos: res.aspectos,
            usadas: res.usadas.map((i) => papeis[i]),
            erros_descartados: res.errosDescartados,
          } as unknown as Json,
          corrigida_em: agora,
          fotos_apagar_em: r.fotos.length ? daquiADias(DIAS_GUARDAR_FOTOS) : null,
          atualizado_em: agora,
        })
        .eq("id", r.id);
      if (e3) falhou("gravar resultado da redação", e3);
    },

    async baixarFotos(caminhos) {
      return Promise.all(
        caminhos.map(async (caminho) => {
          const { data, error } = await db.storage.from(BUCKET_FOTOS).download(caminho);
          if (error) falhou(`baixar foto ${caminho}`, error);
          return { midia: midiaDoCaminho(caminho), base64: Buffer.from(await data.arrayBuffer()).toString("base64") };
        }),
      );
    },

    // Foto ilegível: apaga as fotos e devolve a redação ao rascunho com o aviso, para o usuário enviar outra.
    async gravarTranscricao(r, t) {
      const agora = new Date().toISOString();
      if (t.ok) {
        const { error } = await db
          .from("redacoes")
          .update({
            status: "aguardando_confirmacao",
            linhas: t.linhas,
            excedente: t.excedente,
            aviso: null,
            fotos_apagar_em: daquiADias(DIAS_GUARDAR_FOTOS),
            atualizado_em: agora,
          })
          .eq("id", r.id);
        if (error) falhou("gravar transcrição", error);
        return;
      }
      if (r.fotos.length) {
        const { error } = await db.storage.from(BUCKET_FOTOS).remove(r.fotos);
        if (error) falhou("apagar fotos ilegíveis", error);
      }
      const { error } = await db
        .from("redacoes")
        .update({ status: "rascunho", aviso: t.aviso, fotos: [], fotos_apagar_em: null, atualizado_em: agora })
        .eq("id", r.id);
      if (error) falhou("devolver redação ao rascunho", error);
    },

    async contextoTema(concurso) {
      const { provaId, concursoId, config } = await idsDoConcurso(concurso);
      const { data: c, error: e1 } = await db.from("concursos").select("nome, bancas(slug)").eq("id", concursoId).single();
      if (e1) falhou(`concurso ${concurso}`, e1);
      const { data: disc, error: e2 } = await db
        .from("prova_disciplinas")
        .select("disciplinas(nome, topicos(titulo, ordem))")
        .eq("prova_id", provaId);
      if (e2) falhou("disciplinas da discursiva", e2);
      const { data: recentes, error: e3 } = await db
        .from("temas_discursiva")
        .select("enunciado")
        .eq("concurso_id", concursoId)
        .order("criado_em", { ascending: false })
        .limit(20);
      if (e3) falhou("temas recentes", e3);
      const disciplinas = disc.map((d) => d.disciplinas);
      return {
        banca: c.bancas.slug,
        concurso: c.nome,
        disciplina: disciplinas.map((d) => d.nome).join(", "),
        programa: disciplinas
          .flatMap((d) => [...d.topicos].sort((x, y) => x.ordem - y.ordem).map((t) => t.titulo))
          .join("; "),
        pontuacaoMaxima: config.pontuacao_maxima,
        linhasMax: config.linhas_max,
        temasRecentes: recentes.map((t) => t.enunciado.slice(0, 160)),
      };
    },

    async gravarTema(concurso, tema, status) {
      const { provaId, concursoId } = await idsDoConcurso(concurso);
      const { error } = await db.from("temas_discursiva").insert({
        concurso_id: concursoId,
        prova_id: provaId,
        origem: "gerado",
        status,
        enunciado: tema.enunciado,
        textos_apoio: tema.textos_apoio as unknown as Json,
        padrao_resposta: tema.padrao_resposta as unknown as Json,
        hash: hashTema(tema.enunciado),
      });
      if (error?.code === "23505") return false;
      if (error) falhou("gravar tema", error);
      return true;
    },

    registrarUso: pipeline.registrarUso,
  };
}

// Apaga do Storage as fotos de redações cujo prazo de guarda venceu (chamada pelo worker quando a fila está vazia).
export async function limparFotosVencidas(db: ClienteServico, limite = 20): Promise<number> {
  const { data, error } = await db
    .from("redacoes")
    .select("id, fotos")
    .lt("fotos_apagar_em", new Date().toISOString())
    .not("fotos", "eq", "{}")
    .limit(limite);
  if (error) falhou("listar fotos vencidas", error);
  for (const r of data) {
    const { error: e1 } = await db.storage.from(BUCKET_FOTOS).remove(r.fotos);
    if (e1) falhou("apagar fotos vencidas", e1);
    const { error: e2 } = await db.from("redacoes").update({ fotos: [], fotos_apagar_em: null }).eq("id", r.id);
    if (e2) falhou("limpar fotos da redação", e2);
  }
  return data.length;
}
```

- [ ] **Passo 3: Worker**

`src/app/api/jobs/worker/route.ts`:

```ts
import { criarRepositorioDiscursiva, limparFotosVencidas } from "@/db/repositorios/discursiva";
import { carregarContexto, criarFilaJobs, criarRepositorioPipeline } from "@/db/repositorios/pipeline";
import { criarClienteServico } from "@/db/supabase/servico";
import { bearerValido } from "@/lib/auth/segredo";
import { criarProvedores } from "@/pipeline/config";
import { processadoresDiscursiva } from "@/pipeline/discursiva/jobs";
import { executarProximoJob } from "@/pipeline/executar-job";
import { gerarLote } from "@/pipeline/gerar-lote";

// Uma geração (gerar + validar até 5 itens) ou uma correção de redação pode levar alguns minutos.
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
    processadores: processadoresDiscursiva({ provedores, repo: criarRepositorioDiscursiva(db) }),
  });
  // Com a fila vazia, aproveita a chamada para apagar fotos de redação com prazo vencido.
  if (resultado.status === "vazio") await limparFotosVencidas(db);
  return Response.json(resultado);
}
```

- [ ] **Passo 4: Verificar contra o Supabase local**

Com `npx supabase start`, rodar um script descartável (fora do repositório) que use `criarRepositorioDiscursiva` e `processadoresDiscursiva` com provedores falsos e jobs reais na tabela `jobs`. Ele confere:
1. **Importação de tema:** o tema importado é gravado.
2. **Correção:**
   - a redação corrigida tem NC, NE, TL, NPD, `detalhes` e `prioridades`;
   - os erros vão para `erros_redacao` com o tópico canônico;
   - as 3 correções vão para `correcoes_discursiva`;
   - o uso fica registrado em `ai_usage`;
   - uma segunda correção da mesma redação é ignorada.
3. **Transcrição:**
   - a foto enviada ao Storage é baixada e chega à IA;
   - a redação passa a `aguardando_confirmacao`;
   - uma foto ilegível devolve a redação ao rascunho e apaga o arquivo.
4. **Limpeza:** as fotos vencidas são apagadas.
5. **Temas:**
   - `contextoTema` traz banca, pontuação e programa;
   - o tema gerado é gravado, e o duplicado é recusado pelo hash.

Rode `npm run typecheck && npm run lint && npm test && npm run test:db`. Esperado: tudo passa.

- [ ] **Passo 5: Commit, push e acompanhamento**

```bash
git add supabase/migrations/0010_redacoes_detalhes.sql src/db/types.ts src/db/repositorios/discursiva.ts src/app/api/jobs/worker/route.ts
git commit -m "feat(discursiva): repositório Supabase, coluna detalhes e jobs da discursiva no worker"
git push
```

No primeiro uso em produção (etapa 3, com as telas), conferir em `ai_usage` o custo por correção (estimado em US$ 0,10 a 0,25 com Opus) e a resposta do GPT na banca 2. Daqui não é possível testar o GPT: a rede deste ambiente bloqueia `api.openai.com`.

---

## Validação feita antes deste plano

O código deste plano foi escrito e testado numa cópia à parte:
- 279 testes passam, além de typecheck e lint.
- O repositório Supabase foi conferido contra um Supabase local, com Storage, migrações 0001 a 0010 e seed do edital, cobrindo todos os itens do Passo 4 da Tarefa 8.
- Uma rodada real com o Claude nas duas bancas (o GPT está bloqueado pela rede deste ambiente) gerou um tema e corrigiu uma redação de 18 linhas.
  - **Tempo:** 17 s.
  - **Erros de língua:** apontados exatamente nos dois trechos errados do texto.
  - **Justificativas:** cada uma cita o trecho que pesou na nota.
  - **Custo:** cerca de US$ 0,10 por correção e US$ 0,08 por tema, com Opus.

## Depois desta etapa

- **Etapa 3 (telas):** as telas abaixo usam `discursiva_entregar`, `discursiva_enviar_fotos` e `discursiva_pedir_tema` (etapa 1), e leem `redacoes.detalhes`, `prioridades`, `correcoes_discursiva` e `erros_redacao`.
  - `/redacao` e escrita, com `distribuirEmLinhas`;
  - envio e conferência da foto;
  - andamento;
  - resultado.
- **Etapa 4:** simulado completo, motor de foco e painel, e importação de temas reais.

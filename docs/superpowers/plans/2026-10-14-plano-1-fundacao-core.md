# Plano 1 — Fundação e motor `core/` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o projeto Next.js e o módulo puro `src/core/` (schema do edital, `edital.yaml` do CBM-AL 2026, pontuação, cortes, análise de dúvida, repetição espaçada, motor de foco e montagem de sessões), todo coberto por testes unitários.

**Architecture:** `src/core/` é TypeScript puro, sem I/O, sem dependência de banco, IA ou UI. Recebe dados e devolve dados. O edital vive em `editais/cbmal-2026/edital.yaml`, validado por um schema Zod de `core/`. Os planos seguintes (Supabase, IA, telas) consomem as funções exportadas aqui.

**Tech Stack:** Node 22, Next.js 16 (App Router, TypeScript, Tailwind), Zod 3.25, `yaml` 2.x, Vitest 5.

**Especificação:** `docs/superpowers/specs/2026-10-14-nucleo-simulador-design.md`

### Sequência de planos do sub-projeto 1

| Plano | Escopo (entregas da spec §9) | Estado |
|---|---|---|
| **1 — Fundação e core** (este) | Projeto base sem infra externa; entrega 2 (`edital.yaml`); entrega 3 (`core/`) | a executar |
| 2 — Supabase e seed | Entrega 1 (migrações, Auth, RLS, deploy Vercel) e seed do YAML no banco | escrever após Plano 1 |
| 3 — IA e pipeline | Entrega 4 (`ai/`, fontes legais, geração e validação, jobs) | escrever após Plano 2 |
| 4 — Telas de estudo | Entregas 5, 6 e 7 (Estudar agora, treino, revisão, simulado, painel) | escrever após Plano 3 |
| 5 — Itens reais | Entrega 8 (importação de itens reais) | escrever após Plano 4 |

## Global Constraints

- Todo código de domínio fica em `src/core/` e **não importa** nada de `src/app`, `src/db`, `src/ai`, `src/pipeline`, nem módulos Node de I/O (`fs`, `path`, `http`). Testes podem usar `fs`.
- Identificadores de domínio em português (ex.: `notaProva`, `valorCorte`), como na spec.
- Funções de `core/` são determinísticas: sem `Math.random()` e sem `new Date()` interno. O tempo entra por parâmetro (`agora: Date`).
- Pontuação Cebraspe: acerto `N/(N − np)`, erro igual valor negativo, branco 0 (edital 8.11.2).
- Cortes CBM-AL: `M1 = ⌊(50 − np1) × 0,2⌋`, `M2 = ⌊(70 − np2) × 0,3⌋`, `M3 = ⌊(120 − nT) × 0,3⌋`; com np = 0: M1 = 10, M2 = 21, M3 = 36.
- Motor de foco: `prioridade = peso × fraqueza × esquecimento × incerteza`; meia-vida 14 dias; `esquecimento = max(0,1; 1 − e^(−dias/7))`; `incerteza = 1 + 1/(1 + n/5)`; valores de resposta: certo +1, certo com dúvida +0,5, errado −1, branco 0.
- Repetição espaçada: intervalos 1, 3, 7 e 15 dias.
- "Estudar agora": 20 itens; cerca de 70% foco, 20% revisão, 10% manutenção.
- Análise de dúvida: recomendação só com pelo menos 10 itens com dúvida na disciplina.
- Versões: `next@16`, `zod@3.25`, `yaml@2`, `vitest@5`.

## Estrutura de arquivos

```
editais/cbmal-2026/edital.yaml           # dados do concurso (Tarefa 3)
src/core/tipos.ts                         # ResultadoResposta e conversão
src/core/edital/schema.ts                 # schemas Zod + tipos do edital
src/core/edital/parse.ts                  # parseEdital(texto) + EditalInvalidoError
src/core/edital/consultas.ts              # topicosFolha, topicosAlvoDoCargo, demandasDaProva
src/core/edital/__fixtures__/mini.yaml    # edital mínimo para testes
src/core/edital/__fixtures__/mini.ts      # carrega o fixture
src/core/edital/cbmal-2026.test.ts        # valida o edital.yaml real
src/core/pontuacao/pontuacao.ts           # notaProva, valorAcerto, situacao
src/core/pontuacao/corte.ts               # valorCorte
src/core/pontuacao/resultado.ts           # calcularResultado
src/core/pontuacao/duvida.ts              # analisarDuvidas
src/core/revisao/espacada.ts              # proximoEstadoRevisao
src/core/foco/prioridade.ts               # calcularPrioridades, CONFIG_FOCO
src/core/sessao/selecao.ts                # agruparPorTextoBase, escolherDoTopico
src/core/sessao/estudar-agora.ts          # montarEstudarAgora
src/core/sessao/treino-simulado.ts        # montarTreinoTopico, montarSimuladoProva, topicosQuePrecisamGeracao
src/core/index.ts                         # reexporta a API pública
```

Cada `*.ts` tem um `*.test.ts` ao lado.

---

### Task 1: Projeto base e ambiente de testes

**Files:**
- Create: projeto Next.js na raiz do repositório (via `create-next-app`)
- Create: `vitest.config.ts`
- Create: `src/core/sanidade.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: nada
- Produces: comandos `npm test`, `npm run typecheck`; alias `@/` → `src/`

- [ ] **Step 1: Gerar o projeto fora da raiz e copiar para dentro**

O `create-next-app` recusa diretórios com arquivos desconhecidos (a pasta `editais/` existe), por isso gere em uma pasta irmã.

```bash
cd /home/user
npx create-next-app@16 concursos-scaffold --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-npm --yes
rsync -a --exclude .git --exclude node_modules concursos-scaffold/ concursos/
rm -rf concursos-scaffold
cd concursos && npm install
```

Expected: `package.json`, `src/app/`, `next.config.ts`, `tsconfig.json` na raiz; `docs/` e `editais/` intactos.

- [ ] **Step 2: Instalar dependências do core e de teste**

```bash
npm install zod@3.25 yaml@2
npm install -D vitest@5
```

- [ ] **Step 3: Configurar o Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

Em `package.json`, dentro de `"scripts"`, adicione:

```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Escrever um teste de sanidade**

Create `src/core/sanidade.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("ambiente", () => {
  it("executa testes", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Rodar testes, typecheck e build**

Run: `npm test && npm run typecheck && npm run build`
Expected: `1 passed`; typecheck sem erros; build Next.js concluído.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: projeto Next.js 16 com Vitest, Zod e yaml"
```

---

### Task 2: Schema e parser do edital

**Files:**
- Create: `src/core/edital/schema.ts`
- Create: `src/core/edital/parse.ts`
- Create: `src/core/edital/__fixtures__/mini.yaml`
- Create: `src/core/edital/__fixtures__/mini.ts`
- Test: `src/core/edital/parse.test.ts`
- Delete: `src/core/sanidade.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - Tipos: `Edital`, `Cargo`, `Prova`, `ProvaObjetiva`, `ProvaDiscursiva`, `Disciplina`, `Topico`, `RegraPontuacao`, `RegraCorte`
  - `parseEdital(texto: string): Edital`
  - `class EditalInvalidoError extends Error { problemas: string[] }`
  - Fixture: `textoMini(): string`, `editalMini(): Edital`

- [ ] **Step 1: Criar o fixture mínimo**

Create `src/core/edital/__fixtures__/mini.yaml`:

```yaml
slug: mini-2026
nome: Concurso Mini
banca: cebraspe
data_prova: "2027-01-24"
editais_fonte: [edital.pdf]
cargos:
  - slug: cargo-a
    nome: Cargo A
    duracao_min: 270
    provas: [p1, p2-a, disc]
    corte_conjunto: { provas: [p1, p2-a], corte: { regra: piso_fator, fator: 0.3 } }
provas:
  - slug: p1
    nome: P1
    tipo: objetiva
    formato: certo_errado
    itens: 10
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.2 }
    disciplinas: [port, mat]
    distribuicao_estimada: { estimada: true, disciplinas: { port: 6, mat: 4 } }
  - slug: p2-a
    nome: P2 A
    tipo: objetiva
    formato: certo_errado
    itens: 10
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.3 }
    disciplinas: [fis]
    distribuicao_estimada: { estimada: true, disciplinas: { fis: 10 } }
  - slug: disc
    nome: Discursiva
    tipo: discursiva
    pontuacao_maxima: 30
    linhas_max: 30
    nota_minima: 15
    disciplinas: [atual]
disciplinas:
  - slug: port
    nome: Português
    topicos:
      - { codigo: "1", titulo: Interpretação, canonico: portugues/interpretacao }
      - codigo: "2"
        titulo: Sintaxe
        subtopicos:
          - { codigo: "2.1", titulo: Crase, canonico: portugues/crase }
          - { codigo: "2.2", titulo: Regência, canonico: portugues/regencia }
  - slug: mat
    nome: Matemática
    topicos:
      - { codigo: "1", titulo: Porcentagem, canonico: matematica/porcentagem }
      - { codigo: "2", titulo: Juros, canonico: matematica/juros }
  - slug: fis
    nome: Física
    topicos:
      - { codigo: "1", titulo: Leis de Newton, canonico: fisica/leis-de-newton }
  - slug: atual
    nome: Atualidades
    topicos:
      - { codigo: "1", titulo: Temas atuais, canonico: atualidades/temas-atuais }
```

Create `src/core/edital/__fixtures__/mini.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEdital } from "../parse";
import type { Edital } from "../schema";

export function textoMini(): string {
  return readFileSync(fileURLToPath(new URL("./mini.yaml", import.meta.url)), "utf8");
}

export function editalMini(): Edital {
  return parseEdital(textoMini());
}
```

- [ ] **Step 2: Escrever os testes do parser**

Create `src/core/edital/parse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { EditalInvalidoError, parseEdital } from "./parse";
import { textoMini } from "./__fixtures__/mini";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- o teste manipula o YAML cru
function mutar(fn: (bruto: any) => void): string {
  const bruto = parse(textoMini());
  fn(bruto);
  return stringify(bruto);
}

function problemasDe(texto: string): string[] {
  try {
    parseEdital(texto);
  } catch (e) {
    if (e instanceof EditalInvalidoError) return e.problemas;
    throw e;
  }
  throw new Error("esperava EditalInvalidoError");
}

describe("parseEdital", () => {
  it("aceita o fixture mínimo", () => {
    const e = parseEdital(textoMini());
    expect(e.slug).toBe("mini-2026");
    expect(e.cargos[0].corte_conjunto?.corte).toEqual({ regra: "piso_fator", fator: 0.3 });
    expect(e.ressalvas).toEqual([]);
  });

  it("aplica penalidade 0 por padrão em múltipla escolha", () => {
    const texto = mutar((b) => {
      b.provas[0].formato = "multipla_escolha";
      b.provas[0].alternativas = 5;
      b.provas[0].pontuacao = { regra: "multipla_escolha", peso: 1 };
    });
    const prova = parseEdital(texto).provas[0];
    expect(prova.tipo === "objetiva" && prova.pontuacao).toEqual({
      regra: "multipla_escolha",
      peso: 1,
      penalidade: 0,
    });
  });

  it("rejeita cargo que referencia prova inexistente", () => {
    const texto = mutar((b) => b.cargos[0].provas.push("p9"));
    expect(problemasDe(texto).join("\n")).toContain("prova inexistente: p9");
  });

  it("rejeita distribuição que não soma o total de itens", () => {
    const texto = mutar((b) => (b.provas[0].distribuicao_estimada.disciplinas.port = 5));
    expect(problemasDe(texto).join("\n")).toContain("soma 9, esperado 10");
  });

  it("rejeita distribuição com disciplinas diferentes das da prova", () => {
    const texto = mutar((b) => (b.provas[0].distribuicao_estimada.disciplinas = { port: 10 }));
    expect(problemasDe(texto).join("\n")).toContain("disciplinas da distribuição diferem");
  });

  it("rejeita tópico folha sem canônico", () => {
    const texto = mutar((b) => delete b.disciplinas[0].topicos[1].subtopicos[0].canonico);
    expect(problemasDe(texto).join("\n")).toContain("tópico folha sem canônico: port 2.1");
  });

  it("rejeita código de tópico duplicado na disciplina", () => {
    const texto = mutar((b) => (b.disciplinas[1].topicos[1].codigo = "1"));
    expect(problemasDe(texto).join("\n")).toContain("código duplicado: mat 1");
  });

  it("rejeita corte conjunto com prova fora do cargo", () => {
    const texto = mutar((b) => (b.cargos[0].corte_conjunto.provas = ["p1", "p3"]));
    expect(problemasDe(texto).join("\n")).toContain("corte_conjunto referencia prova fora do cargo: p3");
  });

  it("exige alternativas em prova de múltipla escolha", () => {
    const texto = mutar((b) => {
      b.provas[0].formato = "multipla_escolha";
      b.provas[0].pontuacao = { regra: "multipla_escolha", peso: 1 };
    });
    expect(problemasDe(texto).join("\n")).toContain("múltipla escolha sem alternativas: p1");
  });

  it("rejeita slug canônico mal formatado", () => {
    const texto = mutar((b) => (b.disciplinas[2].topicos[0].canonico = "Fisica Newton"));
    expect(problemasDe(texto).join("\n")).toContain("slug canônico inválido");
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/core/edital/parse.test.ts`
Expected: FAIL com `Cannot find module './parse'` (ou equivalente).

- [ ] **Step 4: Implementar o schema**

Create `src/core/edital/schema.ts`:

```ts
import { z } from "zod";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido");
const slugCanonico = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)+$/, "slug canônico inválido");

export const regraPontuacaoSchema = z.discriminatedUnion("regra", [
  z.object({ regra: z.literal("certo_errado_penalidade") }),
  z.object({
    regra: z.literal("multipla_escolha"),
    peso: z.number().positive(),
    penalidade: z.number().min(0).default(0),
  }),
]);

export const regraCorteSchema = z.discriminatedUnion("regra", [
  z.object({ regra: z.literal("piso_fator"), fator: z.number().positive().max(1) }),
  z.object({ regra: z.literal("minimo_percentual"), percentual: z.number().positive().max(1) }),
  z.object({ regra: z.literal("minimo_absoluto"), valor: z.number().min(0) }),
]);

export interface Topico {
  codigo: string;
  titulo: string;
  canonico?: string;
  subtopicos?: Topico[];
}

export const topicoSchema: z.ZodType<Topico> = z.lazy(() =>
  z.object({
    codigo: z.string().min(1),
    titulo: z.string().min(1),
    canonico: slugCanonico.optional(),
    subtopicos: z.array(topicoSchema).min(1).optional(),
  }),
);

const distribuicaoSchema = z.object({
  estimada: z.boolean(),
  disciplinas: z.record(z.string(), z.number().int().min(0)),
});

const provaObjetivaSchema = z.object({
  slug,
  nome: z.string().min(1),
  tipo: z.literal("objetiva"),
  formato: z.enum(["certo_errado", "multipla_escolha"]),
  itens: z.number().int().positive(),
  alternativas: z.number().int().min(2).max(5).optional(),
  pontuacao: regraPontuacaoSchema,
  corte: regraCorteSchema.optional(),
  disciplinas: z.array(slug).min(1),
  distribuicao_estimada: distribuicaoSchema,
});

const provaDiscursivaSchema = z.object({
  slug,
  nome: z.string().min(1),
  tipo: z.literal("discursiva"),
  pontuacao_maxima: z.number().positive(),
  linhas_max: z.number().int().positive(),
  nota_minima: z.number().min(0),
  disciplinas: z.array(slug).min(1),
});

const provaSchema = z.discriminatedUnion("tipo", [provaObjetivaSchema, provaDiscursivaSchema]);

const cargoSchema = z.object({
  slug,
  nome: z.string().min(1),
  qualificacoes: z.array(z.string().min(1)).optional(),
  duracao_min: z.number().int().positive(),
  provas: z.array(slug).min(1),
  corte_conjunto: z
    .object({ provas: z.array(slug).min(2), corte: regraCorteSchema })
    .optional(),
});

const disciplinaSchema = z.object({
  slug,
  nome: z.string().min(1),
  topicos: z.array(topicoSchema).min(1),
});

const editalBaseSchema = z.object({
  slug,
  nome: z.string().min(1),
  banca: slug,
  data_prova: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser AAAA-MM-DD"),
  editais_fonte: z.array(z.string().min(1)).min(1),
  ressalvas: z.array(z.string()).default([]),
  cargos: z.array(cargoSchema).min(1),
  provas: z.array(provaSchema).min(1),
  disciplinas: z.array(disciplinaSchema).min(1),
});

type EditalBase = z.infer<typeof editalBaseSchema>;

function duplicados(valores: string[]): string[] {
  const vistos = new Set<string>();
  const dup = new Set<string>();
  for (const v of valores) (vistos.has(v) ? dup : vistos).add(v);
  return [...dup];
}

function verificarTopicos(disciplina: string, topicos: Topico[], codigos: string[], problemas: string[]) {
  for (const t of topicos) {
    codigos.push(t.codigo);
    if (t.subtopicos) verificarTopicos(disciplina, t.subtopicos, codigos, problemas);
    else if (!t.canonico) problemas.push(`tópico folha sem canônico: ${disciplina} ${t.codigo}`);
  }
}

export function problemasDeReferencia(e: EditalBase): string[] {
  const problemas: string[] = [];
  const provas = new Map(e.provas.map((p) => [p.slug, p]));
  const disciplinas = new Set(e.disciplinas.map((d) => d.slug));

  for (const [nome, lista] of [
    ["cargo", e.cargos.map((c) => c.slug)],
    ["prova", e.provas.map((p) => p.slug)],
    ["disciplina", e.disciplinas.map((d) => d.slug)],
  ] as const) {
    for (const d of duplicados(lista)) problemas.push(`${nome} duplicado: ${d}`);
  }

  for (const c of e.cargos) {
    for (const p of c.provas) if (!provas.has(p)) problemas.push(`cargo ${c.slug} referencia prova inexistente: ${p}`);
    for (const p of c.corte_conjunto?.provas ?? []) {
      if (!c.provas.includes(p)) problemas.push(`corte_conjunto referencia prova fora do cargo: ${p}`);
      else if (provas.get(p)?.tipo !== "objetiva") problemas.push(`corte_conjunto referencia prova não objetiva: ${p}`);
    }
  }

  for (const p of e.provas) {
    for (const d of p.disciplinas) {
      if (!disciplinas.has(d)) problemas.push(`prova ${p.slug} referencia disciplina inexistente: ${d}`);
    }
    if (p.tipo !== "objetiva") continue;
    if (p.formato === "multipla_escolha" && p.alternativas === undefined) {
      problemas.push(`múltipla escolha sem alternativas: ${p.slug}`);
    }
    const chaves = Object.keys(p.distribuicao_estimada.disciplinas).sort();
    if (chaves.join(",") !== [...p.disciplinas].sort().join(",")) {
      problemas.push(`prova ${p.slug}: disciplinas da distribuição diferem das disciplinas da prova`);
    }
    const soma = Object.values(p.distribuicao_estimada.disciplinas).reduce((a, b) => a + b, 0);
    if (soma !== p.itens) problemas.push(`prova ${p.slug}: distribuição soma ${soma}, esperado ${p.itens}`);
  }

  for (const d of e.disciplinas) {
    const codigos: string[] = [];
    verificarTopicos(d.slug, d.topicos, codigos, problemas);
    for (const c of duplicados(codigos)) problemas.push(`código duplicado: ${d.slug} ${c}`);
  }

  return problemas;
}

export const editalSchema = editalBaseSchema.superRefine((e, ctx) => {
  for (const message of problemasDeReferencia(e)) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
});

export type Edital = z.infer<typeof editalSchema>;
export type Cargo = Edital["cargos"][number];
export type Prova = Edital["provas"][number];
export type ProvaObjetiva = Extract<Prova, { tipo: "objetiva" }>;
export type ProvaDiscursiva = Extract<Prova, { tipo: "discursiva" }>;
export type Disciplina = Edital["disciplinas"][number];
export type RegraPontuacao = z.infer<typeof regraPontuacaoSchema>;
export type RegraCorte = z.infer<typeof regraCorteSchema>;
```

- [ ] **Step 5: Implementar o parser**

Create `src/core/edital/parse.ts`:

```ts
import { parse } from "yaml";
import { editalSchema, type Edital } from "./schema";

export class EditalInvalidoError extends Error {
  constructor(public readonly problemas: string[]) {
    super(`edital.yaml inválido:\n${problemas.join("\n")}`);
    this.name = "EditalInvalidoError";
  }
}

export function parseEdital(texto: string): Edital {
  const resultado = editalSchema.safeParse(parse(texto));
  if (!resultado.success) {
    throw new EditalInvalidoError(
      resultado.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)),
    );
  }
  return resultado.data;
}
```

- [ ] **Step 6: Rodar os testes**

Run: `rm src/core/sanidade.test.ts && npx vitest run src/core/edital/parse.test.ts && npm run typecheck`
Expected: 10 testes PASS; typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(core): schema Zod e parser do edital.yaml"
```

---

### Task 3: `edital.yaml` do CBM-AL 2026

**Files:**
- Create: `editais/cbmal-2026/edital.yaml`
- Test: `src/core/edital/cbmal-2026.test.ts`

**Interfaces:**
- Consumes: `parseEdital` (Task 2)
- Produces: `editais/cbmal-2026/edital.yaml` com cargos `cfo` e `soldado`; provas `p1-gerais`, `p2-cfo`, `p2-soldado`, `discursiva`; disciplinas `lp`, `ingles`, `informatica`, `matematica`, `rlm`, `legislacao-cbmal`, `cidadania-dh`, `atualidades`, `fisica-cfo`, `quimica-cfo`, `biologia-cfo`, `direito-administrativo`, `direito-constitucional`, `fisica-soldado`, `quimica-soldado`, `biologia-soldado`, `mecanica-geral`

- [ ] **Step 1: Escrever o teste do edital real**

Create `src/core/edital/cbmal-2026.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseEdital } from "./parse";
import type { Disciplina, Topico } from "./schema";

const caminho = fileURLToPath(new URL("../../../editais/cbmal-2026/edital.yaml", import.meta.url));
const edital = parseEdital(readFileSync(caminho, "utf8"));

function disciplina(slug: string): Disciplina {
  const d = edital.disciplinas.find((x) => x.slug === slug);
  if (!d) throw new Error(`disciplina ausente: ${slug}`);
  return d;
}

function folhas(topicos: Topico[]): Topico[] {
  return topicos.flatMap((t) => (t.subtopicos ? folhas(t.subtopicos) : [t]));
}

function buscar(topicos: Topico[], codigo: string): Topico | undefined {
  for (const t of topicos) {
    if (t.codigo === codigo) return t;
    const achado = t.subtopicos && buscar(t.subtopicos, codigo);
    if (achado) return achado;
  }
  return undefined;
}

describe("edital CBM-AL 2026", () => {
  it("tem os metadados do concurso", () => {
    expect(edital.banca).toBe("cebraspe");
    expect(edital.data_prova).toBe("2027-01-24");
    expect(edital.ressalvas.length).toBeGreaterThanOrEqual(2);
    expect(edital.cargos.map((c) => c.slug)).toEqual(["cfo", "soldado"]);
    expect(edital.cargos[1].qualificacoes).toEqual(["QPBM/1", "QPBM/2"]);
  });

  it("modela as provas conforme o edital", () => {
    const p = Object.fromEntries(edital.provas.map((x) => [x.slug, x]));
    expect(p["p1-gerais"]).toMatchObject({ tipo: "objetiva", formato: "certo_errado", itens: 50, corte: { regra: "piso_fator", fator: 0.2 } });
    expect(p["p2-cfo"]).toMatchObject({ itens: 70, corte: { regra: "piso_fator", fator: 0.3 } });
    expect(p["p2-soldado"]).toMatchObject({ itens: 70, corte: { regra: "piso_fator", fator: 0.3 } });
    expect(p["discursiva"]).toMatchObject({ tipo: "discursiva", pontuacao_maxima: 30, linhas_max: 30, nota_minima: 15, disciplinas: ["atualidades"] });
    for (const c of edital.cargos) {
      expect(c.duracao_min).toBe(270);
      expect(c.corte_conjunto?.corte).toEqual({ regra: "piso_fator", fator: 0.3 });
    }
  });

  it("transcreve todos os tópicos de primeiro nível do item 19", () => {
    const esperado: Record<string, number> = {
      lp: 6, ingles: 2, informatica: 5, matematica: 6, rlm: 6, "legislacao-cbmal": 5,
      "cidadania-dh": 8, atualidades: 1, "fisica-cfo": 6, "quimica-cfo": 14, "biologia-cfo": 9,
      "direito-administrativo": 8, "direito-constitucional": 7, "fisica-soldado": 9,
      "quimica-soldado": 6, "biologia-soldado": 9, "mecanica-geral": 7,
    };
    for (const [slug, n] of Object.entries(esperado)) {
      expect(disciplina(slug).topicos.length, slug).toBe(n);
    }
  });

  it("preserva códigos e títulos do edital (amostra)", () => {
    expect(buscar(disciplina("lp").topicos, "5.7")?.titulo).toBe("Emprego do sinal indicativo de crase");
    expect(buscar(disciplina("rlm").topicos, "4.1")?.titulo).toBe("Problemas de contagem e noções de probabilidade");
    expect(buscar(disciplina("fisica-cfo").topicos, "3.13")?.titulo).toBe("Ciclo de Carnot");
    expect(buscar(disciplina("quimica-soldado").topicos, "III.4")?.titulo).toBe("Número de oxidação");
    expect(buscar(disciplina("mecanica-geral").topicos, "1.3.2")?.titulo).toBe("Ciclo Diesel");
  });

  it("reaproveita tópicos canônicos entre os programas de CFO e Soldado", () => {
    const canon = (slug: string) => new Set(folhas(disciplina(slug).topicos).map((t) => t.canonico));
    const bioCfo = canon("biologia-cfo");
    const bioSd = canon("biologia-soldado");
    expect([...bioSd].filter((c) => bioCfo.has(c)).length).toBeGreaterThanOrEqual(20);
    expect(canon("fisica-cfo").has("fisica/leis-de-newton")).toBe(true);
    expect(canon("fisica-soldado").has("fisica/leis-de-newton")).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/edital/cbmal-2026.test.ts`
Expected: FAIL com `ENOENT ... edital.yaml`.

- [ ] **Step 3: Extrair o texto do conteúdo programático**

```bash
pdftotext -layout editais/cbmal-2026/edital-01-abertura.pdf /tmp/edital-01.txt
grep -n "19.2.3\|CONHECIMENTOS ESPECÍFICOS\|MECÂNICA GERAL" /tmp/edital-01.txt
```

O item 19 vai de "CONHECIMENTOS GERAIS" até o fim de "MECÂNICA GERAL" (antes da assinatura e do Anexo I).

- [ ] **Step 4: Escrever o cabeçalho, cargos e provas do YAML**

Create `editais/cbmal-2026/edital.yaml` começando exatamente com:

```yaml
slug: cbmal-2026
nome: Concurso CBM-AL 2026 — CFO e CFP
banca: cebraspe
data_prova: "2027-01-24"
editais_fonte:
  - edital-01-abertura.pdf
  - edital-02-retificacao.pdf
  - portaria-cbmal-185-2026-taf.pdf
ressalvas:
  - "Item 19 retificado no Edital nº 2 sem texto publicado; conteúdo baseado no Edital nº 1."
  - "Data da prova 24/01/2027 segundo noticiário; sem ato oficial no repositório."
  - "Distribuição de itens por disciplina estimada; o edital não a informa."
cargos:
  - slug: cfo
    nome: Oficial de Estado-Maior
    duracao_min: 270
    provas: [p1-gerais, p2-cfo, discursiva]
    corte_conjunto: { provas: [p1-gerais, p2-cfo], corte: { regra: piso_fator, fator: 0.3 } }
  - slug: soldado
    nome: Soldado
    qualificacoes: [QPBM/1, QPBM/2]
    duracao_min: 270
    provas: [p1-gerais, p2-soldado, discursiva]
    corte_conjunto: { provas: [p1-gerais, p2-soldado], corte: { regra: piso_fator, fator: 0.3 } }
provas:
  - slug: p1-gerais
    nome: P1 – Conhecimentos gerais
    tipo: objetiva
    formato: certo_errado
    itens: 50
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.2 }
    disciplinas: [lp, ingles, informatica, matematica, rlm, legislacao-cbmal, cidadania-dh]
    distribuicao_estimada:
      estimada: true
      disciplinas: { lp: 12, ingles: 5, informatica: 6, matematica: 6, rlm: 7, legislacao-cbmal: 8, cidadania-dh: 6 }
  - slug: p2-cfo
    nome: P2 – Conhecimentos específicos (CFO)
    tipo: objetiva
    formato: certo_errado
    itens: 70
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.3 }
    disciplinas: [fisica-cfo, quimica-cfo, biologia-cfo, direito-administrativo, direito-constitucional]
    distribuicao_estimada:
      estimada: true
      disciplinas: { fisica-cfo: 16, quimica-cfo: 16, biologia-cfo: 14, direito-administrativo: 12, direito-constitucional: 12 }
  - slug: p2-soldado
    nome: P2 – Conhecimentos específicos (Soldado)
    tipo: objetiva
    formato: certo_errado
    itens: 70
    pontuacao: { regra: certo_errado_penalidade }
    corte: { regra: piso_fator, fator: 0.3 }
    disciplinas: [fisica-soldado, quimica-soldado, biologia-soldado, mecanica-geral]
    distribuicao_estimada:
      estimada: true
      disciplinas: { fisica-soldado: 18, quimica-soldado: 18, biologia-soldado: 18, mecanica-geral: 16 }
  - slug: discursiva
    nome: P3 – Prova discursiva
    tipo: discursiva
    pontuacao_maxima: 30
    linhas_max: 30
    nota_minima: 15
    disciplinas: [atualidades]
disciplinas:
```

Estes números de distribuição são a estimativa inicial. Se você encontrar o caderno de provas do concurso anterior do CBM-AL aplicado pelo Cebraspe com a contagem de itens por disciplina, substitua os números por essa contagem, mantendo as somas 50 e 70, e cite a fonte num comentário YAML acima de `distribuicao_estimada`. Se não encontrar, mantenha os valores acima.

- [ ] **Step 5: Transcrever as disciplinas**

Abaixo de `disciplinas:`, adicione uma entrada por disciplina, na ordem do item 19, seguindo estas regras:

1. **Slugs e nomes:** `lp` (Língua Portuguesa), `ingles` (Língua Inglesa), `informatica` (Noções de Informática), `matematica` (Matemática), `rlm` (Raciocínio Lógico e Analítico), `legislacao-cbmal` (Legislação pertinente ao CBMAL), `cidadania-dh` (Cidadania e Direitos Humanos), `atualidades` (Atualidades), `fisica-cfo`, `quimica-cfo`, `biologia-cfo` (nomes "Física (CFO)" etc.), `direito-administrativo` (Noções de Direito Administrativo), `direito-constitucional` (Noções de Direito Constitucional), `fisica-soldado`, `quimica-soldado`, `biologia-soldado` ("Física (Soldado)" etc.), `mecanica-geral` (Mecânica Geral).
2. **Códigos:** use a numeração do edital como string (`"5.7"`, `"1.3.2"`). Em `quimica-soldado`, que usa algarismos romanos, o código é `<romano>.<número>`, e o tópico de primeiro nível é o romano sozinho (`"III"` → filhos `"III.1"`, `"III.4"`). Um subitem como `1.1` dentro de `II` vira `"II.1.1"`.
3. **Hierarquia:** um tópico que tem subitens no edital ganha `subtopicos`. Os tópicos sem subitens são folhas.
4. **Títulos:** copie o texto do edital sem o número, sem ponto final e com a capitalização original. Corrija só quebras de linha e hifenizações do PDF (`atômico-\nmolecular` → `atômico-molecular`).
5. **Canônicos (`canonico`, obrigatório em toda folha):** formato `<area>/<assunto>`, minúsculo, ASCII, kebab-case, assunto com até 6 palavras. Áreas: `portugues`, `ingles`, `informatica`, `matematica`, `raciocinio-logico`, `legislacao-cbmal`, `cidadania-dh`, `atualidades`, `fisica`, `quimica`, `biologia`, `direito-administrativo`, `direito-constitucional`, `mecanica-automotiva`.
6. **Reaproveitamento:** quando um tópico de CFO e um de Soldado tratam do mesmo assunto, os dois usam o **mesmo** canônico. Exemplos obrigatórios: "2.3 Leis de Newton e suas aplicações" (fisica-cfo) e "2.4 Leis de Newton" (fisica-soldado) → `fisica/leis-de-newton`; "2.1 Célula procariota e eucariota" nas duas biologias → `biologia/celula-procariota-eucariota`. As duas biologias são quase idênticas, então pelo menos 20 canônicos devem ser compartilhados.
7. **Atualidades:** um único tópico `"1"` com o texto do edital e o canônico `atualidades/temas-atuais`.

Exemplo do formato (início de `lp` e `legislacao-cbmal` completo):

```yaml
  - slug: lp
    nome: Língua Portuguesa
    topicos:
      - { codigo: "1", titulo: Compreensão e interpretação de textos de gêneros variados, canonico: portugues/interpretacao-de-textos }
      - { codigo: "2", titulo: Reconhecimento de tipos e gêneros textuais, canonico: portugues/tipos-e-generos-textuais }
      - { codigo: "3", titulo: Domínio da ortografia oficial, canonico: portugues/ortografia }
      - codigo: "4"
        titulo: Domínio dos mecanismos de coesão textual
        subtopicos:
          - { codigo: "4.1", titulo: "Emprego de elementos de referenciação, substituição e repetição, de conectores e de outros elementos de sequenciação textual", canonico: portugues/coesao-referenciacao-conectores }
          - { codigo: "4.2", titulo: Emprego de tempos e modos verbais, canonico: portugues/tempos-e-modos-verbais }
      # ... 5 (com 5.1 a 5.8) e 6 (com 6.1 a 6.4)
  - slug: legislacao-cbmal
    nome: Legislação pertinente ao CBMAL
    topicos:
      - { codigo: "1", titulo: "Lei Estadual nº 5.346/1992 (dispõe sobre o Estatuto dos Policiais Militares do Estado de Alagoas e dá outras providências) e suas alterações", canonico: legislacao-cbmal/lei-5346-1992-estatuto }
      - { codigo: "2", titulo: "Decreto estadual nº 37.042/1996 (Regulamento Disciplinar da Polícia Militar de Alagoas)", canonico: legislacao-cbmal/decreto-37042-1996-regulamento-disciplinar }
      - { codigo: "3", titulo: "Lei Estadual nº 6.514/2004 (dispõe sobre os critérios e as condições que asseguram aos Oficiais e Praças da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações", canonico: legislacao-cbmal/lei-6514-2004-promocao-oficiais }
      - { codigo: "4", titulo: "Lei Estadual nº 6.544/2004 (dispõe sobre os critérios e as condições que asseguram aos Soldados, Cabos e Subtenentes da ativa da Polícia Militar e do Corpo de Bombeiros Militar do Estado de Alagoas o acesso na hierarquia militar e adota outras providências) e suas alterações", canonico: legislacao-cbmal/lei-6544-2004-promocao-pracas }
      - { codigo: "5", titulo: Lei Federal nº 14.751/2023, canonico: legislacao-cbmal/lei-14751-2023-lei-organica-militares }
```

Títulos com `:` ou `,` ficam entre aspas duplas.

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run src/core/edital/`
Expected: todos PASS. Se `parseEdital` lançar `EditalInvalidoError`, a mensagem lista o caminho exato do problema. Corrija o YAML e rode de novo.

- [ ] **Step 7: Commit**

```bash
git add editais/cbmal-2026/edital.yaml src/core/edital/cbmal-2026.test.ts
git commit -m "feat(edital): edital.yaml do CBM-AL 2026 (CFO e Soldado)"
```

---

### Task 4: Consultas sobre o edital

**Files:**
- Create: `src/core/edital/consultas.ts`
- Test: `src/core/edital/consultas.test.ts`

**Interfaces:**
- Consumes: `Edital`, `Disciplina`, `ProvaObjetiva`, `Topico` (Task 2); `editalMini()` (fixture)
- Produces:
  ```ts
  interface TopicoFolha { disciplina: string; codigo: string; titulo: string; canonico: string }
  interface TopicoAlvo extends TopicoFolha { chave: string; peso: number } // chave = "disciplina:codigo"
  interface DemandaDisciplina { disciplina: string; canonicos: string[]; quantidade: number }
  function topicosFolha(d: Disciplina): TopicoFolha[]
  function provasObjetivasDoCargo(e: Edital, cargo: string): ProvaObjetiva[]
  function topicosAlvoDoCargo(e: Edital, cargo: string): TopicoAlvo[]
  function demandasDaProva(e: Edital, prova: string): DemandaDisciplina[]
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/edital/consultas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { demandasDaProva, provasObjetivasDoCargo, topicosAlvoDoCargo, topicosFolha } from "./consultas";
import { editalMini } from "./__fixtures__/mini";

const e = editalMini();

describe("consultas do edital", () => {
  it("lista as folhas de uma disciplina na ordem do edital", () => {
    expect(topicosFolha(e.disciplinas[0])).toEqual([
      { disciplina: "port", codigo: "1", titulo: "Interpretação", canonico: "portugues/interpretacao" },
      { disciplina: "port", codigo: "2.1", titulo: "Crase", canonico: "portugues/crase" },
      { disciplina: "port", codigo: "2.2", titulo: "Regência", canonico: "portugues/regencia" },
    ]);
  });

  it("lista só as provas objetivas do cargo", () => {
    expect(provasObjetivasDoCargo(e, "cargo-a").map((p) => p.slug)).toEqual(["p1", "p2-a"]);
  });

  it("lança erro para cargo desconhecido", () => {
    expect(() => provasObjetivasDoCargo(e, "x")).toThrow("Cargo desconhecido: x");
  });

  it("calcula o peso = itens da disciplina ÷ nº de folhas", () => {
    const alvos = topicosAlvoDoCargo(e, "cargo-a");
    const peso = Object.fromEntries(alvos.map((t) => [t.chave, t.peso]));
    expect(peso).toEqual({
      "port:1": 2, "port:2.1": 2, "port:2.2": 2,
      "mat:1": 2, "mat:2": 2,
      "fis:1": 10,
    });
  });

  it("monta as demandas de uma prova", () => {
    expect(demandasDaProva(e, "p1")).toEqual([
      { disciplina: "port", canonicos: ["portugues/interpretacao", "portugues/crase", "portugues/regencia"], quantidade: 6 },
      { disciplina: "mat", canonicos: ["matematica/porcentagem", "matematica/juros"], quantidade: 4 },
    ]);
  });

  it("recusa demandas de prova discursiva", () => {
    expect(() => demandasDaProva(e, "disc")).toThrow("Prova objetiva desconhecida: disc");
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/edital/consultas.test.ts`
Expected: FAIL (`Cannot find module './consultas'`).

- [ ] **Step 3: Implementar**

Create `src/core/edital/consultas.ts`:

```ts
import type { Disciplina, Edital, ProvaObjetiva, Topico } from "./schema";

export interface TopicoFolha {
  disciplina: string;
  codigo: string;
  titulo: string;
  canonico: string;
}

export interface TopicoAlvo extends TopicoFolha {
  chave: string;
  peso: number;
}

export interface DemandaDisciplina {
  disciplina: string;
  canonicos: string[];
  quantidade: number;
}

function folhas(disciplina: string, topicos: Topico[]): TopicoFolha[] {
  return topicos.flatMap((t) =>
    t.subtopicos
      ? folhas(disciplina, t.subtopicos)
      : [{ disciplina, codigo: t.codigo, titulo: t.titulo, canonico: t.canonico as string }],
  );
}

export function topicosFolha(d: Disciplina): TopicoFolha[] {
  return folhas(d.slug, d.topicos);
}

function disciplinaPorSlug(e: Edital, slug: string): Disciplina {
  const d = e.disciplinas.find((x) => x.slug === slug);
  if (!d) throw new Error(`Disciplina desconhecida: ${slug}`);
  return d;
}

function provaObjetiva(e: Edital, slug: string): ProvaObjetiva {
  const p = e.provas.find((x) => x.slug === slug);
  if (!p || p.tipo !== "objetiva") throw new Error(`Prova objetiva desconhecida: ${slug}`);
  return p;
}

export function provasObjetivasDoCargo(e: Edital, cargo: string): ProvaObjetiva[] {
  const c = e.cargos.find((x) => x.slug === cargo);
  if (!c) throw new Error(`Cargo desconhecido: ${cargo}`);
  return e.provas.filter((p): p is ProvaObjetiva => p.tipo === "objetiva" && c.provas.includes(p.slug));
}

export function topicosAlvoDoCargo(e: Edital, cargo: string): TopicoAlvo[] {
  return provasObjetivasDoCargo(e, cargo).flatMap((p) =>
    p.disciplinas.flatMap((slug) => {
      const lista = topicosFolha(disciplinaPorSlug(e, slug));
      const itens = p.distribuicao_estimada.disciplinas[slug];
      return lista.map((t) => ({ ...t, chave: `${t.disciplina}:${t.codigo}`, peso: itens / lista.length }));
    }),
  );
}

export function demandasDaProva(e: Edital, prova: string): DemandaDisciplina[] {
  const p = provaObjetiva(e, prova);
  return p.disciplinas.map((slug) => ({
    disciplina: slug,
    canonicos: [...new Set(topicosFolha(disciplinaPorSlug(e, slug)).map((t) => t.canonico))],
    quantidade: p.distribuicao_estimada.disciplinas[slug],
  }));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/core/edital/ && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/edital/consultas.ts src/core/edital/consultas.test.ts
git commit -m "feat(core): consultas de tópicos, pesos e demandas do edital"
```

---

### Task 5: Pontuação e cortes

**Files:**
- Create: `src/core/pontuacao/pontuacao.ts`
- Create: `src/core/pontuacao/corte.ts`
- Test: `src/core/pontuacao/pontuacao.test.ts`
- Test: `src/core/pontuacao/corte.test.ts`

**Interfaces:**
- Consumes: `RegraPontuacao`, `RegraCorte` (Task 2)
- Produces:
  ```ts
  type Marcacao = string | null;           // null = em branco
  interface RespostaCorrigivel { marcacao: Marcacao; gabarito: string }
  type Situacao = "certo" | "errado" | "branco";
  function situacao(r: RespostaCorrigivel): Situacao
  function valorAcerto(regra: RegraPontuacao, nItens: number, np?: number): number
  function valorErro(regra: RegraPontuacao, nItens: number, np?: number): number
  function notaProva(regra: RegraPontuacao, respostas: RespostaCorrigivel[], np?: number): number
  function pontuacaoMaxima(regra: RegraPontuacao, nItens: number, np?: number): number
  function valorCorte(regra: RegraCorte, ctx: { nItens: number; np?: number; pontuacaoMaxima: number }): number
  ```

- [ ] **Step 1: Escrever os testes de pontuação**

Create `src/core/pontuacao/pontuacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { notaProva, pontuacaoMaxima, situacao, valorAcerto, valorErro, type RespostaCorrigivel } from "./pontuacao";

const ce = { regra: "certo_errado_penalidade" } as const;
const me = { regra: "multipla_escolha", peso: 2, penalidade: 0 } as const;

function respostas(certos: number, errados: number, brancos: number): RespostaCorrigivel[] {
  return [
    ...Array.from({ length: certos }, () => ({ marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ marcacao: "E", gabarito: "C" })),
    ...Array.from({ length: brancos }, () => ({ marcacao: null, gabarito: "C" })),
  ];
}

describe("situacao", () => {
  it("classifica certo, errado e branco", () => {
    expect(situacao({ marcacao: "C", gabarito: "C" })).toBe("certo");
    expect(situacao({ marcacao: "E", gabarito: "C" })).toBe("errado");
    expect(situacao({ marcacao: null, gabarito: "C" })).toBe("branco");
  });
});

describe("Cebraspe certo/errado (edital 8.11.2)", () => {
  it("vale 1 ponto por item quando np = 0", () => {
    expect(valorAcerto(ce, 50)).toBe(1);
    expect(valorErro(ce, 50)).toBe(-1);
  });

  it("vale N/(N − np) quando há gabaritos alterados", () => {
    expect(valorAcerto(ce, 50, 2)).toBeCloseTo(50 / 48, 10);
    expect(valorErro(ce, 70, 7)).toBeCloseTo(-70 / 63, 10);
  });

  it("um errado anula um certo", () => {
    expect(notaProva(ce, respostas(30, 15, 5))).toBe(15);
  });

  it("nota pode ser negativa", () => {
    expect(notaProva(ce, respostas(2, 5, 3))).toBe(-3);
  });

  it("recusa np >= nº de itens", () => {
    expect(() => valorAcerto(ce, 10, 10)).toThrow("np deve ser menor que o número de itens");
  });

  it("pontuação máxima = nº de itens × valor do acerto", () => {
    expect(pontuacaoMaxima(ce, 70)).toBe(70);
  });
});

describe("múltipla escolha", () => {
  it("soma o peso dos acertos e não penaliza erros por padrão", () => {
    const rs = [
      { marcacao: "A", gabarito: "A" },
      { marcacao: "B", gabarito: "A" },
      { marcacao: null, gabarito: "C" },
    ];
    expect(notaProva(me, rs)).toBe(2);
    expect(valorErro(me, 3)).toBe(0);
  });

  it("aplica penalidade configurada", () => {
    const comPenalidade = { regra: "multipla_escolha", peso: 1, penalidade: 0.25 } as const;
    const rs = [
      { marcacao: "A", gabarito: "A" },
      { marcacao: "B", gabarito: "A" },
    ];
    expect(notaProva(comPenalidade, rs)).toBe(0.75);
  });
});
```

- [ ] **Step 2: Escrever os testes de corte**

Create `src/core/pontuacao/corte.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { valorCorte } from "./corte";

describe("valorCorte", () => {
  it("reproduz M1, M2 e M3 do CBM-AL com np = 0", () => {
    expect(valorCorte({ regra: "piso_fator", fator: 0.2 }, { nItens: 50, pontuacaoMaxima: 50 })).toBe(10);
    expect(valorCorte({ regra: "piso_fator", fator: 0.3 }, { nItens: 70, pontuacaoMaxima: 70 })).toBe(21);
    expect(valorCorte({ regra: "piso_fator", fator: 0.3 }, { nItens: 120, pontuacaoMaxima: 120 })).toBe(36);
  });

  it("desconta itens alterados antes do piso", () => {
    // ⌊(50 − 3) × 0,2⌋ = ⌊9,4⌋ = 9
    expect(valorCorte({ regra: "piso_fator", fator: 0.2 }, { nItens: 50, np: 3, pontuacaoMaxima: 50 })).toBe(9);
  });

  it("não sofre com erro de ponto flutuante (100 × 0,29 = 28,999…)", () => {
    expect(valorCorte({ regra: "piso_fator", fator: 0.29 }, { nItens: 100, pontuacaoMaxima: 100 })).toBe(29);
  });

  it("aplica mínimo percentual sobre a pontuação máxima", () => {
    expect(valorCorte({ regra: "minimo_percentual", percentual: 0.5 }, { nItens: 60, pontuacaoMaxima: 120 })).toBe(60);
  });

  it("aplica mínimo absoluto", () => {
    expect(valorCorte({ regra: "minimo_absoluto", valor: 15 }, { nItens: 1, pontuacaoMaxima: 30 })).toBe(15);
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/core/pontuacao/`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar a pontuação**

Create `src/core/pontuacao/pontuacao.ts`:

```ts
import type { RegraPontuacao } from "../edital/schema";

export type Marcacao = string | null;

export interface RespostaCorrigivel {
  marcacao: Marcacao;
  gabarito: string;
}

export type Situacao = "certo" | "errado" | "branco";

export function situacao(r: RespostaCorrigivel): Situacao {
  if (r.marcacao === null) return "branco";
  return r.marcacao === r.gabarito ? "certo" : "errado";
}

export function valorAcerto(regra: RegraPontuacao, nItens: number, np = 0): number {
  if (regra.regra === "multipla_escolha") return regra.peso;
  if (np >= nItens) throw new Error("np deve ser menor que o número de itens");
  return nItens / (nItens - np);
}

export function valorErro(regra: RegraPontuacao, nItens: number, np = 0): number {
  if (regra.regra === "multipla_escolha") return regra.penalidade === 0 ? 0 : -regra.penalidade;
  return -valorAcerto(regra, nItens, np);
}

export function notaProva(regra: RegraPontuacao, respostas: RespostaCorrigivel[], np = 0): number {
  const n = respostas.length;
  let nota = 0;
  for (const r of respostas) {
    const s = situacao(r);
    if (s === "certo") nota += valorAcerto(regra, n, np);
    else if (s === "errado") nota += valorErro(regra, n, np);
  }
  return nota;
}

export function pontuacaoMaxima(regra: RegraPontuacao, nItens: number, np = 0): number {
  return nItens * valorAcerto(regra, nItens, np);
}
```

- [ ] **Step 5: Implementar o corte**

Create `src/core/pontuacao/corte.ts`:

```ts
import type { RegraCorte } from "../edital/schema";

// Tolerância para que 100 × 0,29 (= 28,999999999999996) resulte em 29.
const EPSILON = 1e-9;

export function valorCorte(
  regra: RegraCorte,
  ctx: { nItens: number; np?: number; pontuacaoMaxima: number },
): number {
  switch (regra.regra) {
    case "piso_fator":
      return Math.floor((ctx.nItens - (ctx.np ?? 0)) * regra.fator + EPSILON);
    case "minimo_percentual":
      return regra.percentual * ctx.pontuacaoMaxima;
    case "minimo_absoluto":
      return regra.valor;
  }
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run src/core/pontuacao/ && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/pontuacao/
git commit -m "feat(core): pontuação Cebraspe/múltipla escolha e regras de corte"
```

---

### Task 6: Resultado do simulado e análise de dúvida

**Files:**
- Create: `src/core/tipos.ts`
- Create: `src/core/pontuacao/resultado.ts`
- Create: `src/core/pontuacao/duvida.ts`
- Test: `src/core/pontuacao/resultado.test.ts`
- Test: `src/core/pontuacao/duvida.test.ts`
- Test: `src/core/tipos.test.ts`

**Interfaces:**
- Consumes: `notaProva`, `pontuacaoMaxima`, `situacao`, `RespostaCorrigivel`, `Situacao` (Task 5); `valorCorte` (Task 5)
- Produces:
  ```ts
  // tipos.ts
  type ResultadoResposta = "certo" | "certo_duvida" | "errado" | "branco";
  function resultadoDaResposta(s: Situacao, duvida: boolean): ResultadoResposta
  // resultado.ts
  interface EntradaProva { slug: string; regra: RegraPontuacao; corte?: RegraCorte; respostas: RespostaCorrigivel[]; np?: number }
  interface ResultadoProva { slug: string; nota: number; corte: number | null; aprovada: boolean; certos: number; errados: number; brancos: number }
  interface ResultadoSimulado { provas: ResultadoProva[]; total: number; corteConjunto: number | null; aprovado: boolean; motivos: string[] }
  function calcularResultado(provas: EntradaProva[], corteConjunto?: RegraCorte): ResultadoSimulado
  // duvida.ts
  interface RespostaDuvida extends RespostaCorrigivel { disciplina: string; duvida: boolean }
  type Recomendacao = "arriscar_mais" | "deixar_mais_em_branco" | "neutro" | "dados_insuficientes";
  interface AnaliseDuvida { disciplina: string; itens: number; certos: number; errados: number; saldo: number; recomendacao: Recomendacao }
  function analisarDuvidas(respostas: RespostaDuvida[], minimoItens?: number): AnaliseDuvida[]
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/tipos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resultadoDaResposta } from "./tipos";

describe("resultadoDaResposta", () => {
  it("diferencia acerto com e sem dúvida", () => {
    expect(resultadoDaResposta("certo", false)).toBe("certo");
    expect(resultadoDaResposta("certo", true)).toBe("certo_duvida");
    expect(resultadoDaResposta("errado", true)).toBe("errado");
    expect(resultadoDaResposta("branco", true)).toBe("branco");
  });
});
```

Create `src/core/pontuacao/resultado.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calcularResultado, type EntradaProva } from "./resultado";
import type { RespostaCorrigivel } from "./pontuacao";

const ce = { regra: "certo_errado_penalidade" } as const;

function respostas(certos: number, errados: number, brancos: number): RespostaCorrigivel[] {
  return [
    ...Array.from({ length: certos }, () => ({ marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ marcacao: "C", gabarito: "E" })),
    ...Array.from({ length: brancos }, () => ({ marcacao: null, gabarito: "C" })),
  ];
}

function p1(c: number, e: number, b: number): EntradaProva {
  return { slug: "p1", regra: ce, corte: { regra: "piso_fator", fator: 0.2 }, respostas: respostas(c, e, b) };
}

function p2(c: number, e: number, b: number): EntradaProva {
  return { slug: "p2", regra: ce, corte: { regra: "piso_fator", fator: 0.3 }, respostas: respostas(c, e, b) };
}

const conjunto = { regra: "piso_fator", fator: 0.3 } as const;

describe("calcularResultado (CBM-AL)", () => {
  it("aprova quem passa em M1, M2 e M3", () => {
    const r = calcularResultado([p1(30, 10, 10), p2(40, 10, 20)], conjunto);
    expect(r.provas[0]).toEqual({ slug: "p1", nota: 20, corte: 10, aprovada: true, certos: 30, errados: 10, brancos: 10 });
    expect(r.provas[1]).toMatchObject({ nota: 30, corte: 21, aprovada: true });
    expect(r.total).toBe(50);
    expect(r.corteConjunto).toBe(36);
    expect(r.aprovado).toBe(true);
    expect(r.motivos).toEqual([]);
  });

  it("elimina por M1 mesmo com total alto", () => {
    const r = calcularResultado([p1(20, 11, 19), p2(60, 0, 10)], conjunto);
    expect(r.aprovado).toBe(false);
    expect(r.motivos).toEqual(["p1: nota 9 abaixo do corte 10"]);
  });

  it("elimina por M3 mesmo passando em M1 e M2", () => {
    // P1 = 12 (≥ 10), P2 = 22 (≥ 21), total 34 < 36
    const r = calcularResultado([p1(31, 19, 0), p2(46, 24, 0)], conjunto);
    expect(r.provas.every((p) => p.aprovada)).toBe(true);
    expect(r.aprovado).toBe(false);
    expect(r.motivos).toEqual(["conjunto: nota 34 abaixo do corte 36"]);
  });

  it("sem regras de corte, aprova sempre", () => {
    const r = calcularResultado([{ slug: "x", regra: ce, respostas: respostas(1, 5, 0) }]);
    expect(r.provas[0].corte).toBeNull();
    expect(r.corteConjunto).toBeNull();
    expect(r.aprovado).toBe(true);
  });
});
```

Create `src/core/pontuacao/duvida.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { analisarDuvidas, type RespostaDuvida } from "./duvida";

function rs(disciplina: string, certos: number, errados: number, opts: { duvida?: boolean; brancos?: number } = {}): RespostaDuvida[] {
  const duvida = opts.duvida ?? true;
  return [
    ...Array.from({ length: certos }, () => ({ disciplina, duvida, marcacao: "C", gabarito: "C" })),
    ...Array.from({ length: errados }, () => ({ disciplina, duvida, marcacao: "E", gabarito: "C" })),
    ...Array.from({ length: opts.brancos ?? 0 }, () => ({ disciplina, duvida, marcacao: null, gabarito: "C" })),
  ];
}

describe("analisarDuvidas", () => {
  it("recomenda arriscar quando o saldo dos chutes é positivo", () => {
    const [a] = analisarDuvidas(rs("lp", 7, 4));
    expect(a).toEqual({ disciplina: "lp", itens: 11, certos: 7, errados: 4, saldo: 3, recomendacao: "arriscar_mais" });
  });

  it("recomenda deixar em branco quando o saldo é negativo", () => {
    expect(analisarDuvidas(rs("fis", 4, 8))[0].recomendacao).toBe("deixar_mais_em_branco");
  });

  it("é neutro com saldo zero", () => {
    expect(analisarDuvidas(rs("mat", 5, 5))[0].recomendacao).toBe("neutro");
  });

  it("não recomenda nada com menos de 10 itens com dúvida", () => {
    expect(analisarDuvidas(rs("rlm", 6, 3))[0].recomendacao).toBe("dados_insuficientes");
  });

  it("ignora itens sem dúvida e brancos", () => {
    const entrada = [...rs("lp", 20, 0, { duvida: false }), ...rs("lp", 1, 0, { brancos: 5 })];
    expect(analisarDuvidas(entrada)).toEqual([
      { disciplina: "lp", itens: 1, certos: 1, errados: 0, saldo: 1, recomendacao: "dados_insuficientes" },
    ]);
  });

  it("ordena por disciplina", () => {
    const r = analisarDuvidas([...rs("rlm", 1, 0), ...rs("lp", 1, 0)]);
    expect(r.map((a) => a.disciplina)).toEqual(["lp", "rlm"]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/tipos.test.ts src/core/pontuacao/resultado.test.ts src/core/pontuacao/duvida.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `tipos.ts`**

Create `src/core/tipos.ts`:

```ts
import type { Situacao } from "./pontuacao/pontuacao";

export type ResultadoResposta = "certo" | "certo_duvida" | "errado" | "branco";

export function resultadoDaResposta(s: Situacao, duvida: boolean): ResultadoResposta {
  if (s === "certo") return duvida ? "certo_duvida" : "certo";
  return s;
}
```

- [ ] **Step 4: Implementar `resultado.ts`**

Create `src/core/pontuacao/resultado.ts`:

```ts
import type { RegraCorte, RegraPontuacao } from "../edital/schema";
import { valorCorte } from "./corte";
import { notaProva, pontuacaoMaxima, situacao, type RespostaCorrigivel } from "./pontuacao";

export interface EntradaProva {
  slug: string;
  regra: RegraPontuacao;
  corte?: RegraCorte;
  respostas: RespostaCorrigivel[];
  np?: number;
}

export interface ResultadoProva {
  slug: string;
  nota: number;
  corte: number | null;
  aprovada: boolean;
  certos: number;
  errados: number;
  brancos: number;
}

export interface ResultadoSimulado {
  provas: ResultadoProva[];
  total: number;
  corteConjunto: number | null;
  aprovado: boolean;
  motivos: string[];
}

function fmt(n: number): string {
  return String(Number(n.toFixed(2)));
}

function resultadoProva(p: EntradaProva): ResultadoProva {
  const np = p.np ?? 0;
  const nItens = p.respostas.length;
  const nota = notaProva(p.regra, p.respostas, np);
  const corte = p.corte
    ? valorCorte(p.corte, { nItens, np, pontuacaoMaxima: pontuacaoMaxima(p.regra, nItens, np) })
    : null;
  const contagem = { certo: 0, errado: 0, branco: 0 };
  for (const r of p.respostas) contagem[situacao(r)]++;
  return {
    slug: p.slug,
    nota,
    corte,
    aprovada: corte === null || nota >= corte,
    certos: contagem.certo,
    errados: contagem.errado,
    brancos: contagem.branco,
  };
}

export function calcularResultado(provas: EntradaProva[], corteConjunto?: RegraCorte): ResultadoSimulado {
  const resultados = provas.map(resultadoProva);
  const total = resultados.reduce((s, r) => s + r.nota, 0);
  const motivos = resultados
    .filter((r) => !r.aprovada)
    .map((r) => `${r.slug}: nota ${fmt(r.nota)} abaixo do corte ${fmt(r.corte as number)}`);

  let corteTotal: number | null = null;
  if (corteConjunto) {
    const nItens = provas.reduce((s, p) => s + p.respostas.length, 0);
    const np = provas.reduce((s, p) => s + (p.np ?? 0), 0);
    const maxima = provas.reduce((s, p) => s + pontuacaoMaxima(p.regra, p.respostas.length, p.np ?? 0), 0);
    corteTotal = valorCorte(corteConjunto, { nItens, np, pontuacaoMaxima: maxima });
    if (total < corteTotal) motivos.push(`conjunto: nota ${fmt(total)} abaixo do corte ${fmt(corteTotal)}`);
  }

  return { provas: resultados, total, corteConjunto: corteTotal, aprovado: motivos.length === 0, motivos };
}
```

- [ ] **Step 5: Implementar `duvida.ts`**

Create `src/core/pontuacao/duvida.ts`:

```ts
import { situacao, type RespostaCorrigivel } from "./pontuacao";

export interface RespostaDuvida extends RespostaCorrigivel {
  disciplina: string;
  duvida: boolean;
}

export type Recomendacao = "arriscar_mais" | "deixar_mais_em_branco" | "neutro" | "dados_insuficientes";

export interface AnaliseDuvida {
  disciplina: string;
  itens: number;
  certos: number;
  errados: number;
  saldo: number;
  recomendacao: Recomendacao;
}

export function analisarDuvidas(respostas: RespostaDuvida[], minimoItens = 10): AnaliseDuvida[] {
  const porDisciplina = new Map<string, { certos: number; errados: number }>();
  for (const r of respostas) {
    if (!r.duvida) continue;
    const s = situacao(r);
    if (s === "branco") continue;
    const acc = porDisciplina.get(r.disciplina) ?? { certos: 0, errados: 0 };
    if (s === "certo") acc.certos++;
    else acc.errados++;
    porDisciplina.set(r.disciplina, acc);
  }

  return [...porDisciplina.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([disciplina, { certos, errados }]) => {
      const itens = certos + errados;
      const saldo = certos - errados;
      const recomendacao: Recomendacao =
        itens < minimoItens ? "dados_insuficientes" : saldo > 0 ? "arriscar_mais" : saldo < 0 ? "deixar_mais_em_branco" : "neutro";
      return { disciplina, itens, certos, errados, saldo, recomendacao };
    });
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npm test && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/tipos.ts src/core/tipos.test.ts src/core/pontuacao/
git commit -m "feat(core): resultado do simulado com cortes e análise de dúvida"
```

---

### Task 7: Repetição espaçada

**Files:**
- Create: `src/core/revisao/espacada.ts`
- Test: `src/core/revisao/espacada.test.ts`

**Interfaces:**
- Consumes: `ResultadoResposta` (Task 6)
- Produces:
  ```ts
  const INTERVALOS_DIAS: readonly number[]; // [1, 3, 7, 15]
  interface EstadoRevisao { etapa: number; proximaEm: Date } // etapa 1..4
  function proximoEstadoRevisao(atual: EstadoRevisao | null, resultado: ResultadoResposta, agora: Date): EstadoRevisao | null
  function revisaoVencida(estado: EstadoRevisao, agora: Date): boolean
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/revisao/espacada.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { proximoEstadoRevisao, revisaoVencida } from "./espacada";

const agora = new Date("2026-11-01T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000);

describe("proximoEstadoRevisao", () => {
  it("erro ou branco coloca o item na etapa 1 (1 dia)", () => {
    expect(proximoEstadoRevisao(null, "errado", agora)).toEqual({ etapa: 1, proximaEm: dias(1) });
    expect(proximoEstadoRevisao({ etapa: 3, proximaEm: agora }, "branco", agora)).toEqual({ etapa: 1, proximaEm: dias(1) });
  });

  it("acerto fora da revisão não faz nada", () => {
    expect(proximoEstadoRevisao(null, "certo", agora)).toBeNull();
    expect(proximoEstadoRevisao(null, "certo_duvida", agora)).toBeNull();
  });

  it("acerto sem dúvida avança: 1→2 (3 dias), 2→3 (7 dias), 3→4 (15 dias)", () => {
    expect(proximoEstadoRevisao({ etapa: 1, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 2, proximaEm: dias(3) });
    expect(proximoEstadoRevisao({ etapa: 2, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 3, proximaEm: dias(7) });
    expect(proximoEstadoRevisao({ etapa: 3, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 4, proximaEm: dias(15) });
  });

  it("acerto na etapa 4 remove o item da revisão", () => {
    expect(proximoEstadoRevisao({ etapa: 4, proximaEm: agora }, "certo", agora)).toBeNull();
  });

  it("acerto com dúvida mantém a etapa e reagenda com o mesmo intervalo", () => {
    expect(proximoEstadoRevisao({ etapa: 2, proximaEm: agora }, "certo_duvida", agora)).toEqual({ etapa: 2, proximaEm: dias(3) });
  });
});

describe("revisaoVencida", () => {
  it("vence quando proximaEm <= agora", () => {
    expect(revisaoVencida({ etapa: 1, proximaEm: agora }, agora)).toBe(true);
    expect(revisaoVencida({ etapa: 1, proximaEm: dias(1) }, agora)).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/revisao/`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

Create `src/core/revisao/espacada.ts`:

```ts
import type { ResultadoResposta } from "../tipos";

export const INTERVALOS_DIAS: readonly number[] = [1, 3, 7, 15];

const DIA_MS = 86_400_000;

export interface EstadoRevisao {
  etapa: number;
  proximaEm: Date;
}

function agendar(etapa: number, agora: Date): EstadoRevisao {
  return { etapa, proximaEm: new Date(agora.getTime() + INTERVALOS_DIAS[etapa - 1] * DIA_MS) };
}

export function proximoEstadoRevisao(
  atual: EstadoRevisao | null,
  resultado: ResultadoResposta,
  agora: Date,
): EstadoRevisao | null {
  if (resultado === "errado" || resultado === "branco") return agendar(1, agora);
  if (atual === null) return null;
  if (resultado === "certo_duvida") return agendar(atual.etapa, agora);
  if (atual.etapa >= INTERVALOS_DIAS.length) return null;
  return agendar(atual.etapa + 1, agora);
}

export function revisaoVencida(estado: EstadoRevisao, agora: Date): boolean {
  return estado.proximaEm.getTime() <= agora.getTime();
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/core/revisao/ && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/revisao/
git commit -m "feat(core): repetição espaçada 1/3/7/15 dias"
```

---

### Task 8: Motor de foco (prioridade por tópico)

**Files:**
- Create: `src/core/foco/prioridade.ts`
- Test: `src/core/foco/prioridade.test.ts`

**Interfaces:**
- Consumes: `TopicoAlvo` (Task 4); `ResultadoResposta` (Task 6)
- Produces:
  ```ts
  interface ConfigFoco { meiaVidaDias: number; tauEsquecimentoDias: number; esquecimentoMinimo: number; escalaIncerteza: number }
  const CONFIG_FOCO: ConfigFoco; // 14, 7, 0.1, 5
  const VALOR_RESULTADO: Record<ResultadoResposta, number>;
  interface RespostaHistorico { canonico: string; resultado: ResultadoResposta; respondidaEm: Date }
  interface PrioridadeTopico extends TopicoAlvo { prioridade: number; fraqueza: number; esquecimento: number; incerteza: number; aproveitamento: number; n: number }
  function calcularPrioridades(topicos: TopicoAlvo[], historico: RespostaHistorico[], agora: Date, config?: ConfigFoco): PrioridadeTopico[] // ordem decrescente de prioridade; empate por chave
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/foco/prioridade.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { TopicoAlvo } from "../edital/consultas";
import { calcularPrioridades, type RespostaHistorico } from "./prioridade";

const agora = new Date("2026-11-01T12:00:00Z");
const diasAtras = (n: number) => new Date(agora.getTime() - n * 86_400_000);

function alvo(codigo: string, canonico: string, peso = 1): TopicoAlvo {
  return { disciplina: "d", codigo, titulo: codigo, canonico, chave: `d:${codigo}`, peso };
}

function h(canonico: string, resultado: RespostaHistorico["resultado"], dias: number): RespostaHistorico {
  return { canonico, resultado, respondidaEm: diasAtras(dias) };
}

describe("calcularPrioridades", () => {
  it("tópico nunca praticado: fraqueza 0,5, esquecimento 1, incerteza 2", () => {
    const [p] = calcularPrioridades([alvo("1", "a/x", 3)], [], agora);
    expect(p).toMatchObject({ n: 0, aproveitamento: 0, fraqueza: 0.5, esquecimento: 1, incerteza: 2 });
    expect(p.prioridade).toBeCloseTo(3 * 0.5 * 1 * 2, 10);
  });

  it("pondera respostas pela meia-vida de 14 dias", () => {
    // errado hoje (peso 1) e certo há 14 dias (peso 0,5): L = (−1 + 0,5) / 1,5 = −1/3
    const [p] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "errado", 0), h("a/x", "certo", 14)], agora);
    expect(p.aproveitamento).toBeCloseTo(-1 / 3, 10);
    expect(p.fraqueza).toBeCloseTo((1 + 1 / 3) / 2, 10);
  });

  it("acerto com dúvida vale meio acerto", () => {
    const [p] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo_duvida", 0)], agora);
    expect(p.aproveitamento).toBeCloseTo(0.5, 10);
  });

  it("esquecimento cresce com o tempo e tem piso 0,1", () => {
    const [hoje] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo", 0)], agora);
    const [semana] = calcularPrioridades([alvo("1", "a/x")], [h("a/x", "certo", 7)], agora);
    expect(hoje.esquecimento).toBe(0.1);
    expect(semana.esquecimento).toBeCloseTo(1 - Math.exp(-1), 10);
  });

  it("incerteza diminui com o número de respostas", () => {
    const hist = Array.from({ length: 5 }, () => h("a/x", "certo", 1));
    const [p] = calcularPrioridades([alvo("1", "a/x")], hist, agora);
    expect(p.n).toBe(5);
    expect(p.incerteza).toBeCloseTo(1.5, 10);
  });

  it("ordena da maior para a menor prioridade, desempatando pela chave", () => {
    const topicos = [alvo("1", "a/forte", 1), alvo("2", "a/fraco", 1), alvo("3", "a/novo-b", 1), alvo("4", "a/novo-a", 1)];
    const hist = [h("a/forte", "certo", 3), h("a/fraco", "errado", 3)];
    const ordem = calcularPrioridades(topicos, hist, agora).map((p) => p.chave);
    expect(ordem).toEqual(["d:3", "d:4", "d:2", "d:1"]);
  });

  it("peso maior aumenta a prioridade proporcionalmente", () => {
    const [a, b] = calcularPrioridades([alvo("1", "a/x", 1), alvo("2", "a/y", 4)], [], agora);
    expect(a.chave).toBe("d:2");
    expect(a.prioridade / b.prioridade).toBeCloseTo(4, 10);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/foco/`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar**

Create `src/core/foco/prioridade.ts`:

```ts
import type { TopicoAlvo } from "../edital/consultas";
import type { ResultadoResposta } from "../tipos";

export interface ConfigFoco {
  meiaVidaDias: number;
  tauEsquecimentoDias: number;
  esquecimentoMinimo: number;
  escalaIncerteza: number;
}

export const CONFIG_FOCO: ConfigFoco = {
  meiaVidaDias: 14,
  tauEsquecimentoDias: 7,
  esquecimentoMinimo: 0.1,
  escalaIncerteza: 5,
};

export const VALOR_RESULTADO: Record<ResultadoResposta, number> = {
  certo: 1,
  certo_duvida: 0.5,
  errado: -1,
  branco: 0,
};

export interface RespostaHistorico {
  canonico: string;
  resultado: ResultadoResposta;
  respondidaEm: Date;
}

export interface PrioridadeTopico extends TopicoAlvo {
  prioridade: number;
  fraqueza: number;
  esquecimento: number;
  incerteza: number;
  aproveitamento: number;
  n: number;
}

const DIA_MS = 86_400_000;

function diasEntre(antes: Date, depois: Date): number {
  return Math.max(0, (depois.getTime() - antes.getTime()) / DIA_MS);
}

export function calcularPrioridades(
  topicos: TopicoAlvo[],
  historico: RespostaHistorico[],
  agora: Date,
  config: ConfigFoco = CONFIG_FOCO,
): PrioridadeTopico[] {
  const porCanonico = new Map<string, RespostaHistorico[]>();
  for (const r of historico) {
    const lista = porCanonico.get(r.canonico) ?? [];
    lista.push(r);
    porCanonico.set(r.canonico, lista);
  }

  return topicos
    .map((t) => {
      const rs = porCanonico.get(t.canonico) ?? [];
      const n = rs.length;
      let aproveitamento = 0;
      let esquecimento = 1;
      if (n > 0) {
        let somaPesos = 0;
        let somaValores = 0;
        let ultima = rs[0].respondidaEm;
        for (const r of rs) {
          const w = 0.5 ** (diasEntre(r.respondidaEm, agora) / config.meiaVidaDias);
          somaPesos += w;
          somaValores += w * VALOR_RESULTADO[r.resultado];
          if (r.respondidaEm > ultima) ultima = r.respondidaEm;
        }
        aproveitamento = somaValores / somaPesos;
        esquecimento = Math.max(
          config.esquecimentoMinimo,
          1 - Math.exp(-diasEntre(ultima, agora) / config.tauEsquecimentoDias),
        );
      }
      const fraqueza = (1 - aproveitamento) / 2;
      const incerteza = 1 + 1 / (1 + n / config.escalaIncerteza);
      const prioridade = t.peso * fraqueza * esquecimento * incerteza;
      return { ...t, prioridade, fraqueza, esquecimento, incerteza, aproveitamento, n };
    })
    .sort((a, b) => b.prioridade - a.prioridade || a.chave.localeCompare(b.chave));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `npx vitest run src/core/foco/ && npm run typecheck`
Expected: todos PASS.

Conferência do teste de ordenação: "novo-a" e "novo-b" (n = 0) têm prioridade 0,5 × 1 × 2 = 1. "fraco" (errado há 3 dias) tem 1 × (1 − e^(−3/7)) × 1,8333 ≈ 0,64. "forte" tem 0, porque a fraqueza é 0. A ordem é d:3, d:4 (empate resolvido pela chave), d:2, d:1.

- [ ] **Step 5: Commit**

```bash
git add src/core/foco/
git commit -m "feat(core): motor de foco com prioridade por tópico"
```

---

### Task 9: Montagem da sessão "Estudar agora"

**Files:**
- Create: `src/core/sessao/selecao.ts`
- Create: `src/core/sessao/estudar-agora.ts`
- Test: `src/core/sessao/selecao.test.ts`
- Test: `src/core/sessao/estudar-agora.test.ts`

**Interfaces:**
- Consumes: `PrioridadeTopico` (Task 8)
- Produces:
  ```ts
  // selecao.ts
  interface ItemCandidato { id: string; textoBaseId: string | null; canonicos: string[]; visto: boolean } // apenas itens aprovados
  function agruparPorTextoBase(ids: string[], itens: ItemCandidato[]): string[]
  function escolherDoTopico(canonico: string, itens: ItemCandidato[], usados: Set<string>, limite: number): string[] // não-vistos primeiro; não altera `usados`
  // estudar-agora.ts
  interface ParamsEstudarAgora { prioridades: PrioridadeTopico[]; itens: ItemCandidato[]; revisaoVencida: string[]; total?: number; proporcaoRevisao?: number; proporcaoManutencao?: number; maxPorTopico?: number }
  function montarEstudarAgora(p: ParamsEstudarAgora): string[]
  ```

- [ ] **Step 1: Escrever os testes de seleção**

Create `src/core/sessao/selecao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

const item = (id: string, canonico: string, visto = false, textoBaseId: string | null = null): ItemCandidato => ({
  id, canonicos: [canonico], visto, textoBaseId,
});

describe("escolherDoTopico", () => {
  const itens = [item("a", "t/x", true), item("b", "t/x"), item("c", "t/y"), item("d", "t/x")];

  it("prefere itens não vistos e respeita o limite", () => {
    expect(escolherDoTopico("t/x", itens, new Set(), 2)).toEqual(["b", "d"]);
    expect(escolherDoTopico("t/x", itens, new Set(), 5)).toEqual(["b", "d", "a"]);
  });

  it("ignora itens já usados", () => {
    expect(escolherDoTopico("t/x", itens, new Set(["b"]), 5)).toEqual(["d", "a"]);
  });
});

describe("agruparPorTextoBase", () => {
  it("mantém itens do mesmo texto-base juntos, na ordem da primeira ocorrência", () => {
    const itens = [item("1", "t", false, "tb1"), item("2", "t"), item("3", "t", false, "tb1"), item("4", "t", false, "tb2")];
    expect(agruparPorTextoBase(["1", "2", "3", "4"], itens)).toEqual(["1", "3", "2", "4"]);
  });
});
```

- [ ] **Step 2: Escrever os testes de "Estudar agora"**

Create `src/core/sessao/estudar-agora.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PrioridadeTopico } from "../foco/prioridade";
import { montarEstudarAgora } from "./estudar-agora";
import type { ItemCandidato } from "./selecao";

function prioridade(canonico: string, valor: number): PrioridadeTopico {
  return {
    disciplina: "d", codigo: canonico, titulo: canonico, canonico, chave: `d:${canonico}`, peso: 1,
    prioridade: valor, fraqueza: 0, esquecimento: 0, incerteza: 0, aproveitamento: 0, n: 0,
  };
}

function itensDe(canonico: string, n: number, visto = false): ItemCandidato[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${canonico}#${i}`, textoBaseId: null, canonicos: [canonico], visto }));
}

// 8 tópicos em ordem decrescente de prioridade: t1 (mais fraco) … t8 (mais forte)
const prioridades = [8, 7, 6, 5, 4, 3, 2, 1].map((v, i) => prioridade(`t${i + 1}`, v));
const itens = prioridades.flatMap((p) => itensDe(p.canonico, 5));
const revisao = ["t8#4", "t7#4", "t6#4", "t5#4", "t4#4", "t3#4"];

const topico = (id: string) => id.split("#")[0];

describe("montarEstudarAgora", () => {
  it("monta 20 itens: 4 de revisão, 2 de manutenção e 14 de foco (máx. 3 por tópico)", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: revisao });
    expect(sessao).toHaveLength(20);
    expect(new Set(sessao).size).toBe(20);

    // revisão: os 4 primeiros vencidos
    for (const id of revisao.slice(0, 4)) expect(sessao).toContain(id);
    expect(sessao).not.toContain("t4#4");

    // manutenção: 1 item de cada um dos 2 tópicos mais fortes
    expect(sessao).toContain("t8#0");
    expect(sessao).toContain("t7#0");

    // foco: t1..t4 com 3 itens cada (12) + t5 com 2 itens (14)
    const foco = sessao.filter((id) => !revisao.includes(id) && !["t8#0", "t7#0"].includes(id));
    const contagem = foco.reduce<Record<string, number>>((acc, id) => ({ ...acc, [topico(id)]: (acc[topico(id)] ?? 0) + 1 }), {});
    expect(contagem).toEqual({ t1: 3, t2: 3, t3: 3, t4: 3, t5: 2 });
  });

  it("apresenta primeiro o foco, depois revisão e manutenção", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: revisao });
    expect(topico(sessao[0])).toBe("t1");
    expect(sessao.slice(14, 18)).toEqual(revisao.slice(0, 4));
    expect(sessao.slice(18)).toEqual(["t8#0", "t7#0"]);
  });

  it("completa com foco quando faltam itens de revisão", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: [] });
    expect(sessao).toHaveLength(20);
  });

  it("libera mais de 3 itens por tópico quando há poucos tópicos", () => {
    const poucos = [prioridade("a", 2), prioridade("b", 1)];
    const sessao = montarEstudarAgora({ prioridades: poucos, itens: [...itensDe("a", 15), ...itensDe("b", 15)], revisaoVencida: [], total: 10 });
    expect(sessao).toHaveLength(10);
    expect(sessao.filter((id) => topico(id) === "a").length).toBeGreaterThan(3);
  });

  it("devolve menos itens quando o banco não tem o suficiente", () => {
    const sessao = montarEstudarAgora({ prioridades: [prioridade("a", 1)], itens: itensDe("a", 3), revisaoVencida: [] });
    expect(sessao).toHaveLength(3);
  });

  it("ignora ids de revisão que não estão entre os candidatos", () => {
    const sessao = montarEstudarAgora({ prioridades, itens, revisaoVencida: ["inexistente"] });
    expect(sessao).not.toContain("inexistente");
  });
});
```

- [ ] **Step 3: Rodar e confirmar a falha**

Run: `npx vitest run src/core/sessao/`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 4: Implementar `selecao.ts`**

Create `src/core/sessao/selecao.ts`:

```ts
export interface ItemCandidato {
  id: string;
  textoBaseId: string | null;
  canonicos: string[];
  visto: boolean;
}

export function escolherDoTopico(
  canonico: string,
  itens: ItemCandidato[],
  usados: Set<string>,
  limite: number,
): string[] {
  const doTopico = itens.filter((i) => !usados.has(i.id) && i.canonicos.includes(canonico));
  const ordenados = [...doTopico.filter((i) => !i.visto), ...doTopico.filter((i) => i.visto)];
  return ordenados.slice(0, limite).map((i) => i.id);
}

export function agruparPorTextoBase(ids: string[], itens: ItemCandidato[]): string[] {
  const indice = new Map(itens.map((i) => [i.id, i]));
  const grupos = new Map<string, string[]>();
  for (const id of ids) {
    const chave = indice.get(id)?.textoBaseId ?? `__solo:${id}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(id);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()].flat();
}
```

- [ ] **Step 5: Implementar `estudar-agora.ts`**

Create `src/core/sessao/estudar-agora.ts`:

```ts
import type { PrioridadeTopico } from "../foco/prioridade";
import { agruparPorTextoBase, escolherDoTopico, type ItemCandidato } from "./selecao";

export interface ParamsEstudarAgora {
  prioridades: PrioridadeTopico[];
  itens: ItemCandidato[];
  revisaoVencida: string[];
  total?: number;
  proporcaoRevisao?: number;
  proporcaoManutencao?: number;
  maxPorTopico?: number;
}

export function montarEstudarAgora(p: ParamsEstudarAgora): string[] {
  const total = p.total ?? 20;
  const maxPorTopico = p.maxPorTopico ?? 3;
  const cotaRevisao = Math.round(total * (p.proporcaoRevisao ?? 0.2));
  const cotaManutencao = Math.round(total * (p.proporcaoManutencao ?? 0.1));
  const candidatos = new Set(p.itens.map((i) => i.id));
  const usados = new Set<string>();

  const revisao: string[] = [];
  for (const id of p.revisaoVencida) {
    if (revisao.length >= cotaRevisao) break;
    if (candidatos.has(id) && !usados.has(id)) {
      revisao.push(id);
      usados.add(id);
    }
  }

  const manutencao: string[] = [];
  for (const t of [...p.prioridades].reverse()) {
    if (manutencao.length >= cotaManutencao) break;
    for (const id of escolherDoTopico(t.canonico, p.itens, usados, 1)) {
      manutencao.push(id);
      usados.add(id);
    }
  }

  const foco: string[] = [];
  for (const limite of [maxPorTopico, Number.POSITIVE_INFINITY]) {
    for (const t of p.prioridades) {
      const restante = total - revisao.length - manutencao.length - foco.length;
      if (restante <= 0) break;
      const jaDoTopico = foco.filter((id) => p.itens.find((i) => i.id === id)?.canonicos.includes(t.canonico)).length;
      const vagas = Math.min(restante, limite - jaDoTopico);
      if (vagas <= 0) continue;
      for (const id of escolherDoTopico(t.canonico, p.itens, usados, vagas)) {
        foco.push(id);
        usados.add(id);
      }
    }
  }

  return agruparPorTextoBase([...foco, ...revisao, ...manutencao], p.itens);
}
```

- [ ] **Step 6: Rodar os testes**

Run: `npx vitest run src/core/sessao/ && npm run typecheck`
Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
git add src/core/sessao/
git commit -m "feat(core): montagem da sessão Estudar agora (70/20/10)"
```

---

### Task 10: Treino por tópico, simulado completo, gatilho de geração e API pública

**Files:**
- Create: `src/core/sessao/treino-simulado.ts`
- Create: `src/core/index.ts`
- Test: `src/core/sessao/treino-simulado.test.ts`
- Test: `src/core/index.test.ts`

**Interfaces:**
- Consumes: `ItemCandidato`, `escolherDoTopico`, `agruparPorTextoBase` (Task 9); `DemandaDisciplina` (Task 4); `PrioridadeTopico` (Task 8)
- Produces:
  ```ts
  function montarTreinoTopico(p: { canonicos: string[]; itens: ItemCandidato[]; total: number }): string[]
  interface SimuladoMontado { itens: string[]; faltantes: { disciplina: string; faltam: number }[] }
  function montarSimuladoProva(demandas: DemandaDisciplina[], itens: ItemCandidato[], excluir?: Set<string>): SimuladoMontado
  function topicosQuePrecisamGeracao(prioridades: PrioridadeTopico[], itens: ItemCandidato[], opcoes?: { top?: number; minimoNaoVistos?: number }): string[]
  // index.ts reexporta toda a API pública de core/
  ```

- [ ] **Step 1: Escrever os testes**

Create `src/core/sessao/treino-simulado.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PrioridadeTopico } from "../foco/prioridade";
import type { ItemCandidato } from "./selecao";
import { montarSimuladoProva, montarTreinoTopico, topicosQuePrecisamGeracao } from "./treino-simulado";

function itensDe(canonico: string, n: number, visto = false, prefixo = canonico): ItemCandidato[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefixo}#${i}`, textoBaseId: null, canonicos: [canonico], visto }));
}

function prioridade(canonico: string, valor: number): PrioridadeTopico {
  return {
    disciplina: "d", codigo: canonico, titulo: canonico, canonico, chave: `d:${canonico}`, peso: 1,
    prioridade: valor, fraqueza: 0, esquecimento: 0, incerteza: 0, aproveitamento: 0, n: 0,
  };
}

describe("montarTreinoTopico", () => {
  it("alterna entre os tópicos escolhidos", () => {
    const itens = [...itensDe("a", 5), ...itensDe("b", 5)];
    expect(montarTreinoTopico({ canonicos: ["a", "b"], itens, total: 4 })).toEqual(["a#0", "b#0", "a#1", "b#1"]);
  });

  it("continua no tópico que ainda tem itens quando o outro acaba", () => {
    const itens = [...itensDe("a", 1), ...itensDe("b", 5)];
    expect(montarTreinoTopico({ canonicos: ["a", "b"], itens, total: 4 })).toEqual(["a#0", "b#0", "b#1", "b#2"]);
  });
});

describe("montarSimuladoProva", () => {
  const demandas = [
    { disciplina: "port", canonicos: ["p/x", "p/y"], quantidade: 4 },
    { disciplina: "mat", canonicos: ["m/x"], quantidade: 3 },
  ];

  it("cumpre a quantidade de cada disciplina cobrindo os tópicos em rodízio", () => {
    const itens = [...itensDe("p/x", 5), ...itensDe("p/y", 5), ...itensDe("m/x", 5)];
    const r = montarSimuladoProva(demandas, itens);
    expect(r.itens).toEqual(["p/x#0", "p/y#0", "p/x#1", "p/y#1", "m/x#0", "m/x#1", "m/x#2"]);
    expect(r.faltantes).toEqual([]);
  });

  it("informa quantos itens faltam por disciplina", () => {
    const itens = [...itensDe("p/x", 1), ...itensDe("m/x", 3)];
    expect(montarSimuladoProva(demandas, itens).faltantes).toEqual([{ disciplina: "port", faltam: 3 }]);
  });

  it("não repete itens excluídos (ex.: já usados na P1)", () => {
    const itens = itensDe("m/x", 4);
    const r = montarSimuladoProva([{ disciplina: "mat", canonicos: ["m/x"], quantidade: 3 }], itens, new Set(["m/x#0"]));
    expect(r.itens).toEqual(["m/x#1", "m/x#2", "m/x#3"]);
  });
});

describe("topicosQuePrecisamGeracao", () => {
  it("aponta os tópicos prioritários com poucos itens não vistos", () => {
    const prioridades = [prioridade("a", 3), prioridade("b", 2), prioridade("c", 1)];
    const itens = [...itensDe("a", 10), ...itensDe("b", 9), ...itensDe("b", 5, true, "b-visto"), ...itensDe("c", 0)];
    expect(topicosQuePrecisamGeracao(prioridades, itens, { top: 2 })).toEqual(["b"]);
    expect(topicosQuePrecisamGeracao(prioridades, itens)).toEqual(["b", "c"]);
  });
});
```

Create `src/core/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("API pública de core", () => {
  it("exporta as funções usadas pelos próximos planos", () => {
    for (const nome of [
      "parseEdital", "EditalInvalidoError", "topicosFolha", "topicosAlvoDoCargo", "demandasDaProva",
      "provasObjetivasDoCargo", "notaProva", "valorCorte", "calcularResultado", "analisarDuvidas",
      "resultadoDaResposta", "proximoEstadoRevisao", "revisaoVencida", "calcularPrioridades", "CONFIG_FOCO",
      "montarEstudarAgora", "montarTreinoTopico", "montarSimuladoProva", "topicosQuePrecisamGeracao",
      "agruparPorTextoBase",
    ]) {
      expect(core, nome).toHaveProperty(nome);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/core/sessao/treino-simulado.test.ts src/core/index.test.ts`
Expected: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar `treino-simulado.ts`**

Create `src/core/sessao/treino-simulado.ts`:

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
}

export function montarSimuladoProva(
  demandas: DemandaDisciplina[],
  itens: ItemCandidato[],
  excluir: Set<string> = new Set(),
): SimuladoMontado {
  const usados = new Set(excluir);
  const selecionados: string[] = [];
  const faltantes: SimuladoMontado["faltantes"] = [];
  for (const d of demandas) {
    const escolhidos = rodizio(d.canonicos, itens, usados, d.quantidade);
    selecionados.push(...escolhidos);
    if (escolhidos.length < d.quantidade) faltantes.push({ disciplina: d.disciplina, faltam: d.quantidade - escolhidos.length });
  }
  return { itens: agruparPorTextoBase(selecionados, itens), faltantes };
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

- [ ] **Step 4: Implementar `index.ts`**

Create `src/core/index.ts`:

```ts
export * from "./edital/schema";
export * from "./edital/parse";
export * from "./edital/consultas";
export * from "./pontuacao/pontuacao";
export * from "./pontuacao/corte";
export * from "./pontuacao/resultado";
export * from "./pontuacao/duvida";
export * from "./tipos";
export * from "./revisao/espacada";
export * from "./foco/prioridade";
export * from "./sessao/selecao";
export * from "./sessao/estudar-agora";
export * from "./sessao/treino-simulado";
```

- [ ] **Step 5: Verificar que `core/` não importa I/O nem outras camadas**

Run: `grep -rnE "from \"(node:)?(fs|path|http|https)\"|from \"@/(app|db|ai|pipeline)" src/core --include=*.ts | grep -v "\.test\.ts" | grep -v __fixtures__`
Expected: nenhuma saída.

- [ ] **Step 6: Rodar a suíte completa**

Run: `npm test && npm run typecheck && npm run lint`
Expected: todos PASS; sem erros de tipo ou lint.

- [ ] **Step 7: Commit**

```bash
git add src/core/
git commit -m "feat(core): treino por tópico, simulado completo, gatilho de geração e API pública"
```

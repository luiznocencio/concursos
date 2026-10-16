# Plano 6 — Corretor de discursiva, etapa 1: núcleo e banco

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** criar o núcleo puro do corretor de discursiva (nota, folha de linhas, erros, prioridades), o peso de erro de redação no motor de foco e o esquema de banco (migração 0009) que as etapas 2 a 4 vão usar.

**Arquitetura:** funções puras em `src/core/discursiva/`, sem I/O e testadas com Vitest. O edital ganha `caracteres_por_linha` na prova discursiva. O banco ganha temas, redações, correções e erros de redação, com RLS, funções `security definer` para entregar/enviar fotos/pedir tema e um bucket privado de fotos. Tudo segue a especificação `docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md`.

**Stack:** TypeScript, Zod 3, Vitest, PostgreSQL (Supabase), testes de banco com Postgres local (`npm run db:test:start` + `npm run test:db`).

## Restrições globais

- Escreva código, comentários e mensagens de commit em português, no estilo do código existente.
- Nenhum teste chama IA real.
- Agentes: **não** deem push; **não** alterem `.env.local`, `src/db/types.ts`, `supabase/migrations/` nem o Supabase remoto. A Tarefa 6 é do controlador.
- Cada tarefa termina com `npm run typecheck`, `npm run lint` e `npm test` passando, e um commit com as linhas finais:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011ToQbiqbi5jXjUo6r9BQ2G
  ```
- Fórmulas do edital (itens 9.7.4.1 e 9.7.5): convergência em até 25% da nota máxima de conteúdo; NPD = NC − 6 × NE ÷ TL; NPD < 0 vira 0; fuga ao tema ou texto vazio dão 0; aprovado com NPD ≥ 15.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/core/edital/schema.ts` | campo `caracteres_por_linha` (padrão 70) na prova discursiva |
| `src/core/discursiva/tipos.ts` | tipos e listas fechadas (tipos e categorias de erro), `configDaProva` |
| `src/core/discursiva/nota.ts` | convergência, NC com terceira correção, NPD, aprovação |
| `src/core/discursiva/linhas.ts` | texto digitado → linhas da folha + excedente; TL |
| `src/core/discursiva/erros.ts` | categoria → tópico canônico, rótulos, filtro de erros inválidos |
| `src/core/discursiva/prioridades.ts` | as 3 prioridades de estudo da redação |
| `src/core/discursiva/index.ts` | reexporta o módulo; `src/core/index.ts` reexporta o módulo |
| `src/core/foco/prioridade.ts` | `peso` opcional no histórico e `CONFIG_FOCO.pesoErroRedacao` |
| `supabase/migrations/0009_discursiva.sql` | tabelas, RLS, bucket, funções (controlador) |

---

### Tarefa 1: `caracteres_por_linha` no edital e tipos da discursiva

**Arquivos:**
- Modificar: `src/core/edital/schema.ts` (objeto `provaDiscursivaSchema`)
- Modificar: `editais/cbmal-2026/edital.yaml` (prova `discursiva`)
- Modificar: `src/core/edital/cbmal-2026.test.ts`
- Criar: `src/core/discursiva/tipos.ts`
- Regenerar: `supabase/seed/cbmal-2026.sql`

**Interfaces:**
- Produz: `ProvaDiscursiva.caracteres_por_linha: number`; de `tipos.ts`: `TIPOS_ERRO`, `TipoErro`, `CATEGORIAS_ERRO`, `CategoriaErro`, `ErroLingua`, `MotivoZero`, `ConfigDiscursiva`, `configDaProva(prova: ProvaDiscursiva): ConfigDiscursiva`.

- [ ] **Passo 1: Atualizar o teste do edital (falha primeiro)**

Em `src/core/edital/cbmal-2026.test.ts`, troque a linha da discursiva por:

```ts
    expect(p["discursiva"]).toMatchObject({ tipo: "discursiva", pontuacao_maxima: 30, linhas_max: 30, nota_minima: 15, caracteres_por_linha: 70, disciplinas: ["atualidades"] });
```

Rode `npx vitest run src/core/edital/cbmal-2026.test.ts`. Esperado: FALHA (falta `caracteres_por_linha`).

- [ ] **Passo 2: Adicionar o campo ao schema e ao YAML**

Em `src/core/edital/schema.ts`, dentro de `provaDiscursivaSchema`, logo depois de `nota_minima`:

```ts
  // Média de caracteres por linha manuscrita; calibra a folha digitada de 30 linhas.
  caracteres_por_linha: z.number().int().positive().default(70),
```

Em `editais/cbmal-2026/edital.yaml`, na prova `discursiva`, logo depois de `nota_minima: 15`:

```yaml
    caracteres_por_linha: 70
```

Rode `npx vitest run src/core/edital`. Esperado: PASSA.

- [ ] **Passo 3: Criar os tipos da discursiva**

`src/core/discursiva/tipos.ts`:

```ts
import type { ProvaDiscursiva } from "../edital/schema";

// Aspectos gramaticais que a Cebraspe conta em NE (edital, item 9.7.5, alínea b).
export const TIPOS_ERRO = ["grafia", "morfossintaxe", "propriedade_vocabular"] as const;
export type TipoErro = (typeof TIPOS_ERRO)[number];

// Lista fechada para a IA classificar cada erro; cada categoria leva a um tópico de LP (ver erros.ts).
export const CATEGORIAS_ERRO = [
  "ortografia",
  "acentuacao",
  "hifen",
  "concordancia",
  "regencia",
  "crase",
  "pontuacao",
  "colocacao_pronominal",
  "tempos_modos_verbais",
  "coesao_conectores",
  "classes_de_palavras",
  "coordenacao",
  "subordinacao",
  "propriedade_vocabular",
] as const;
export type CategoriaErro = (typeof CATEGORIAS_ERRO)[number];

export interface ErroLingua {
  linha: number;
  trecho: string;
  tipo: TipoErro;
  categoria: CategoriaErro;
  correcao: string;
  explicacao: string;
}

export type MotivoZero = "fuga_tema" | "sem_texto" | "npd_negativo";

export interface ConfigDiscursiva {
  pontuacaoMaxima: number;
  linhasMax: number;
  notaMinima: number;
  caracteresPorLinha: number;
}

export function configDaProva(prova: ProvaDiscursiva): ConfigDiscursiva {
  return {
    pontuacaoMaxima: prova.pontuacao_maxima,
    linhasMax: prova.linhas_max,
    notaMinima: prova.nota_minima,
    caracteresPorLinha: prova.caracteres_por_linha,
  };
}
```

- [ ] **Passo 4: Regenerar o seed e verificar**

Run: `npm run seed:gerar -- cbmal-2026`
Esperado: `supabase/seed/cbmal-2026.sql gerado`, com diferença só na prova discursiva (`"caracteres_por_linha":70`).

Rode `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

- [ ] **Passo 5: Commit**

```bash
git add src/core/edital/schema.ts src/core/edital/cbmal-2026.test.ts editais/cbmal-2026/edital.yaml supabase/seed/cbmal-2026.sql src/core/discursiva/tipos.ts
git commit -m "feat(core): caracteres_por_linha no edital e tipos da discursiva"
```

---

### Tarefa 2: nota da discursiva (NC, terceira correção e NPD)

**Arquivos:**
- Criar: `src/core/discursiva/nota.ts`
- Teste: `src/core/discursiva/nota.test.ts`

**Interfaces:**
- Consome: `MotivoZero` de `./tipos`.
- Produz: `FRACAO_CONVERGENCIA`, `convergentes(a, b, max): boolean`, `ResultadoConteudo` (`{ precisaTerceira: true } | { precisaTerceira: false; nc: number; usadas: [number, number] }`), `notaConteudo(notas: number[], max: number): ResultadoConteudo`, `EntradaNPD`, `ResultadoNPD` (`{ npd: number; motivoZero: MotivoZero | null }`), `arredondar2(x)`, `calcularNPD(entrada): ResultadoNPD`, `aprovadoDiscursiva(npd, notaMinima): boolean`.

- [ ] **Passo 1: Escrever o teste**

`src/core/discursiva/nota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { aprovadoDiscursiva, calcularNPD, convergentes, notaConteudo } from "./nota";

describe("convergentes", () => {
  it("aceita diferença de exatamente 25% da nota máxima", () => {
    expect(convergentes(20, 27.5, 30)).toBe(true);
    expect(convergentes(20, 27.51, 30)).toBe(false);
  });
});

describe("notaConteudo", () => {
  it("duas notas convergentes: média", () => {
    expect(notaConteudo([20, 24], 30)).toEqual({ precisaTerceira: false, nc: 22, usadas: [0, 1] });
  });

  it("duas notas divergentes: pede terceira correção", () => {
    expect(notaConteudo([10, 25], 30)).toEqual({ precisaTerceira: true });
  });

  it("três notas: média das duas mais próximas", () => {
    expect(notaConteudo([10, 25, 22], 30)).toEqual({ precisaTerceira: false, nc: 23.5, usadas: [1, 2] });
  });

  it("três notas com empate de distância: fica a dupla de maior média", () => {
    // |10−16| = 6 e |16−22| = 6: vence (16 + 22) / 2 = 19
    expect(notaConteudo([10, 22, 16], 30)).toEqual({ precisaTerceira: false, nc: 19, usadas: [1, 2] });
  });

  it("limita cada nota entre 0 e a nota máxima", () => {
    expect(notaConteudo([31, 29], 30)).toEqual({ precisaTerceira: false, nc: 29.5, usadas: [0, 1] });
    expect(notaConteudo([-2, 3], 30)).toEqual({ precisaTerceira: false, nc: 1.5, usadas: [0, 1] });
  });

  it("recusa quantidade de notas diferente de 2 ou 3", () => {
    expect(() => notaConteudo([20], 30)).toThrow(/2 ou 3/);
  });
});

describe("calcularNPD", () => {
  it("aplica NPD = NC − 6 × NE ÷ TL com duas casas", () => {
    // 21,5 − 6 × 4 ÷ 26 = 20,5769…
    expect(calcularNPD({ nc: 21.5, ne: 4, tl: 26, fugaTema: false })).toEqual({ npd: 20.58, motivoZero: null });
  });

  it("sem erros, NPD = NC", () => {
    expect(calcularNPD({ nc: 18, ne: 0, tl: 30, fugaTema: false })).toEqual({ npd: 18, motivoZero: null });
  });

  it("NPD negativo vira zero", () => {
    expect(calcularNPD({ nc: 3, ne: 20, tl: 20, fugaTema: false })).toEqual({ npd: 0, motivoZero: "npd_negativo" });
  });

  it("fuga ao tema zera", () => {
    expect(calcularNPD({ nc: 25, ne: 0, tl: 30, fugaTema: true })).toEqual({ npd: 0, motivoZero: "fuga_tema" });
  });

  it("sem texto zera, mesmo com fuga ao tema", () => {
    expect(calcularNPD({ nc: 0, ne: 0, tl: 0, fugaTema: true })).toEqual({ npd: 0, motivoZero: "sem_texto" });
  });
});

describe("aprovadoDiscursiva", () => {
  it("aprova com NPD igual ou acima do mínimo", () => {
    expect(aprovadoDiscursiva(15, 15)).toBe(true);
    expect(aprovadoDiscursiva(14.99, 15)).toBe(false);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/core/discursiva/nota.test.ts`
Esperado: FALHA (módulo `./nota` não existe).

- [ ] **Passo 3: Implementar**

`src/core/discursiva/nota.ts`:

```ts
import type { MotivoZero } from "./tipos";

// Duas notas convergem se diferem em até 25% da nota máxima de conteúdo (edital, 9.7.4.1.2).
export const FRACAO_CONVERGENCIA = 0.25;
const EPS = 1e-9;

export type ResultadoConteudo =
  | { precisaTerceira: true }
  | { precisaTerceira: false; nc: number; usadas: [number, number] };

function limitar(nota: number, max: number): number {
  return Math.min(max, Math.max(0, nota));
}

export function convergentes(a: number, b: number, max: number): boolean {
  return Math.abs(a - b) <= FRACAO_CONVERGENCIA * max + EPS;
}

/**
 * NC a partir das notas de conteúdo dos examinadores (9.7.4.1.1 a 9.7.4.1.3).
 * Com duas notas: média se convergem; senão pede terceira correção.
 * Com três: média das duas mais próximas (empate: a dupla de maior média).
 * `usadas` traz os índices das notas que entraram na média.
 */
export function notaConteudo(notas: number[], max: number): ResultadoConteudo {
  const n = notas.map((x) => limitar(x, max));
  if (n.length === 2) {
    if (!convergentes(n[0], n[1], max)) return { precisaTerceira: true };
    return { precisaTerceira: false, nc: (n[0] + n[1]) / 2, usadas: [0, 1] };
  }
  if (n.length === 3) {
    const pares: [number, number][] = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    let melhor = pares[0];
    for (const par of pares.slice(1)) {
      const dif = Math.abs(n[par[0]] - n[par[1]]);
      const difMelhor = Math.abs(n[melhor[0]] - n[melhor[1]]);
      const media = n[par[0]] + n[par[1]];
      const mediaMelhor = n[melhor[0]] + n[melhor[1]];
      if (dif < difMelhor - EPS || (Math.abs(dif - difMelhor) <= EPS && media > mediaMelhor + EPS)) melhor = par;
    }
    return { precisaTerceira: false, nc: (n[melhor[0]] + n[melhor[1]]) / 2, usadas: melhor };
  }
  throw new Error(`notaConteudo espera 2 ou 3 notas, recebeu ${n.length}`);
}

export interface EntradaNPD {
  nc: number;
  ne: number;
  tl: number;
  fugaTema: boolean;
}

export interface ResultadoNPD {
  npd: number;
  motivoZero: MotivoZero | null;
}

export function arredondar2(x: number): number {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

// NPD = NC − 6 × NE ÷ TL, com os zeros da alínea e e f do item 9.7.5.
export function calcularNPD({ nc, ne, tl, fugaTema }: EntradaNPD): ResultadoNPD {
  if (tl <= 0) return { npd: 0, motivoZero: "sem_texto" };
  if (fugaTema) return { npd: 0, motivoZero: "fuga_tema" };
  const bruto = nc - (6 * ne) / tl;
  if (bruto < 0) return { npd: 0, motivoZero: "npd_negativo" };
  return { npd: arredondar2(bruto), motivoZero: null };
}

export function aprovadoDiscursiva(npd: number, notaMinima: number): boolean {
  return npd >= notaMinima;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/core/discursiva/nota.test.ts`
Esperado: PASSA (13 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/core/discursiva/nota.ts src/core/discursiva/nota.test.ts
git commit -m "feat(core): nota da discursiva com convergência, terceira correção e NPD"
```

---

### Tarefa 3: folha de linhas

**Arquivos:**
- Criar: `src/core/discursiva/linhas.ts`
- Teste: `src/core/discursiva/linhas.test.ts`

**Interfaces:**
- Produz: `Folha` (`{ linhas: string[]; excedente: string[] }`), `distribuirEmLinhas(texto: string, caracteresPorLinha: number, linhasMax: number): Folha`, `contarTL(linhas: string[]): number`.

- [ ] **Passo 1: Escrever o teste**

`src/core/discursiva/linhas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { contarTL, distribuirEmLinhas } from "./linhas";

describe("distribuirEmLinhas", () => {
  it("quebra por palavra sem passar do limite", () => {
    expect(distribuirEmLinhas("aa bb cc dd", 5, 30)).toEqual({ linhas: ["aa bb", "cc dd"], excedente: [] });
  });

  it("junta espaços repetidos", () => {
    expect(distribuirEmLinhas("aa    bb", 10, 30).linhas).toEqual(["aa bb"]);
  });

  it("cada parágrafo começa em linha nova e linhas em branco são mantidas", () => {
    expect(distribuirEmLinhas("aa\n\nbb cc", 10, 30).linhas).toEqual(["aa", "", "bb cc"]);
  });

  it("aceita quebras de linha do Windows", () => {
    expect(distribuirEmLinhas("aa\r\nbb", 10, 30).linhas).toEqual(["aa", "bb"]);
  });

  it("corta palavra maior que a linha", () => {
    expect(distribuirEmLinhas("x abcdefghij y", 4, 30).linhas).toEqual(["x", "abcd", "efgh", "ij y"]);
  });

  it("ignora linhas em branco no fim", () => {
    expect(distribuirEmLinhas("aa\n\n\n", 10, 30).linhas).toEqual(["aa"]);
  });

  it("texto vazio não tem linhas", () => {
    expect(distribuirEmLinhas("   ", 10, 30)).toEqual({ linhas: [], excedente: [] });
  });

  it("o que passa do máximo de linhas vai para o excedente", () => {
    expect(distribuirEmLinhas("a b c d", 1, 3)).toEqual({ linhas: ["a", "b", "c"], excedente: ["d"] });
  });
});

describe("contarTL", () => {
  it("conta só as linhas com texto", () => {
    expect(contarTL(["aa", "", "  ", "bb"])).toBe(2);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/core/discursiva/linhas.test.ts`
Esperado: FALHA (módulo `./linhas` não existe).

- [ ] **Passo 3: Implementar**

`src/core/discursiva/linhas.ts`:

```ts
export interface Folha {
  linhas: string[];
  excedente: string[];
}

/**
 * Distribui o texto digitado pelas linhas da folha, quebrando por palavra.
 * Cada quebra de linha do texto começa uma linha nova (parágrafo); linhas em branco são mantidas.
 * Palavra maior que a linha é cortada. O que passar de `linhasMax` vai para `excedente`,
 * que não é corrigido (edital, 9.7.5, alínea c).
 */
export function distribuirEmLinhas(texto: string, caracteresPorLinha: number, linhasMax: number): Folha {
  const todas: string[] = [];
  const paragrafos = texto.replace(/\r\n?/g, "\n").split("\n");
  for (const paragrafo of paragrafos) {
    const palavras = paragrafo.split(/\s+/).filter((p) => p !== "");
    let atual = "";
    for (let palavra of palavras) {
      while (palavra.length > caracteresPorLinha) {
        if (atual !== "") {
          todas.push(atual);
          atual = "";
        }
        todas.push(palavra.slice(0, caracteresPorLinha));
        palavra = palavra.slice(caracteresPorLinha);
      }
      if (palavra === "") continue;
      if (atual === "") atual = palavra;
      else if (atual.length + 1 + palavra.length <= caracteresPorLinha) atual += ` ${palavra}`;
      else {
        todas.push(atual);
        atual = palavra;
      }
    }
    todas.push(atual);
  }
  // O último Enter não cria uma linha em branco no fim da folha.
  while (todas.length > 0 && todas[todas.length - 1] === "") todas.pop();
  return { linhas: todas.slice(0, linhasMax), excedente: todas.slice(linhasMax) };
}

// TL: linhas efetivamente escritas (edital, 9.7.5, alínea d).
export function contarTL(linhas: string[]): number {
  return linhas.filter((l) => l.trim() !== "").length;
}
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/core/discursiva/linhas.test.ts`
Esperado: PASSA (9 testes).

- [ ] **Passo 5: Commit**

```bash
git add src/core/discursiva/linhas.ts src/core/discursiva/linhas.test.ts
git commit -m "feat(core): distribuição do texto nas linhas da folha da discursiva"
```

---

### Tarefa 4: erros de língua, prioridades e API pública

**Arquivos:**
- Criar: `src/core/discursiva/erros.ts`, `src/core/discursiva/prioridades.ts`, `src/core/discursiva/index.ts`
- Testes: `src/core/discursiva/erros.test.ts`, `src/core/discursiva/prioridades.test.ts`
- Modificar: `src/core/index.ts`, `src/core/index.test.ts`

**Interfaces:**
- Consome: `CategoriaErro`, `ErroLingua`, `CATEGORIAS_ERRO` de `./tipos`.
- Produz: `CANONICO_POR_CATEGORIA: Record<CategoriaErro, string>`, `ROTULO_CATEGORIA: Record<CategoriaErro, string>`, `ErrosFiltrados` (`{ validos: ErroLingua[]; descartados: number }`), `filtrarErrosValidos(erros, linhas): ErrosFiltrados`, `AspectoAvaliado` (`{ codigo; descricao; pontos; nota }`), `PrioridadeRedacao`, `escolherPrioridades(aspectos, erros, quantidade = 3): PrioridadeRedacao[]`. Tudo exportado por `@/core`.

- [ ] **Passo 1: Escrever os testes**

`src/core/discursiva/erros.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CANONICO_POR_CATEGORIA, filtrarErrosValidos, ROTULO_CATEGORIA } from "./erros";
import { CATEGORIAS_ERRO, type ErroLingua } from "./tipos";

function erro(linha: number, trecho: string, categoria: ErroLingua["categoria"] = "crase"): ErroLingua {
  return { linha, trecho, tipo: "morfossintaxe", categoria, correcao: "x", explicacao: "y" };
}

const linhas = ["Os bombeiros chegou cedo", "", "e foram a festa"];

describe("filtrarErrosValidos", () => {
  it("mantém erro cujo trecho está na linha, ignorando caixa e espaços", () => {
    const r = filtrarErrosValidos([erro(1, "bombeiros  CHEGOU")], linhas);
    expect(r.validos).toHaveLength(1);
    expect(r.descartados).toBe(0);
  });

  it("descarta linha inexistente, linha em branco e linha fracionária", () => {
    const r = filtrarErrosValidos([erro(0, "Os"), erro(4, "Os"), erro(2, "Os"), erro(1.5, "Os")], linhas);
    expect(r.validos).toEqual([]);
    expect(r.descartados).toBe(4);
  });

  it("descarta trecho que não está na linha ou é vazio", () => {
    const r = filtrarErrosValidos([erro(3, "à festa"), erro(3, "  ")], linhas);
    expect(r.validos).toEqual([]);
  });

  it("conta uma vez o mesmo erro repetido", () => {
    const r = filtrarErrosValidos([erro(3, "a festa"), erro(3, "a  festa"), erro(3, "a festa", "regencia")], linhas);
    expect(r.validos).toHaveLength(2);
    expect(r.descartados).toBe(1);
  });
});

describe("mapeamentos de categoria", () => {
  it("toda categoria tem tópico de português e rótulo", () => {
    for (const c of CATEGORIAS_ERRO) {
      expect(CANONICO_POR_CATEGORIA[c]).toMatch(/^portugues\//);
      expect(ROTULO_CATEGORIA[c]).not.toBe("");
    }
  });
});
```

`src/core/discursiva/prioridades.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escolherPrioridades, type AspectoAvaliado } from "./prioridades";
import type { ErroLingua } from "./tipos";

function erro(categoria: ErroLingua["categoria"]): ErroLingua {
  return { linha: 1, trecho: "x", tipo: "morfossintaxe", categoria, correcao: "x", explicacao: "y" };
}

const aspectos: AspectoAvaliado[] = [
  { codigo: "1", descricao: "causas do problema", pontos: 10, nota: 9 },
  { codigo: "2", descricao: "propostas", pontos: 10, nota: 2.5 },
  { codigo: "3", descricao: "estrutura", pontos: 10, nota: 10 },
];

describe("escolherPrioridades", () => {
  it("ordena por perda proporcional e frequência de erro", () => {
    const r = escolherPrioridades(aspectos, [erro("crase"), erro("concordancia"), erro("concordancia")]);
    expect(r.map((p) => p.titulo)).toEqual(["Aprofunde: propostas", "Revise concordância", "Revise crase"]);
  });

  it("descreve nota do aspecto e leva o erro ao tópico canônico", () => {
    const [aspecto] = escolherPrioridades(aspectos, [], 1);
    expect(aspecto).toEqual({
      tipo: "aspecto",
      codigo: "2",
      titulo: "Aprofunde: propostas",
      detalhe: "Você fez 2,5 de 10 pontos neste aspecto.",
    });
    const [e] = escolherPrioridades([], [erro("crase")], 1);
    expect(e).toEqual({
      tipo: "erro",
      categoria: "crase",
      canonico: "portugues/crase",
      titulo: "Revise crase",
      detalhe: "1 erro na redação.",
    });
  });

  it("em empate de peso, o erro vem antes do aspecto", () => {
    const zerado: AspectoAvaliado[] = [{ codigo: "1", descricao: "tema", pontos: 10, nota: 0 }];
    const r = escolherPrioridades(zerado, [erro("crase"), erro("crase"), erro("crase")]);
    expect(r.map((p) => p.tipo)).toEqual(["erro", "aspecto"]);
  });

  it("ignora aspectos com nota cheia e devolve no máximo a quantidade pedida", () => {
    expect(escolherPrioridades([aspectos[2]], [])).toEqual([]);
    const muitos = (["crase", "regencia", "pontuacao", "hifen"] as const).map(erro);
    expect(escolherPrioridades([], muitos)).toHaveLength(3);
  });
});
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/core/discursiva`
Esperado: FALHA (módulos `./erros` e `./prioridades` não existem).

- [ ] **Passo 3: Implementar**

`src/core/discursiva/erros.ts`:

```ts
import type { CategoriaErro, ErroLingua } from "./tipos";

// Cada categoria de erro leva a um tópico canônico de Língua Portuguesa do edital.
export const CANONICO_POR_CATEGORIA: Record<CategoriaErro, string> = {
  ortografia: "portugues/ortografia",
  acentuacao: "portugues/ortografia",
  hifen: "portugues/ortografia",
  concordancia: "portugues/concordancia-verbal-e-nominal",
  regencia: "portugues/regencia-verbal-e-nominal",
  crase: "portugues/crase",
  pontuacao: "portugues/pontuacao",
  colocacao_pronominal: "portugues/colocacao-pronominal",
  tempos_modos_verbais: "portugues/tempos-e-modos-verbais",
  coesao_conectores: "portugues/coesao-referenciacao-conectores",
  classes_de_palavras: "portugues/classes-de-palavras",
  coordenacao: "portugues/coordenacao",
  subordinacao: "portugues/subordinacao",
  propriedade_vocabular: "portugues/significacao-das-palavras",
};

export const ROTULO_CATEGORIA: Record<CategoriaErro, string> = {
  ortografia: "ortografia",
  acentuacao: "acentuação",
  hifen: "uso do hífen",
  concordancia: "concordância",
  regencia: "regência",
  crase: "crase",
  pontuacao: "pontuação",
  colocacao_pronominal: "colocação pronominal",
  tempos_modos_verbais: "tempos e modos verbais",
  coesao_conectores: "coesão e conectores",
  classes_de_palavras: "classes de palavras",
  coordenacao: "coordenação",
  subordinacao: "subordinação",
  propriedade_vocabular: "propriedade vocabular",
};

function normalizar(s: string): string {
  return s.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export interface ErrosFiltrados {
  validos: ErroLingua[];
  descartados: number;
}

/**
 * Mantém só os erros que apontam uma linha escrita e um trecho que existe nela;
 * repetições (mesma linha, trecho e categoria) contam uma vez. NE = validos.length.
 */
export function filtrarErrosValidos(erros: ErroLingua[], linhas: string[]): ErrosFiltrados {
  const vistos = new Set<string>();
  const validos: ErroLingua[] = [];
  for (const e of erros) {
    const linha = Number.isInteger(e.linha) ? linhas[e.linha - 1] : undefined;
    const trecho = normalizar(e.trecho);
    if (linha === undefined || e.linha < 1 || trecho === "" || !normalizar(linha).includes(trecho)) continue;
    const chave = `${e.linha}|${trecho}|${e.categoria}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    validos.push(e);
  }
  return { validos, descartados: erros.length - validos.length };
}
```

`src/core/discursiva/prioridades.ts`:

```ts
import { CANONICO_POR_CATEGORIA, ROTULO_CATEGORIA } from "./erros";
import type { CategoriaErro, ErroLingua } from "./tipos";

export interface AspectoAvaliado {
  codigo: string;
  descricao: string;
  pontos: number;
  nota: number;
}

export type PrioridadeRedacao =
  | { tipo: "aspecto"; codigo: string; titulo: string; detalhe: string }
  | { tipo: "erro"; categoria: CategoriaErro; canonico: string; titulo: string; detalhe: string };

// Três erros da mesma categoria já pesam tanto quanto um aspecto zerado.
const ERROS_PARA_PESO_MAXIMO = 3;

function numero(x: number): string {
  return x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Escolhe o que estudar primeiro: aspectos do padrão de resposta com mais pontos perdidos (proporcionalmente)
 * e categorias de erro mais frequentes. Em empate, erro vem antes (leva direto a um treino).
 */
export function escolherPrioridades(
  aspectos: AspectoAvaliado[],
  erros: ErroLingua[],
  quantidade = 3,
): PrioridadeRedacao[] {
  const candidatos: { peso: number; ordem: string; p: PrioridadeRedacao }[] = [];

  for (const a of aspectos) {
    const perda = a.pontos - a.nota;
    if (a.pontos <= 0 || perda <= 0) continue;
    candidatos.push({
      peso: perda / a.pontos,
      ordem: `1|${a.codigo}`,
      p: {
        tipo: "aspecto",
        codigo: a.codigo,
        titulo: `Aprofunde: ${a.descricao}`,
        detalhe: `Você fez ${numero(a.nota)} de ${numero(a.pontos)} pontos neste aspecto.`,
      },
    });
  }

  const porCategoria = new Map<CategoriaErro, number>();
  for (const e of erros) porCategoria.set(e.categoria, (porCategoria.get(e.categoria) ?? 0) + 1);
  for (const [categoria, n] of porCategoria) {
    candidatos.push({
      peso: Math.min(1, n / ERROS_PARA_PESO_MAXIMO),
      ordem: `0|${categoria}`,
      p: {
        tipo: "erro",
        categoria,
        canonico: CANONICO_POR_CATEGORIA[categoria],
        titulo: `Revise ${ROTULO_CATEGORIA[categoria]}`,
        detalhe: n === 1 ? "1 erro na redação." : `${n} erros na redação.`,
      },
    });
  }

  return candidatos
    .sort((x, y) => y.peso - x.peso || x.ordem.localeCompare(y.ordem))
    .slice(0, quantidade)
    .map((c) => c.p);
}
```

`src/core/discursiva/index.ts`:

```ts
export * from "./tipos";
export * from "./nota";
export * from "./linhas";
export * from "./erros";
export * from "./prioridades";
```

No fim de `src/core/index.ts`, acrescente:

```ts
export * from "./discursiva";
```

Em `src/core/index.test.ts`, troque a linha `"agruparPorTextoBase",` por:

```ts
      "agruparPorTextoBase", "notaConteudo", "calcularNPD", "aprovadoDiscursiva", "distribuirEmLinhas", "contarTL",
      "filtrarErrosValidos", "CANONICO_POR_CATEGORIA", "escolherPrioridades", "configDaProva", "CATEGORIAS_ERRO",
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/core`
Esperado: PASSA (inclui 5 testes de erros e 4 de prioridades).

Rode `npm run typecheck && npm run lint && npm test`. Esperado: tudo passa.

- [ ] **Passo 5: Commit**

```bash
git add src/core/discursiva src/core/index.ts src/core/index.test.ts
git commit -m "feat(core): erros de língua, mapeamento para tópicos de LP e prioridades da redação"
```

---

### Tarefa 5: peso de erro de redação no motor de foco

**Arquivos:**
- Modificar: `src/core/foco/prioridade.ts`
- Teste: `src/core/foco/prioridade.test.ts`

**Interfaces:**
- Produz: `RespostaHistorico.peso?: number` (padrão 1) e `CONFIG_FOCO.pesoErroRedacao = 0.5` (campo novo e obrigatório em `ConfigFoco`). A etapa 4 usa os dois para pôr os erros de redação no histórico.

- [ ] **Passo 1: Escrever o teste**

Em `src/core/foco/prioridade.test.ts`, troque o import por:

```ts
import { calcularPrioridades, CONFIG_FOCO, type RespostaHistorico } from "./prioridade";
```

E acrescente dentro do `describe("calcularPrioridades", ...)`, depois do último `it`:

```ts
  it("erro de redação pesa menos que item errado", () => {
    const certo = h("a/x", "certo", 0);
    const [item] = calcularPrioridades([alvo("1", "a/x")], [certo, h("a/x", "errado", 0)], agora);
    const erroRedacao = { ...h("a/x", "errado", 0), peso: CONFIG_FOCO.pesoErroRedacao };
    const [redacao] = calcularPrioridades([alvo("1", "a/x")], [certo, erroRedacao], agora);
    // item: (1 − 1) / 2 = 0; redação: (1 − 0,5) / 1,5 = 1/3
    expect(item.aproveitamento).toBeCloseTo(0, 10);
    expect(redacao.aproveitamento).toBeCloseTo(1 / 3, 10);
    expect(redacao.prioridade).toBeLessThan(item.prioridade);
  });
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/core/foco`
Esperado: FALHA (erro de tipo em `peso`/`pesoErroRedacao` ou aproveitamento 0 em vez de 1/3).

- [ ] **Passo 3: Implementar**

Em `src/core/foco/prioridade.ts`:

1. Em `interface ConfigFoco`, depois de `escalaIncerteza: number;`:
   ```ts
     // Peso de um erro de redação no histórico, relativo a um item respondido (peso 1).
     pesoErroRedacao: number;
   ```
2. Em `CONFIG_FOCO`, depois de `escalaIncerteza: 5,`:
   ```ts
     pesoErroRedacao: 0.5,
   ```
3. Em `interface RespostaHistorico`, depois de `respondidaEm: Date;`:
   ```ts
     // Padrão 1 (item respondido). Erros de redação entram com CONFIG_FOCO.pesoErroRedacao.
     peso?: number;
   ```
4. No laço de `calcularPrioridades`, troque a linha do `w` por:
   ```ts
             const w = (r.peso ?? 1) * 0.5 ** (diasEntre(r.respondidaEm, agora) / config.meiaVidaDias);
   ```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/core/foco && npm run typecheck && npm run lint && npm test`
Esperado: tudo passa.

- [ ] **Passo 5: Commit**

```bash
git add src/core/foco/prioridade.ts src/core/foco/prioridade.test.ts
git commit -m "feat(core): peso de erro de redação no motor de foco"
```

---

### Tarefa 6 (controlador): migração 0009, testes de banco e aplicação no Supabase

Feita pelo controlador, não por agente.

**Arquivos:**
- Criar: `supabase/migrations/0009_discursiva.sql`
- Modificar: `supabase/tests/stubs.sql` (Storage mínimo)
- Criar: `src/db/discursiva.dbtest.ts`
- Modificar: `src/db/migracoes.dbtest.ts` (lista de tabelas)
- Modificar: `supabase/config.toml` (`[storage] enabled = true`, para o E2E aplicar a migração com o bucket)
- Modificar: `src/db/types.ts` (gerado)

**Interfaces:**
- Produz (para as etapas 2 a 4): tabelas `temas_discursiva`, `redacoes`, `correcoes_discursiva` (única por `redacao_id, papel`), `erros_redacao`; funções `discursiva_entregar(uuid)`, `discursiva_enviar_fotos(uuid, text[])`, `discursiva_pedir_tema(text) → boolean`, `discursiva_importar_temas(jsonb) → {gravados, duplicados}` (só service role); jobs `corrigir_redacao`, `transcrever_redacao` e `gerar_tema` com `payload.pedido_por`; bucket `redacoes-fotos` com pasta `<usuario_id>/`. Limites fixos na função `discursiva_checar_limites`: 2 simultâneas e 10 por dia (horário de Maceió).

- [ ] **Passo 1: Stub do Storage para os testes de banco**

Acrescentar ao fim de `supabase/tests/stubs.sql`:

````sql
-- Storage mínimo (buckets, objetos e storage.foldername) para as políticas do bucket de fotos.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable
as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
````

- [ ] **Passo 2: Testes de banco**

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
```

Em `src/db/migracoes.dbtest.ts`, a lista de tabelas esperadas passa a ser:

```ts
      "ai_usage", "bancas", "cargo_provas", "cargos", "concursos", "correcoes_discursiva", "disciplinas",
      "erros_redacao", "fonte_dispositivos", "fontes", "item_topicos", "itens", "jobs", "prova_disciplinas", "provas",
      "redacoes", "respostas", "revisao_espacada", "seed_partes", "simulado_itens", "simulados", "temas_discursiva",
      "textos_base", "topicos", "topicos_canonicos",
```

Run: `npm run db:test:start && npm run test:db`
Esperado: FALHA (tabelas e funções da 0009 não existem).

- [ ] **Passo 3: Migração**

`supabase/migrations/0009_discursiva.sql`:

```sql
-- Corretor de discursiva (sub-projeto 2): temas, redações, correções por IA e erros de língua.
-- Ver docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md.

-- O edital passa a guardar caracteres_por_linha da prova discursiva (calibra a folha digitada).
create or replace function public.edital_gravar_estrutura(e jsonb) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_banca uuid;
  v_concurso uuid;
  c jsonb;
  p jsonb;
  d jsonb;
begin
  insert into public.bancas (slug, nome) values (e->>'banca', e->>'banca') on conflict (slug) do nothing;
  select id into v_banca from public.bancas where slug = e->>'banca';

  insert into public.concursos (slug, nome, banca_id, data_prova, ressalvas, editais_fonte)
  values (
    e->>'slug', e->>'nome', v_banca, (e->>'data_prova')::date,
    array(select jsonb_array_elements_text(coalesce(e->'ressalvas', '[]'))),
    array(select jsonb_array_elements_text(e->'editais_fonte'))
  )
  on conflict (slug) do update set nome = excluded.nome, banca_id = excluded.banca_id, data_prova = excluded.data_prova,
    ressalvas = excluded.ressalvas, editais_fonte = excluded.editais_fonte, atualizado_em = now()
  returning id into v_concurso;

  for c in select value from jsonb_array_elements(e->'cargos') loop
    insert into public.cargos (concurso_id, slug, nome, qualificacoes, duracao_min, corte_conjunto)
    values (
      v_concurso, c->>'slug', c->>'nome',
      array(select jsonb_array_elements_text(coalesce(c->'qualificacoes', '[]'))),
      (c->>'duracao_min')::integer, c->'corte_conjunto'
    )
    on conflict (concurso_id, slug) do update set nome = excluded.nome, qualificacoes = excluded.qualificacoes,
      duracao_min = excluded.duracao_min, corte_conjunto = excluded.corte_conjunto;
  end loop;

  for p in select value from jsonb_array_elements(e->'provas') loop
    insert into public.provas (concurso_id, slug, nome, tipo, formato, n_itens, alternativas,
                               regra_pontuacao, regra_corte, distribuicao, config_discursiva)
    values (
      v_concurso, p->>'slug', p->>'nome', p->>'tipo', p->>'formato', (p->>'itens')::integer,
      (p->>'alternativas')::integer, p->'pontuacao', p->'corte', p->'distribuicao_estimada',
      case when p->>'tipo' = 'discursiva' then jsonb_build_object(
        'pontuacao_maxima', p->'pontuacao_maxima', 'linhas_max', p->'linhas_max', 'nota_minima', p->'nota_minima',
        'caracteres_por_linha', coalesce(p->'caracteres_por_linha', '70'::jsonb)
      ) end
    )
    on conflict (concurso_id, slug) do update set nome = excluded.nome, tipo = excluded.tipo, formato = excluded.formato,
      n_itens = excluded.n_itens, alternativas = excluded.alternativas, regra_pontuacao = excluded.regra_pontuacao,
      regra_corte = excluded.regra_corte, distribuicao = excluded.distribuicao, config_discursiva = excluded.config_discursiva;
  end loop;

  for d in select value from jsonb_array_elements(e->'disciplinas') loop
    insert into public.disciplinas (concurso_id, slug, nome) values (v_concurso, d->>'slug', d->>'nome')
    on conflict (concurso_id, slug) do update set nome = excluded.nome;
  end loop;

  return v_concurso;
end
$$;
revoke all on function public.edital_gravar_estrutura(jsonb) from public, anon, authenticated;

create table public.temas_discursiva (
  id uuid primary key default gen_random_uuid(),
  concurso_id uuid not null references public.concursos (id) on delete cascade,
  prova_id uuid not null references public.provas (id) on delete cascade,
  tipo text not null default 'dissertativo' check (tipo in ('dissertativo')),
  origem text not null check (origem in ('gerado', 'real')),
  prova_origem text,
  status text not null check (status in ('aprovado', 'revisao', 'rejeitado')),
  enunciado text not null check (length(trim(enunciado)) > 0),
  textos_apoio jsonb not null default '[]',
  padrao_resposta jsonb not null,
  hash text not null,
  criado_em timestamptz not null default now(),
  unique (concurso_id, hash),
  constraint temas_real_tem_origem check (origem <> 'real' or prova_origem is not null)
);

create table public.redacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tema_id uuid not null references public.temas_discursiva (id),
  simulado_id uuid references public.simulados (id) on delete set null,
  entrada text not null default 'digitada' check (entrada in ('digitada', 'foto')),
  linhas text[] not null default '{}' check (coalesce(array_length(linhas, 1), 0) <= 30),
  excedente text[] not null default '{}',
  status text not null default 'rascunho' check (status in (
    'rascunho', 'transcrevendo', 'aguardando_confirmacao', 'na_fila', 'corrigindo', 'corrigida', 'falhou'
  )),
  aviso text,
  nc numeric(5, 2),
  ne integer,
  tl integer,
  npd numeric(5, 2),
  zerada_motivo text check (zerada_motivo in ('fuga_tema', 'sem_texto', 'npd_negativo')),
  terceira_correcao boolean not null default false,
  prioridades jsonb,
  fotos text[] not null default '{}',
  fotos_apagar_em timestamptz,
  entregue_em timestamptz,
  corrigida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index redacoes_usuario_idx on public.redacoes (usuario_id, criado_em desc);

create table public.correcoes_discursiva (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes (id) on delete cascade,
  papel text not null check (papel in ('conteudo_1', 'conteudo_2', 'conteudo_3', 'lingua', 'transcricao')),
  provedor text not null check (provedor in ('anthropic', 'openai')),
  modelo text not null,
  resposta jsonb not null,
  custo_usd numeric(10, 6) not null default 0,
  criado_em timestamptz not null default now(),
  -- Uma correção por papel: é o que torna a retomada idempotente.
  unique (redacao_id, papel)
);

create table public.erros_redacao (
  id uuid primary key default gen_random_uuid(),
  redacao_id uuid not null references public.redacoes (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  linha integer not null check (linha between 1 and 30),
  trecho text not null,
  tipo text not null check (tipo in ('grafia', 'morfossintaxe', 'propriedade_vocabular')),
  categoria text not null,
  correcao text not null,
  explicacao text not null,
  canonico text not null,
  criado_em timestamptz not null default now()
);
create index erros_redacao_usuario_idx on public.erros_redacao (usuario_id, criado_em desc);

alter table public.temas_discursiva enable row level security;
alter table public.redacoes enable row level security;
alter table public.correcoes_discursiva enable row level security;
alter table public.erros_redacao enable row level security;

create policy "le temas aprovados" on public.temas_discursiva for select to authenticated using (status = 'aprovado');

create policy "dono le" on public.redacoes for select to authenticated using (usuario_id = (select auth.uid()));
create policy "dono cria rascunho" on public.redacoes for insert to authenticated with check (
  usuario_id = (select auth.uid())
  and status = 'rascunho'
  and exists (select 1 from public.temas_discursiva t where t.id = tema_id)
  and (simulado_id is null or exists (
    select 1 from public.simulados s where s.id = simulado_id and s.user_id = (select auth.uid())
  ))
);
create policy "dono edita enquanto escreve" on public.redacoes for update to authenticated
  using (usuario_id = (select auth.uid()) and status in ('rascunho', 'aguardando_confirmacao'))
  with check (usuario_id = (select auth.uid()) and status in ('rascunho', 'aguardando_confirmacao'));
create policy "dono apaga rascunho" on public.redacoes for delete to authenticated
  using (usuario_id = (select auth.uid()) and status = 'rascunho');
-- O usuário só escreve o texto; estado e notas mudam pelas funções abaixo ou pelo worker (service role).
revoke insert, update on public.redacoes from authenticated, anon;
grant insert (usuario_id, tema_id, simulado_id, linhas, excedente) on public.redacoes to authenticated;
grant update (linhas, excedente) on public.redacoes to authenticated;

create policy "dono le" on public.correcoes_discursiva for select to authenticated using (
  exists (select 1 from public.redacoes r where r.id = redacao_id and r.usuario_id = (select auth.uid()))
);
create policy "dono le" on public.erros_redacao for select to authenticated using (usuario_id = (select auth.uid()));

-- Fotos da folha: bucket privado, cada usuário só na própria pasta (<usuario_id>/...).
insert into storage.buckets (id, name, public) values ('redacoes-fotos', 'redacoes-fotos', false)
on conflict (id) do nothing;
create policy "redacoes-fotos: dono envia" on storage.objects for insert to authenticated with check (
  bucket_id = 'redacoes-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "redacoes-fotos: dono le" on storage.objects for select to authenticated using (
  bucket_id = 'redacoes-fotos' and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Limites por usuário: redações em correção ao mesmo tempo e entregas por dia (horário de Maceió).
create or replace function public.discursiva_checar_limites(p_usuario uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c_simultaneas constant integer := 2;
  c_por_dia constant integer := 10;
begin
  if (select count(*) from public.redacoes
      where usuario_id = p_usuario and status in ('transcrevendo', 'na_fila', 'corrigindo')) >= c_simultaneas then
    raise exception 'limite_simultaneas' using hint = 'Espere uma correção terminar.';
  end if;
  if (select count(*) from public.redacoes
      where usuario_id = p_usuario
        and entregue_em >= (date_trunc('day', now() at time zone 'America/Maceio') at time zone 'America/Maceio')) >= c_por_dia then
    raise exception 'limite_diario' using hint = 'O limite diário de correções foi atingido.';
  end if;
end
$$;

-- Entrega para correção: valida dono e estado, aplica limites e enfileira o job.
create or replace function public.discursiva_entregar(p_redacao uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_status text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  select status into v_status from public.redacoes where id = p_redacao and usuario_id = v_usuario for update;
  if v_status is null then
    raise exception 'redação não encontrada';
  end if;
  if v_status not in ('rascunho', 'aguardando_confirmacao', 'falhou') then
    raise exception 'redação não pode ser entregue no estado %', v_status;
  end if;
  perform public.discursiva_checar_limites(v_usuario);
  update public.redacoes
  set status = 'na_fila', aviso = null, entregue_em = now(), atualizado_em = now()
  where id = p_redacao;
  insert into public.jobs (tipo, payload)
  values ('corrigir_redacao', jsonb_build_object('redacao_id', p_redacao, 'pedido_por', v_usuario));
end
$$;

-- Fotos já enviadas ao Storage: registra os caminhos e enfileira a transcrição.
create or replace function public.discursiva_enviar_fotos(p_redacao uuid, p_fotos text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_status text;
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  if coalesce(array_length(p_fotos, 1), 0) not between 1 and 2 then
    raise exception 'envie 1 ou 2 fotos';
  end if;
  if exists (select 1 from unnest(p_fotos) f where f not like v_usuario::text || '/%') then
    raise exception 'foto fora da pasta do usuário';
  end if;
  select status into v_status from public.redacoes where id = p_redacao and usuario_id = v_usuario for update;
  if v_status is null then
    raise exception 'redação não encontrada';
  end if;
  if v_status <> 'rascunho' then
    raise exception 'redação não pode receber fotos no estado %', v_status;
  end if;
  perform public.discursiva_checar_limites(v_usuario);
  update public.redacoes
  set entrada = 'foto', fotos = p_fotos, status = 'transcrevendo', aviso = null, atualizado_em = now()
  where id = p_redacao;
  insert into public.jobs (tipo, payload)
  values ('transcrever_redacao', jsonb_build_object('redacao_id', p_redacao, 'pedido_por', v_usuario));
end
$$;

-- Pede um tema novo gerado por IA; no máximo um pedido aberto por usuário. Devolve se enfileirou.
create or replace function public.discursiva_pedir_tema(p_concurso text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
begin
  if v_usuario is null then
    raise exception 'não autenticado';
  end if;
  if not exists (select 1 from public.concursos where slug = p_concurso) then
    raise exception 'concurso desconhecido: %', p_concurso;
  end if;
  if exists (
    select 1 from public.jobs
    where tipo = 'gerar_tema' and status in ('pendente', 'processando') and payload->>'pedido_por' = v_usuario::text
  ) then
    return false;
  end if;
  insert into public.jobs (tipo, payload)
  values ('gerar_tema', jsonb_build_object('concurso', p_concurso, 'pedido_por', v_usuario));
  return true;
end
$$;

-- Importa temas reais já validados pelo app: {concurso, prova_origem, temas: [{enunciado, textos_apoio, padrao_resposta}]}.
-- Devolve {gravados, duplicados} (índices, base 0, dos temas que já existiam).
create or replace function public.discursiva_importar_temas(p_lote jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_concurso uuid;
  v_prova uuid;
  v_origem text := nullif(trim(p_lote->>'prova_origem'), '');
  v_gravados integer := 0;
  v_duplicados integer[] := '{}';
  v_id uuid;
  t jsonb;
  n integer;
begin
  select c.id, p.id into v_concurso, v_prova
  from public.concursos c join public.provas p on p.concurso_id = c.id and p.tipo = 'discursiva'
  where c.slug = p_lote->>'concurso'
  limit 1;
  if v_prova is null then
    raise exception 'concurso sem prova discursiva: %', p_lote->>'concurso';
  end if;
  if v_origem is null then
    raise exception 'prova de origem obrigatória';
  end if;
  for t, n in select value, (ordinality - 1)::integer from jsonb_array_elements(p_lote->'temas') with ordinality loop
    insert into public.temas_discursiva
      (concurso_id, prova_id, origem, prova_origem, status, enunciado, textos_apoio, padrao_resposta, hash)
    values (
      v_concurso, v_prova, 'real', v_origem, 'aprovado', t->>'enunciado', coalesce(t->'textos_apoio', '[]'),
      t->'padrao_resposta', md5(lower(regexp_replace(trim(t->>'enunciado'), '\s+', ' ', 'g')))
    )
    on conflict (concurso_id, hash) do nothing
    returning id into v_id;
    if v_id is null then
      v_duplicados := v_duplicados || n;
    else
      v_gravados := v_gravados + 1;
    end if;
    v_id := null;
  end loop;
  return jsonb_build_object('gravados', v_gravados, 'duplicados', to_jsonb(v_duplicados));
end
$$;

revoke all on function public.discursiva_checar_limites(uuid) from public, anon, authenticated;
revoke all on function public.discursiva_entregar(uuid) from public, anon;
revoke all on function public.discursiva_enviar_fotos(uuid, text[]) from public, anon;
revoke all on function public.discursiva_pedir_tema(text) from public, anon;
revoke all on function public.discursiva_importar_temas(jsonb) from public, anon, authenticated;
grant execute on function public.discursiva_entregar(uuid) to authenticated;
grant execute on function public.discursiva_enviar_fotos(uuid, text[]) to authenticated;
grant execute on function public.discursiva_pedir_tema(text) to authenticated;
grant execute on function public.discursiva_importar_temas(jsonb) to service_role;
```

Run: `npm run test:db`
Esperado: PASSA (56 testes, 20 novos).

- [ ] **Passo 4: Storage no Supabase local**

Em `supabase/config.toml`, na seção `[storage]`, `enabled = true`. Rodar o E2E local (`npx supabase start` + `npm run test:e2e`) para confirmar que a migração aplica com o bucket.

- [ ] **Passo 5: Aplicar no Supabase remoto e gerar tipos**

1. `apply_migration` (MCP do Supabase) com o conteúdo da 0009, nome `0009_discursiva`.
2. Recarregar o edital: executar `supabase/seed/cbmal-2026.sql` (é idempotente) e conferir `select config_discursiva from provas where slug = 'discursiva'` → inclui `"caracteres_por_linha": 70`.
3. `get_advisors` (security): conferir que não há alerta novo além dos já aceitos.
4. `generate_typescript_types` → `src/db/types.ts`.

Rode `npm run typecheck && npm run lint && npm test && npm run test:db`. Esperado: tudo passa.

- [ ] **Passo 6: Commit e push**

```bash
git add supabase/migrations/0009_discursiva.sql supabase/tests/stubs.sql supabase/config.toml src/db/discursiva.dbtest.ts src/db/migracoes.dbtest.ts src/db/types.ts
git commit -m "feat(db): esquema da discursiva (temas, redações, correções, erros, fotos)"
git push
```

---

## Depois desta etapa

- **Etapa 2 (pipeline):** prompts e schemas das IAs, jobs `gerar_tema`, `transcrever_redacao` e `corrigir_redacao` no worker, usando `notaConteudo`, `calcularNPD`, `filtrarErrosValidos` e `escolherPrioridades`.
- **Etapa 4 (integração):** `estudo_historico` passa a incluir os erros de redação com `peso = CONFIG_FOCO.pesoErroRedacao`. O painel separa a tendência das objetivas, para não misturar com os erros de redação.

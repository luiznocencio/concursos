# Plano 8 — Corretor de discursiva, etapa 3: telas

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar tarefa por tarefa. Os passos usam caixas (`- [ ]`) para acompanhamento.

**Objetivo:** dar ao usuário as telas da redação: escolher ou gerar um tema, escrever na folha de 30 linhas (ou enviar a foto da folha), conferir a transcrição, acompanhar a correção e ver o resultado no estilo Cebraspe.

**Arquitetura:**
- **`/redacao`:** lista as redações e os temas, e pede tema novo.
- **`/redacao/[id]`:** uma página que muda de tela conforme o estado da redação:
  - rascunho → escrita e foto;
  - aguardando_confirmacao → conferência;
  - transcrevendo, na_fila ou corrigindo → andamento;
  - corrigida → resultado;
  - falhou → tentar de novo.
- **Dados:** as leituras e escritas usam o cliente do usuário (RLS) em `src/db/repositorios/redacao.ts`. As mudanças de estado passam pelas funções do banco da etapa 1.
- **Texto e folha:** o texto digitado fica em `redacoes.texto` (migração 0011). As linhas da folha são recalculadas no servidor com `distribuirEmLinhas`.
- **Fotos:** vão do navegador direto para o Storage, na pasta do usuário.

**Stack:** Next.js 16.4 (App Router, Server Actions), React 19.3, Tailwind v4 com os tokens de `globals.css`, `@phosphor-icons/react`, Supabase (`@supabase/ssr`), Playwright.

Especificação: `docs/superpowers/specs/2026-10-15-corretor-discursiva-design.md` (§6). Usa os planos 6 (núcleo e banco) e 7 (pipeline).

## Restrições globais

- Código, comentários, textos de tela e commits em português, no estilo do código existente.
- Visual de `docs/design/DESIGN.md`:
  - só os tokens e as classes de `src/components/ui.ts`, nada de `bg-white`, `text-black` ou hex;
  - um só botão azul cheio por tela;
  - nenhum estouro horizontal em 390 px.
- Antes de mexer em algo do Next, consulte `node_modules/next/dist/docs/` (veja `AGENTS.md`).
- Nenhum teste chama IA real. O worker não roda no E2E: os testes param na fila ou semeiam o resultado direto no banco local.
- Agentes: **não** deem push; **não** alterem `.env.local`, `src/db/types.ts`, `supabase/migrations/` nem o Supabase remoto. A Tarefa 1 é do controlador.
- Cada tarefa termina com `npm run typecheck`, `npm run lint` e `npm test` passando, e um commit com as linhas finais:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011ToQbiqbi5jXjUo6r9BQ2G
  ```

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0011_redacoes_texto.sql` | coluna `texto` (controlador) |
| `src/lib/redacao.ts` | rótulos de estado, passos do andamento, marcação dos erros na linha, mensagens do banco, validação da foto, resumo do tema |
| `src/db/supabase/navegador.ts` | cliente Supabase do navegador (envio das fotos) |
| `src/db/repositorios/redacao.ts` | leitura e escrita das redações pelo usuário |
| `src/app/(app)/redacao/acoes.ts` | Server Actions: nova redação, tema novo, salvar, entregar, fotos, confirmar transcrição, tentar de novo |
| `src/components/redacao/folha-escrita.tsx` | escrita com folha de 30 linhas, salvamento automático e entrega |
| `src/components/redacao/envio-foto.tsx` | escolha, redução e envio das fotos |
| `src/components/redacao/conferencia-foto.tsx` | foto ao lado das linhas transcritas |
| `src/components/redacao/andamento.tsx` | passos da correção, com atualização a cada 5 s |
| `src/components/redacao/resultado.tsx` | espelho da correção |
| `src/app/(app)/redacao/page.tsx` | lista de redações e temas |
| `src/app/(app)/redacao/[id]/page.tsx` | a redação, por estado |
| `e2e/redacao.spec.ts` | escrita, resultado, foto e pedido de tema |

---

### Tarefa 1 (controlador): migração 0011 e tipos

Feita pelo controlador, não por agente.

**Arquivos:**
- Criar: `supabase/migrations/0011_redacoes_texto.sql`
- Modificar: `src/db/types.ts` (`texto` em `redacoes`), `src/db/discursiva.dbtest.ts`

- [ ] **Passo 1: Teste de banco**

Em `src/db/discursiva.dbtest.ts`, antes de `it("correções e erros só para o dono da redação", ...)`:

```ts
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
```

Run: `npm run test:db`. Esperado: FALHA (coluna `texto` não existe).

- [ ] **Passo 2: Migração**

`supabase/migrations/0011_redacoes_texto.sql`:

```sql
-- Texto digitado da redação, como o usuário escreveu (com os parágrafos). As linhas da folha
-- (linhas/excedente) são derivadas dele no servidor; na entrada por foto, o texto fica vazio.
alter table public.redacoes add column texto text not null default '';
grant update (texto) on public.redacoes to authenticated;
```

Run: `npm run test:db`. Esperado: PASSA (57 testes).

- [ ] **Passo 3: Aplicar e gerar tipos**

`apply_migration` no remoto (nome `0011_redacoes_texto`). Em `src/db/types.ts`, em `redacoes`, acrescentar:
- `texto: string` no Row;
- `texto?: string` no Insert e no Update.

- [ ] **Passo 4: Commit e push**

```bash
git add supabase/migrations/0011_redacoes_texto.sql src/db/types.ts src/db/discursiva.dbtest.ts
git commit -m "feat(db): texto digitado da redação"
git push
```

---

### Tarefa 2: funções puras das telas e cliente do navegador

**Arquivos:**
- Criar: `src/lib/redacao.ts`, `src/db/supabase/navegador.ts`
- Teste: `src/lib/redacao.test.ts`
- Modificar: `src/db/repositorios/estudo.ts` (`listarCargos` devolve `concursoSlug`)

**Interfaces:**
- Produz:
  - **Constantes e tipos:** `BUCKET_FOTOS`, `StatusRedacao`, `Passo`, `Segmento`.
  - **Rótulos e passos:** `rotuloStatus(status): { texto; tom: keyof typeof pilula }`, `passosDoAndamento(status, papeis): Passo[]`.
  - **Erros e mensagens:** `segmentosDaLinha(linha, erros): Segmento[]`, `mensagemDoBanco(mensagem): string`.
  - **Foto e tema:** `validarFoto({type, size}): string | null`, `resumoDoTema(enunciado): string`.
  - **Navegador:** `criarClienteNavegador()`.
  - **Cargo:** `cargo.concursoSlug` em `contextoDoUsuario()`.

- [ ] **Passo 1: Escrever o teste**

`src/lib/redacao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mensagemDoBanco, passosDoAndamento, resumoDoTema, rotuloStatus, segmentosDaLinha, validarFoto } from "./redacao";

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
```

- [ ] **Passo 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/redacao.test.ts`
Esperado: FALHA (módulo não existe).

- [ ] **Passo 3: Implementar**

`src/lib/redacao.ts`:

```ts
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
```

`src/db/supabase/navegador.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";
import { lerEnvSupabase } from "../env";
import type { Database } from "../types";

// Cliente do navegador (sessão nos cookies do usuário, com RLS). Usado só para enviar as fotos da redação ao Storage.
export function criarClienteNavegador() {
  const { url, chave } = lerEnvSupabase();
  return createBrowserClient<Database>(url, chave);
}
```

Em `src/db/repositorios/estudo.ts`, na função `listarCargos`, depois de `concurso: c.concursos.nome,`, acrescente:

```ts
    concursoSlug: c.concursos.slug,
```

- [ ] **Passo 4: Rodar e ver passar**

Run: `npx vitest run src/lib && npm run typecheck`
Esperado: PASSA (11 testes novos).

- [ ] **Passo 5: Commit**

```bash
git add src/lib/redacao.ts src/lib/redacao.test.ts src/db/supabase/navegador.ts src/db/repositorios/estudo.ts
git commit -m "feat(redacao): funções das telas e cliente do navegador"
```

---

### Tarefa 3: repositório do usuário e Server Actions

**Arquivos:**
- Criar: `src/db/repositorios/redacao.ts`, `src/app/(app)/redacao/acoes.ts`

**Interfaces:**
- Consome: `distribuirEmLinhas` (`@/core`), `mensagemDoBanco` e `BUCKET_FOTOS` (Tarefa 2), `Retorno` de `src/app/(app)/sessao/[id]/acoes.ts`, `contextoDoUsuario`/`exigirCargo`.
- Produz:
  - **Repositório:**
    - `ErroRedacao`, `TemaResumo`, `RedacaoResumo`, `RedacaoCompleta`;
    - `listarTemas`, `listarRedacoes`, `criarRedacao`, `carregarRedacao`, `salvarTexto`;
    - `entregarRedacao`, `enviarFotos`, `pedirTema`, `urlsDasFotos`, `configDaDiscursiva`.
  - **Server Actions:**
    - `novaRedacao(formData)` e `pedirNovoTema()`;
    - `salvarRascunho(id, texto): Retorno<{linhas, excedente}>` e `entregar(id, texto): Retorno<null>`;
    - `registrarFotos(id, caminhos)` e `confirmarTranscricao(id, linhas)`;
    - `tentarDeNovo(id)`.
- Não há teste unitário (é acesso ao Supabase): o E2E da Tarefa 6 cobre.

- [ ] **Passo 1: Implementar o repositório**

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

export async function criarRedacao(db: Cliente, usuarioId: string, temaId: string): Promise<string> {
  const { data, error } = await db.from("redacoes").insert({ usuario_id: usuarioId, tema_id: temaId }).select("id").single();
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
```

- [ ] **Passo 2: Implementar as Server Actions**

`src/app/(app)/redacao/acoes.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { distribuirEmLinhas } from "@/core";
import {
  carregarRedacao,
  criarRedacao,
  entregarRedacao,
  enviarFotos,
  ErroRedacao,
  pedirTema,
  salvarTexto,
} from "@/db/repositorios/redacao";
import { mensagemDoBanco } from "@/lib/redacao";
import type { Retorno } from "../sessao/[id]/acoes";
import { contextoDoUsuario, exigirCargo } from "../contexto";

const MAX_TEXTO = 20_000;

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroRedacao) return { ok: false, erro: mensagemDoBanco(e.message) };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function novaRedacao(formData: FormData) {
  const { db, user } = await contextoDoUsuario();
  const temaId = String(formData.get("tema") ?? "");
  if (!temaId) redirect("/redacao");
  const id = await criarRedacao(db, user.id, temaId);
  redirect(`/redacao/${id}`);
}

export async function pedirNovoTema() {
  const { db, cargo } = await exigirCargo();
  const enfileirou = await pedirTema(db, cargo.concursoSlug);
  redirect(`/redacao?aviso=${enfileirou ? "tema-pedido" : "tema-ja-pedido"}`);
}

// Grava o texto e as linhas da folha calculadas no servidor (o mesmo cálculo que a tela mostra).
export async function salvarRascunho(
  id: string,
  texto: string,
): Promise<Retorno<{ linhas: string[]; excedente: string[] }>> {
  const { db } = await contextoDoUsuario();
  try {
    const r = await carregarRedacao(db, id);
    if (!r) return { ok: false, erro: "Redação não encontrada." };
    if (r.status !== "rascunho") return { ok: false, erro: "Esta redação já foi entregue. Atualize a página." };
    const limpo = texto.slice(0, MAX_TEXTO);
    const folha = distribuirEmLinhas(limpo, r.config.caracteresPorLinha, r.config.linhasMax);
    await salvarTexto(db, id, { texto: limpo, ...folha });
    return { ok: true, dados: folha };
  } catch (e) {
    return falha(e);
  }
}

export async function entregar(id: string, texto: string): Promise<Retorno<null>> {
  const salvo = await salvarRascunho(id, texto);
  if (!salvo.ok) return salvo;
  const { db } = await contextoDoUsuario();
  try {
    await entregarRedacao(db, id);
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// As fotos já foram enviadas pelo navegador ao Storage, na pasta do usuário.
export async function registrarFotos(id: string, caminhos: string[]): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await enviarFotos(db, id, caminhos.slice(0, 2));
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// Confirma a transcrição conferida pelo usuário e entrega para correção.
export async function confirmarTranscricao(id: string, linhas: string[]): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    const r = await carregarRedacao(db, id);
    if (!r) return { ok: false, erro: "Redação não encontrada." };
    if (r.status !== "aguardando_confirmacao") return { ok: false, erro: "Esta redação já foi entregue. Atualize a página." };
    const limpas = linhas.slice(0, r.config.linhasMax).map((l) => String(l).replace(/\s+/g, " ").trim().slice(0, 200));
    while (limpas.length > 0 && limpas[limpas.length - 1] === "") limpas.pop();
    await salvarTexto(db, id, { linhas: limpas, excedente: r.excedente });
    await entregarRedacao(db, id);
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// "Tentar de novo" de uma correção que falhou: a função do banco aceita reentregar a partir de "falhou".
export async function tentarDeNovo(id: string) {
  const { db } = await contextoDoUsuario();
  try {
    await entregarRedacao(db, id);
  } catch (e) {
    if (!(e instanceof ErroRedacao)) throw e;
    redirect(`/redacao/${id}?erro=${encodeURIComponent(mensagemDoBanco(e.message))}`);
  }
  redirect(`/redacao/${id}`);
}
```

- [ ] **Passo 3: Verificar**

Run: `npm run typecheck && npm run lint && npm test`
Esperado: tudo passa.

- [ ] **Passo 4: Commit**

```bash
git add src/db/repositorios/redacao.ts "src/app/(app)/redacao/acoes.ts"
git commit -m "feat(redacao): repositório do usuário e ações das telas"
```

---

### Tarefa 4: componentes de escrita, foto, conferência e andamento

**Arquivos:**
- Criar: `src/components/redacao/folha-escrita.tsx`, `envio-foto.tsx`, `conferencia-foto.tsx`, `andamento.tsx`

**Interfaces:**
- Consome as ações da Tarefa 3 e as funções da Tarefa 2.
- Produz:
  - `FolhaEscrita({ redacaoId, textoInicial, config })`;
  - `EnvioFoto({ redacaoId, usuarioId })`;
  - `ConferenciaFoto({ redacaoId, fotos, linhasIniciais, duvidosas, linhasMax })`;
  - `Andamento({ passos })`.
- Comportamentos:
  - **Salvamento:** automático 1,5 s depois da última tecla.
  - **Entrega:** pede confirmação antes de entregar.
  - **Fotos:** reduzidas a no máximo 2000 px e enviadas como JPEG para `<usuario>/<redacao>/<instante>-<n>.jpg`.
  - **Andamento:** `router.refresh()` a cada 5 s.

- [ ] **Passo 1: Implementar**

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
export function FolhaEscrita({ redacaoId, textoInicial, config }: { redacaoId: string; textoInicial: string; config: ConfigDiscursiva }) {
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
      <div className="grid gap-6 lg:grid-cols-2">
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
            <TempoEscrevendo inicio={inicio} />
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
        for (const [i, arquivo] of arquivos.entries()) {
          const caminho = `${usuarioId}/${redacaoId}/${Date.now()}-${i + 1}.jpg`;
          const { error } = await db.storage
            .from(BUCKET_FOTOS)
            .upload(caminho, await reduzirFoto(arquivo), { contentType: "image/jpeg" });
          if (error) throw error;
          caminhos.push(caminho);
        }
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
      <button type="button" onClick={enviar} disabled={arquivos.length === 0 || enviando} className={`${botao.contorno} self-start`}>
        {enviando ? "Enviando…" : "Enviar para transcrição"}
      </button>
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
        <button type="button" onClick={confirmar} disabled={enviando} className={`${botao.primario} self-start`}>
          {enviando ? "Entregando…" : "Confirmar e entregar para correção"}
        </button>
      </div>
    </div>
  );
}
```

`src/components/redacao/andamento.tsx`:

```tsx
"use client";

import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Passo } from "@/lib/redacao";

const INTERVALO_MS = 5000;

// Enquanto o worker trabalha, recarrega os dados da página a cada 5 s; a página troca de tela quando o estado muda.
export function Andamento({ passos }: { passos: Passo[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), INTERVALO_MS);
    return () => clearInterval(t);
  }, [router]);

  return (
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
  );
}
```

- [ ] **Passo 2: Verificar**

Run: `npm run typecheck && npm run lint && npm test`
Esperado: tudo passa.

- [ ] **Passo 3: Commit**

```bash
git add src/components/redacao
git commit -m "feat(redacao): escrita na folha, envio de foto, conferência e andamento"
```

---

### Tarefa 5: resultado, páginas e navegação

**Arquivos:**
- Criar: `src/components/redacao/resultado.tsx`, `src/app/(app)/redacao/page.tsx`, `src/app/(app)/redacao/[id]/page.tsx`
- Modificar: `src/app/(app)/layout.tsx`, `src/components/aviso.tsx`

**Interfaces:**
- Consome:
  - `notasPorAspecto` e `correcaoConteudoSchema` (`src/pipeline/discursiva/`);
  - `ROTULO_CATEGORIA` (`@/core`);
  - `treinarTopicos` (`src/app/(app)/acoes.ts`);
  - `Evolucao` (`src/components/painel/evolucao.tsx`).
- Produz: rotas `/redacao` e `/redacao/[id]`, item "Redação" no cabeçalho e os avisos `tema-pedido` e `tema-ja-pedido`.

- [ ] **Passo 1: Resultado e páginas**

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
                    <button type="submit" className={botao.secundario}>
                      Treinar 10 itens
                    </button>
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

export default async function Redacoes({ searchParams }: { searchParams: Promise<{ aviso?: string }> }) {
  const { aviso } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const [temas, redacoes, config] = await Promise.all([
    listarTemas(db, cargo.concursoSlug),
    listarRedacoes(db),
    configDaDiscursiva(db, cargo.concursoSlug),
  ]);
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
          <form action={pedirNovoTema}>
            <button type="submit" className={botao.secundario}>
              Gerar tema novo
            </button>
          </form>
        </div>
        {temas.length === 0 ? (
          <p className={`${textoApoio} mt-3`}>Nenhum tema ainda. Gere um tema novo: fica pronto em cerca de 1 minuto.</p>
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
                  <button type="submit" className={botao.contorno}>
                    Escrever sobre este tema
                  </button>
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
            <button type="submit" className={botao.primario}>
              Tentar de novo
            </button>
          </form>
        </section>
      );
    default:
      return (
        <section className={`${cartao} flex flex-col gap-6`}>
          <Andamento passos={passosDoAndamento(r.status, r.correcoes.map((c) => c.papel))} />
          <p className={textoApoio}>Leva cerca de 1 minuto. Pode sair desta página: a correção continua e fica salva em Redações.</p>
        </section>
      );
  }
}
```

- [ ] **Passo 2: Navegação e avisos**

Em `src/app/(app)/layout.tsx`, logo depois de `<NavLink href="/simulado">Simulado</NavLink>`:

```tsx
            <NavLink href="/redacao">Redação</NavLink>
```

Em `src/components/aviso.tsx`, na função `mensagem`, antes de `case "encerrada":`:

```ts
    case "tema-pedido":
      return "Pedimos um tema novo. Ele aparece na lista em cerca de 1 minuto, se a revisão por outra IA aprovar; se não aparecer, peça outro.";
    case "tema-ja-pedido":
      return "Você já tem um tema novo a caminho. Espere ele ficar pronto para pedir outro.";
```

- [ ] **Passo 3: Verificar**

Run: `npm run typecheck && npm run lint && npm test && NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x npm run build`
Esperado: tudo passa, e o build lista `/redacao` e `/redacao/[id]`.

- [ ] **Passo 4: Commit**

```bash
git add src/components/redacao/resultado.tsx "src/app/(app)/redacao" "src/app/(app)/layout.tsx" src/components/aviso.tsx
git commit -m "feat(redacao): telas de redações, resultado e item no menu"
```

---

### Tarefa 6: testes de ponta a ponta

**Arquivos:**
- Criar: `e2e/redacao.spec.ts`

**Interfaces:**
- Consome o fixture `usuarioLogado`/`admin` (`e2e/fixtures.ts`) e a função `discursiva_importar_temas` para semear temas.

- [ ] **Passo 1: Escrever os testes**

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

test("pedir tema novo enfileira um pedido por vez", async ({ page, admin, usuarioLogado }) => {
  await page.goto("/redacao");
  await page.getByRole("button", { name: "Gerar tema novo" }).click();
  await expect(page.getByText(/Pedimos um tema novo/)).toBeVisible();
  await page.getByRole("button", { name: "Gerar tema novo" }).click();
  await expect(page.getByText(/já tem um tema novo a caminho/)).toBeVisible();
  const { data: jobs } = await admin.from("jobs").select("tipo, status, payload").eq("payload->>pedido_por", usuarioLogado.id);
  expect(jobs).toEqual([{ tipo: "gerar_tema", status: "pendente", payload: { concurso: "cbmal-2026", pedido_por: usuarioLogado.id } }]);
});
```

- [ ] **Passo 2: Rodar contra o Supabase local**

Com o Supabase local de pé (`npx supabase start`; veja `docs/testes.md`) e com as migrações até a 0011 aplicadas, rode:

Run: `npm run test:e2e`
Esperado: todos passam (os 11 anteriores e os 4 novos).

Se o Docker deste ambiente não permitir subir o Supabase, registre o erro no relatório e siga. O CI do PR roda o E2E.

- [ ] **Passo 3: Commit**

```bash
git add e2e/redacao.spec.ts
git commit -m "test(e2e): redação — escrita, resultado, foto e pedido de tema"
```

---

## Validação feita antes deste plano

O código deste plano foi escrito e testado numa cópia à parte:
- **Testes:** 290 unitários e 57 de banco, além de typecheck e lint.
- **E2E:** com o build de produção contra o Supabase local (Storage ligado, migrações até a 0011), todos os 15 testes passaram: os 11 anteriores e os 4 novos.
  - **Escrita:** o texto vai para a folha e é salvo sozinho. Depois de recarregar a página o texto continua lá, e a entrega cria o job `corrigir_redacao`.
  - **Resultado:** a nota aparece com a conta do NPD, as notas de cada banca e os erros marcados com link. O botão de treino leva a uma sessão. Nada estoura a largura em 390 px.
  - **Foto:** a foto sobe ao Storage na pasta do usuário. A redação passa para `transcrevendo`, e as linhas com leitura incerta ficam destacadas na conferência. A confirmação entrega para correção.
  - **Tema:** o pedido de tema novo enfileira um job, e um segundo pedido é recusado enquanto o primeiro está aberto.
- **Visual:** capturas de tela em 390 px e 1280 px, nos temas claro e escuro, das telas de lista, escrita, andamento e resultado.

## Depois desta etapa

- **Etapa 4 (integração):** a discursiva entra no simulado completo, os erros de redação passam a contar no motor de foco e no painel, e a tela de importação ganha os temas reais.
- **Primeira correção real em produção:** conferir a resposta do GPT na banca 2 e o custo por correção em `ai_usage`.

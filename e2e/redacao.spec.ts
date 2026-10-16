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

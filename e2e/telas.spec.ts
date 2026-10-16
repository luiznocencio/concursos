import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Falha o teste se a página lançar erro no navegador.
function vigiarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  return erros;
}

async function semEstouroHorizontal(page: Page) {
  const { largura, visivel } = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    visivel: document.documentElement.clientWidth,
  }));
  expect(largura, "largura do conteúdo cabe na tela").toBeLessThanOrEqual(visivel);
}

test.describe("telas no celular (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("Início carrega sem erro e sem estouro horizontal", async ({ page, usuarioLogado }) => {
    const erros = vigiarErros(page);
    const resposta = await page.goto("/");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Estudar agora" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Onde focar" })).toBeVisible();
    await expect(page.getByText(/dias? até a prova/)).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
    expect(usuarioLogado.email).toContain("@e2e.example.com");
  });

  test("Painel carrega sem erro e sem estouro horizontal", async ({ page, usuarioLogado }) => {
    void usuarioLogado;
    const erros = vigiarErros(page);
    const resposta = await page.goto("/painel");
    expect(resposta?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Painel", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "10 tópicos prioritários" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Desempenho por disciplina" })).toBeVisible();
    await semEstouroHorizontal(page);
    expect(erros).toEqual([]);
  });
});

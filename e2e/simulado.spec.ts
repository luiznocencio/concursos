import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// Cada marcação é gravada por uma server action em segundo plano; espera a resposta antes de seguir.
async function marcar(page: Page, rotulo: "Certo" | "Errado") {
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/simulado/") && r.ok()),
    page.getByRole("button", { name: rotulo, exact: true }).click(),
  ]);
}

// O simulado completo do CFO tem 120 itens (P1 + P2), montados com os itens semeados para o E2E.
// Marca só dois e entrega: o resto conta como em branco.
test("simulado completo: marca dois itens, entrega e vê o resultado", async ({ page, usuarioLogado }) => {
  void usuarioLogado;
  await page.goto("/simulado");
  await expect(page.getByRole("heading", { name: "Simulado completo" })).toBeVisible();
  await page.getByRole("button", { name: "Começar simulado" }).click();

  await expect(page).toHaveURL(/\/simulado\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/item 1 de 120$/)).toBeVisible();

  await marcar(page, "Certo");
  await expect(page.getByRole("button", { name: "Item 1, marcado" })).toBeVisible();
  await page.getByRole("button", { name: "Próximo" }).click();
  await expect(page.getByText(/item 2 de 120$/)).toBeVisible();
  await marcar(page, "Errado");
  await expect(page.getByRole("button", { name: "Item 2, marcado" })).toBeVisible();

  await page.getByRole("button", { name: "Entregar simulado" }).click();
  await expect(page.getByText("Entregar agora? 118 itens estão em branco.")).toBeVisible();
  await page.getByRole("button", { name: "Entregar", exact: true }).click();

  await expect(page).toHaveURL(/\/simulado\/[0-9a-f-]{36}\/resultado$/);
  await expect(page.getByRole("heading", { name: /pontos/ })).toBeVisible();
  await expect(page.getByText(/Aprovado nos cortes|Eliminado/).first()).toBeVisible();
  await expect(page.getByText("P1 – Conhecimentos gerais", { exact: true })).toBeVisible();
  await expect(page.getByText("P2 – Conhecimentos específicos (CFO)", { exact: true })).toBeVisible();

  // Os dois itens marcados aparecem nas contagens por prova (os dois são da P1, que vem primeiro).
  await expect(page.getByText(/^\d certos? · \d errados? · 48 em branco$/)).toBeVisible();
  await expect(page.getByText(/^0 certos · 0 errados · 70 em branco$/)).toBeVisible();
});

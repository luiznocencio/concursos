import { abrirDisciplina, expect, test } from "./fixtures";

// Itens semeados por e2e/banco/preparar.sql: 3 por tópico, o 2º com gabarito Errado.
test("treino por tópico: responde, vê a correção de cada item e o resumo", async ({ page, usuarioLogado }) => {
  void usuarioLogado;
  await page.goto("/treinar");
  await expect(page.getByRole("heading", { name: "Treinar por tópico" })).toBeVisible();

  const disciplina = await abrirDisciplina(page, "Língua Portuguesa");
  await disciplina.getByRole("checkbox").first().check();
  await page.getByLabel("Quantidade", { exact: true }).selectOption("10");
  await page.getByRole("button", { name: "Começar treino" }).click();

  await expect(page).toHaveURL(/\/sessao\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Item 1 de 3")).toBeVisible();
  await expect(page.getByText("0 de 3 respondidos")).toBeVisible();

  const gabaritos: string[] = [];
  for (let n = 1; n <= 3; n++) {
    await expect(page.getByText(`Item ${n} de 3`)).toBeVisible();
    await page.getByRole("button", { name: "Certo", exact: true }).click();

    const resultado = page.getByText(/^Você (acertou|errou)\. Gabarito: (Certo|Errado)\.$/);
    await expect(resultado).toBeVisible();
    gabaritos.push((await resultado.textContent())!.includes("Gabarito: Certo") ? "C" : "E");
    await expect(page.getByText("Sua resposta: Certo")).toBeVisible();
    await expect(page.getByText(/^Justificativa de teste do item \d sobre /)).toBeVisible();
    await expect(page.getByText(`${n} de 3 respondidos`)).toBeVisible();

    await page.getByRole("button", { name: n < 3 ? "Próximo item" : "Ver resumo" }).click();
  }
  expect(gabaritos.sort()).toEqual(["C", "C", "E"]);

  // Resumo da sessão encerrada, com a lista de correção.
  await expect(page.getByRole("heading", { name: "2 de 3 certos" })).toBeVisible();
  await expect(page.getByText("1 errados e 0 em branco.", { exact: false })).toBeVisible();
  const lista = page.locator("ol").filter({ has: page.locator("details") });
  await expect(lista.locator("details")).toHaveCount(3);
  await lista.locator("summary").filter({ hasText: "Errado" }).click();
  await expect(lista.getByText("Você errou. Gabarito: Errado.")).toBeVisible();
});

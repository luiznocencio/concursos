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
});

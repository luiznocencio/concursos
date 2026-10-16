import { expect, test, type Admin } from "./fixtures";

const ASPECTOS = [
  { codigo: "1", descricao: "Apresentação e estrutura textual", pontos: 3 },
  { codigo: "2.1", descricao: "Causas", pontos: 13.5 },
  { codigo: "2.2", descricao: "Propostas", pontos: 13.5 },
];

async function criarTema(admin: Admin, nome: string): Promise<string> {
  const enunciado = `Tema E2E ${nome} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const { error } = await admin.rpc("discursiva_importar_temas", {
    p_lote: { concurso: "cbmal-2026", prova_origem: "Prova E2E", temas: [{ enunciado, padrao_resposta: { aspectos: ASPECTOS, expectativas: "" } }] },
  });
  expect(error).toBeNull();
  const { data } = await admin.from("temas_discursiva").select("id").eq("enunciado", enunciado).single();
  return data!.id;
}

test("simulado com a discursiva: escreve a redação e ela é entregue junto", async ({ page, admin, usuarioLogado }) => {
  await criarTema(admin, "simulado");
  await page.goto("/simulado");
  const opcao = page.getByLabel(/Incluir a prova discursiva \(4h30 no total\)/);
  await expect(opcao).toBeChecked();
  await page.getByRole("button", { name: "Começar simulado" }).click();
  await expect(page).toHaveURL(/\/simulado\/[0-9a-f-]{36}$/);
  const sessaoId = page.url().split("/").pop()!;

  await page.getByRole("button", { name: "Redação", exact: true }).click();
  await page.getByLabel("Seu texto").fill("Texto da redação escrita dentro do simulado.");
  await expect(page.getByText("1/30 linhas")).toBeVisible();
  await page.getByRole("button", { name: "Item 1", exact: true }).click();
  await expect(page.getByText(/item 1 de 120$/)).toBeVisible();

  await page.getByRole("button", { name: "Entregar simulado" }).click();
  await page.getByRole("button", { name: "Entregar", exact: true }).click();
  await expect(page).toHaveURL(/\/resultado$/);
  await expect(page.getByRole("heading", { name: "P3 – Prova discursiva" })).toBeVisible();
  await expect(page.getByText("Em correção")).toBeVisible();

  const { data: r } = await admin.from("redacoes").select("status, linhas, usuario_id").eq("simulado_id", sessaoId).single();
  expect(r).toEqual({ status: "na_fila", linhas: ["Texto da redação escrita dentro do simulado."], usuario_id: usuarioLogado.id });
  const { data: s } = await admin.from("simulados").select("config").eq("id", sessaoId).single();
  expect(s!.config).toMatchObject({ duracaoMin: 270, discursiva: true });
});

test("painel mostra a seção de redação com a nota e os erros mais frequentes", async ({ page, admin, usuarioLogado }) => {
  const tema = await criarTema(admin, "painel");
  const { data: red } = await admin
    .from("redacoes")
    .insert({ usuario_id: usuarioLogado.id, tema_id: tema, status: "corrigida", linhas: ["x"], npd: 17.5, corrigida_em: new Date().toISOString() })
    .select("id")
    .single();
  const erro = { redacao_id: red!.id, usuario_id: usuarioLogado.id, linha: 1, trecho: "x", tipo: "morfossintaxe", correcao: "y", explicacao: "z" };
  await admin.from("erros_redacao").insert([
    { ...erro, categoria: "crase", canonico: "portugues/crase" },
    { ...erro, categoria: "crase", canonico: "portugues/crase" },
    { ...erro, categoria: "concordancia", canonico: "portugues/concordancia-verbal-e-nominal" },
  ]);

  await page.goto("/painel");
  await expect(page.getByRole("heading", { name: "Redação", exact: true })).toBeVisible();
  await expect(page.getByText("Última nota")).toBeVisible();
  await expect(page.getByText("17,5", { exact: true })).toBeVisible();
  const lista = page.getByRole("heading", { name: "Erros mais frequentes (30 dias)" }).locator("..");
  await expect(lista.getByRole("listitem").first()).toContainText("crase");
  await expect(lista.getByRole("listitem").first()).toContainText("2 erros");
});

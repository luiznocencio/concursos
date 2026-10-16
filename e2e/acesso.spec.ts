import { EMAIL_LOGIN, MAILPIT_URL } from "./ambiente";
import { expect, test } from "./fixtures";

// Lê no Mailpit do Supabase local o último link de acesso enviado para o e-mail.
async function linkDoEmail(email: string): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const busca = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
        const { messages } = (await busca.json()) as { messages: { ID: string }[] };
        if (!messages?.length) return null;
        const msg = await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json();
        link = /https?:\/\/\S+\/auth\/v1\/verify\?[^\s"'<>)]+/.exec(String(msg.Text ?? msg.HTML))?.[0];
        return link ?? null;
      },
      { message: "link de acesso no Mailpit", timeout: 20_000 },
    )
    .not.toBeNull();
  return link!.replace(/&amp;/g, "&");
}

test.describe("acesso", () => {
  test("tela de entrada renderiza o formulário", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(page.getByRole("button", { name: "Receber link de acesso" })).toBeVisible();
  });

  test("rota protegida sem sessão leva ao login guardando o destino", async ({ page }) => {
    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar\?proximo=%2Fpainel$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("e-mail fora da lista de acesso é recusado", async ({ page }) => {
    await page.goto("/entrar");
    await page.getByLabel("E-mail").fill("intruso@e2e.example.com");
    await page.getByRole("button", { name: "Receber link de acesso" }).click();
    await expect(page.getByText("Este e-mail não tem acesso à plataforma.")).toBeVisible();
  });

  test("login completo pelo link mágico chega ao destino pedido e ao Início", async ({ page }) => {
    await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${EMAIL_LOGIN}"`)}`, { method: "DELETE" });

    await page.goto("/painel");
    await expect(page).toHaveURL(/\/entrar/);
    await page.getByLabel("E-mail").fill(EMAIL_LOGIN);
    await page.getByRole("button", { name: "Receber link de acesso" }).click();
    await expect(page.getByText("Enviamos um link de acesso para o seu e-mail.")).toBeVisible();

    // O link passa pelo Auth local, volta em /auth/callback com o código e cai no destino guardado.
    await page.goto(await linkDoEmail(EMAIL_LOGIN));
    await expect(page).toHaveURL(/\/painel$/);
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();

    await page.getByRole("link", { name: "Início" }).click();
    await expect(page.getByRole("heading", { name: "Estudar agora" })).toBeVisible();
    await expect(page.getByText(EMAIL_LOGIN)).toBeVisible();

    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });
});

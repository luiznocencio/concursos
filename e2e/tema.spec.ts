import { BASE_URL } from "./ambiente";
import { expect, test } from "./fixtures";

test.describe("seletor de tema", () => {
  test("escolher Escuro aplica data-tema no <html> e persiste após recarregar", async ({ page, usuarioLogado }) => {
    await page.goto("/");
    await expect(page.getByText(usuarioLogado.email)).toBeVisible();
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-tema", "sistema");

    const tema = page.getByRole("radiogroup", { name: "Tema" });
    await tema.getByRole("radio", { name: "Escuro" }).click();
    await expect(html).toHaveAttribute("data-tema", "escuro");

    await page.reload();
    await expect(html).toHaveAttribute("data-tema", "escuro");
    await expect(tema.getByRole("radio", { name: "Escuro" })).toHaveAttribute("aria-checked", "true");

    await tema.getByRole("radio", { name: "Claro" }).click();
    await expect(html).toHaveAttribute("data-tema", "claro");
  });

  test("no celular, o botão único alterna Claro → Escuro e o tema persiste", async ({ page, usuarioLogado }) => {
    void usuarioLogado;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies([{ name: "tema", value: "claro", url: BASE_URL }]);
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-tema", "claro");

    await page.getByRole("button", { name: "Tema: Claro. Mudar para Escuro" }).click();
    await expect(html).toHaveAttribute("data-tema", "escuro");
    await page.reload();
    await expect(html).toHaveAttribute("data-tema", "escuro");
    await expect(page.getByRole("button", { name: "Tema: Escuro. Mudar para Sistema" })).toBeVisible();
  });
});

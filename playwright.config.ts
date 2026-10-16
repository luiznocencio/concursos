import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, ENV_DO_APP, PORTA } from "./e2e/ambiente";

// E2E contra o Supabase local (npx supabase start). Veja docs/testes.md.
// O webServer faz build + start com as variáveis do E2E (as NEXT_PUBLIC_* entram no bundle no build).
// Com E2E_SEM_BUILD=1 só faz o start, reaproveitando o último build do E2E. Fora do CI, um servidor
// já de pé na porta 3100 é reaproveitado.
const CI = Boolean(process.env.CI);
const iniciar = `npx next start -p ${PORTA}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/preparar-banco.ts",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Maceio",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.E2E_SEM_BUILD ? iniciar : `npx next build && ${iniciar}`,
    url: `${BASE_URL}/entrar`,
    env: ENV_DO_APP,
    reuseExistingServer: !CI,
    timeout: 300_000,
    stdout: "pipe",
  },
});

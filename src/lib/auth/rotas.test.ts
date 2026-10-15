import { describe, expect, it } from "vitest";
import { destinoSeguro, emailPermitido, encaminharCodigo, rotaPublica } from "./rotas";

describe("rotaPublica", () => {
  it("libera login e callback", () => {
    expect(rotaPublica("/entrar")).toBe(true);
    expect(rotaPublica("/auth/callback")).toBe(true);
  });

  it("libera o worker de jobs, que se autentica com segredo próprio", () => {
    expect(rotaPublica("/api/jobs/worker")).toBe(true);
    expect(rotaPublica("/api/outra")).toBe(false);
  });

  it("protege o resto", () => {
    expect(rotaPublica("/")).toBe(false);
    expect(rotaPublica("/entrarx")).toBe(false);
    expect(rotaPublica("/simulado")).toBe(false);
  });
});

describe("destinoSeguro", () => {
  it("aceita caminhos internos", () => {
    expect(destinoSeguro("/simulado?x=1")).toBe("/simulado?x=1");
  });

  it("recusa destinos externos ou vazios", () => {
    for (const d of [null, undefined, "", "https://mal.com", "//mal.com", "/\\mal.com", "simulado"]) {
      expect(destinoSeguro(d)).toBe("/");
    }
  });
});

describe("emailPermitido", () => {
  it("compara sem diferenciar maiúsculas e ignora espaços", () => {
    expect(emailPermitido("Ana@X.com", " ana@x.com , bia@y.com")).toBe(true);
    expect(emailPermitido("bia@y.com", "ana@x.com,bia@y.com")).toBe(true);
  });

  it("nega quando a lista não existe ou não contém o e-mail", () => {
    expect(emailPermitido("ana@x.com", undefined)).toBe(false);
    expect(emailPermitido("ana@x.com", "")).toBe(false);
    expect(emailPermitido("ana@x.com", "bia@y.com")).toBe(false);
  });
});

describe("encaminharCodigo", () => {
  it("leva o código de login de qualquer página para o callback", () => {
    expect(encaminharCodigo(new URL("https://app.vercel.app/?code=abc"))?.toString()).toBe(
      "https://app.vercel.app/auth/callback?code=abc",
    );
    expect(encaminharCodigo(new URL("https://app.vercel.app/entrar?code=abc&x=1"))?.toString()).toBe(
      "https://app.vercel.app/auth/callback?code=abc",
    );
  });

  it("não faz nada sem código ou já no callback", () => {
    expect(encaminharCodigo(new URL("https://app.vercel.app/simulado"))).toBeNull();
    expect(encaminharCodigo(new URL("https://app.vercel.app/auth/callback?code=abc"))).toBeNull();
  });
});

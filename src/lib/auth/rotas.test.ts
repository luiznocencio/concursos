import { describe, expect, it } from "vitest";
import { destinoSeguro, emailPermitido, rotaPublica } from "./rotas";

describe("rotaPublica", () => {
  it("libera login e callback", () => {
    expect(rotaPublica("/entrar")).toBe(true);
    expect(rotaPublica("/auth/callback")).toBe(true);
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

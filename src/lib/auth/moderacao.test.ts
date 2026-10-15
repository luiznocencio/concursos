import { describe, expect, it } from "vitest";
import { ehModerador } from "./moderacao";

describe("ehModerador", () => {
  it("usa MODERADORES_EMAILS quando existe e a lista de acesso como reserva", () => {
    expect(ehModerador("a@x.com", { MODERADORES_EMAILS: "a@x.com", AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(true);
    expect(ehModerador("b@x.com", { MODERADORES_EMAILS: "a@x.com", AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(false);
    expect(ehModerador("B@x.com", { AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(true);
    expect(ehModerador(null, { AUTH_EMAILS_PERMITIDOS: "b@x.com" })).toBe(false);
  });
});

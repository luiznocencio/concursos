import { describe, expect, it } from "vitest";
import { bearerValido } from "./segredo";

describe("bearerValido", () => {
  it("aceita só o segredo exato", () => {
    expect(bearerValido("Bearer s3gredo", "s3gredo")).toBe(true);
    expect(bearerValido("Bearer s3gred0", "s3gredo")).toBe(false);
    expect(bearerValido("s3gredo", "s3gredo")).toBe(false);
  });

  it("recusa quando o segredo não está configurado ou o cabeçalho falta", () => {
    expect(bearerValido("Bearer ", "")).toBe(false);
    expect(bearerValido("Bearer x", undefined)).toBe(false);
    expect(bearerValido(null, "x")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { lerEnvSupabase } from "./env";

describe("lerEnvSupabase", () => {
  it("devolve url e chave válidas", () => {
    expect(
      lerEnvSupabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({ url: "https://abc.supabase.co", chave: "sb_publishable_x" });
  });

  it("lista as variáveis ausentes", () => {
    expect(() => lerEnvSupabase({ NEXT_PUBLIC_SUPABASE_URL: "nao-e-url" })).toThrow(
      "Variáveis do Supabase ausentes ou inválidas: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  });
});

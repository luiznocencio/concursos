import { describe, expect, it } from "vitest";
import { conteudoClaude } from "./claude";
import { entradaOpenAI } from "./openai";

const foto = { midia: "image/jpeg" as const, base64: "QUJD" };

describe("imagens no pedido", () => {
  it("sem imagens, o prompt vai como texto puro", () => {
    expect(conteudoClaude("oi")).toBe("oi");
    expect(entradaOpenAI("oi", [])).toBe("oi");
  });

  it("Claude recebe as imagens em base64 antes do texto", () => {
    expect(conteudoClaude("leia", [foto])).toEqual([
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } },
      { type: "text", text: "leia" },
    ]);
  });

  it("OpenAI recebe o texto e as imagens como data URL", () => {
    expect(entradaOpenAI("leia", [foto])).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "leia" },
          { type: "input_image", image_url: "data:image/jpeg;base64,QUJD", detail: "high" },
        ],
      },
    ]);
  });
});

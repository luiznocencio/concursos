import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { criarProvedorFalso } from "./falso";
import { ErroIa } from "./tipos";

const schema = z.object({ ok: z.boolean() });
const pedido = { finalidade: "teste", sistema: "s", prompt: "p", schema, nomeSchema: "teste" };

describe("provedor falso", () => {
  it("devolve as respostas em ordem, validadas pelo schema", async () => {
    const { provedor, pedidos } = criarProvedorFalso("anthropic", [{ ok: true }]);
    const r = await provedor.gerarJson(pedido);
    expect(r.dados).toEqual({ ok: true });
    expect(r.uso.provedor).toBe("anthropic");
    expect(pedidos).toHaveLength(1);
  });

  it("lança ErroIa de saída inválida quando a resposta não bate com o schema", async () => {
    const { provedor } = criarProvedorFalso("openai", [{ ok: "sim" }]);
    await expect(provedor.gerarJson(pedido)).rejects.toMatchObject({ motivo: "saida_invalida", provedor: "openai" });
  });

  it("repassa erros configurados", async () => {
    const { provedor } = criarProvedorFalso("openai", [new ErroIa("openai", "api", "fora do ar")]);
    await expect(provedor.gerarJson(pedido)).rejects.toThrow("fora do ar");
  });
});

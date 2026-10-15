import { describe, expect, it } from "vitest";
import { proximoEstadoRevisao, revisaoVencida } from "./espacada";

const agora = new Date("2026-11-01T12:00:00Z");
const dias = (n: number) => new Date(agora.getTime() + n * 86_400_000);

describe("proximoEstadoRevisao", () => {
  it("erro ou branco coloca o item na etapa 1 (1 dia)", () => {
    expect(proximoEstadoRevisao(null, "errado", agora)).toEqual({ etapa: 1, proximaEm: dias(1) });
    expect(proximoEstadoRevisao({ etapa: 3, proximaEm: agora }, "branco", agora)).toEqual({ etapa: 1, proximaEm: dias(1) });
  });

  it("acerto fora da revisão não faz nada", () => {
    expect(proximoEstadoRevisao(null, "certo", agora)).toBeNull();
    expect(proximoEstadoRevisao(null, "certo_duvida", agora)).toBeNull();
  });

  it("acerto sem dúvida avança: 1→2 (3 dias), 2→3 (7 dias), 3→4 (15 dias)", () => {
    expect(proximoEstadoRevisao({ etapa: 1, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 2, proximaEm: dias(3) });
    expect(proximoEstadoRevisao({ etapa: 2, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 3, proximaEm: dias(7) });
    expect(proximoEstadoRevisao({ etapa: 3, proximaEm: agora }, "certo", agora)).toEqual({ etapa: 4, proximaEm: dias(15) });
  });

  it("acerto na etapa 4 remove o item da revisão", () => {
    expect(proximoEstadoRevisao({ etapa: 4, proximaEm: agora }, "certo", agora)).toBeNull();
  });

  it("acerto com dúvida mantém a etapa e reagenda com o mesmo intervalo", () => {
    expect(proximoEstadoRevisao({ etapa: 2, proximaEm: agora }, "certo_duvida", agora)).toEqual({ etapa: 2, proximaEm: dias(3) });
  });
});

describe("revisaoVencida", () => {
  it("vence quando proximaEm <= agora", () => {
    expect(revisaoVencida({ etapa: 1, proximaEm: agora }, agora)).toBe(true);
    expect(revisaoVencida({ etapa: 1, proximaEm: dias(1) }, agora)).toBe(false);
  });
});

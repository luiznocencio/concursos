import { describe, expect, it } from "vitest";
import { alteracaoDeModeracao, inicioDoMes } from "./moderacao";

const AGORA = new Date("2026-10-15T12:00:00Z");
const item = {
  status: "revisao",
  formato: "certo_errado",
  gabarito: "C",
  justificativa: "do gerador",
  validacao: { concordancia: false, justificativa_validador: "do validador" },
};

describe("alteracaoDeModeracao", () => {
  it("aprova ou descarta guardando quem decidiu", () => {
    expect(alteracaoDeModeracao(item, "aprovar", "a@x.com", AGORA)).toMatchObject({
      status: "aprovado",
      validacao: { concordancia: false, moderacao: { decisao: "aprovar", por: "a@x.com", status_anterior: "revisao" } },
    });
    expect(alteracaoDeModeracao(item, "descartar", "a@x.com", AGORA)).toMatchObject({ status: "descartado" });
  });

  it("inverte o gabarito e adota a justificativa do validador", () => {
    expect(alteracaoDeModeracao(item, "inverter", "a@x.com", AGORA)).toMatchObject({
      status: "aprovado",
      gabarito: "E",
      justificativa: "do validador",
      validacao: { moderacao: { gabarito_anterior: "C" } },
    });
  });

  it("ignora itens que já saíram da fila", () => {
    expect(alteracaoDeModeracao({ ...item, status: "aprovado" }, "descartar", "a@x.com", AGORA)).toBeNull();
  });
});

describe("inicioDoMes", () => {
  it("volta ao primeiro dia do mês em UTC", () => {
    expect(inicioDoMes(AGORA).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

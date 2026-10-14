import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("API pública de core", () => {
  it("exporta as funções usadas pelos próximos planos", () => {
    for (const nome of [
      "parseEdital", "EditalInvalidoError", "topicosFolha", "topicosAlvoDoCargo", "demandasDaProva",
      "provasObjetivasDoCargo", "notaProva", "valorCorte", "calcularResultado", "analisarDuvidas",
      "resultadoDaResposta", "proximoEstadoRevisao", "revisaoVencida", "calcularPrioridades", "CONFIG_FOCO",
      "montarEstudarAgora", "montarTreinoTopico", "montarSimuladoProva", "topicosQuePrecisamGeracao",
      "agruparPorTextoBase",
    ]) {
      expect(core, nome).toHaveProperty(nome);
    }
  });
});

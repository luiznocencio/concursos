import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("API pública de core", () => {
  it("exporta as funções usadas pelos próximos planos", () => {
    for (const nome of [
      "parseEdital", "EditalInvalidoError", "topicosFolha", "topicosAlvoDoCargo", "demandasDaProva",
      "provasObjetivasDoCargo", "notaProva", "valorCorte", "calcularResultado", "analisarDuvidas",
      "resultadoDaResposta", "proximoEstadoRevisao", "revisaoVencida", "calcularPrioridades", "CONFIG_FOCO",
      "montarEstudarAgora", "montarTreinoTopico", "montarSimuladoProva", "topicosQuePrecisamGeracao",
      "agruparPorTextoBase", "notaConteudo", "calcularNPD", "aprovadoDiscursiva", "distribuirEmLinhas", "contarTL",
      "filtrarErrosValidos", "CANONICO_POR_CATEGORIA", "escolherPrioridades", "configDaProva", "CATEGORIAS_ERRO",
    ]) {
      expect(core, nome).toHaveProperty(nome);
    }
  });
});

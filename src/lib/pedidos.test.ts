import { describe, expect, it } from "vitest";
import { estadoDoTema, tempoDeEspera, topicosEmGeracao, type PedidoIa } from "./pedidos";

const pedido = (tipo: PedidoIa["tipo"], status: PedidoIa["status"], criadoEm: string, canonico: string | null = null): PedidoIa => ({
  tipo,
  status,
  canonico,
  criadoEm,
  atualizadoEm: criadoEm,
});

describe("topicosEmGeracao", () => {
  it("conta tópicos distintos com pedido de itens em aberto", () => {
    expect(
      topicosEmGeracao([
        pedido("gerar_itens", "pendente", "2026-10-16T10:00:00Z", "a"),
        pedido("gerar_itens", "processando", "2026-10-16T10:00:00Z", "a"),
        pedido("gerar_itens", "pendente", "2026-10-16T10:00:00Z", "b"),
        pedido("gerar_itens", "concluido", "2026-10-16T10:00:00Z", "c"),
        pedido("gerar_tema", "pendente", "2026-10-16T10:00:00Z"),
      ]),
    ).toBe(2);
  });
});

describe("estadoDoTema", () => {
  const pedidoEm = "2026-10-16T10:00:00Z";

  it("sem pedido de tema, nada a avisar", () => {
    expect(estadoDoTema([], [])).toBeNull();
  });

  it("pedido em aberto: gerando desde a criação", () => {
    expect(estadoDoTema([pedido("gerar_tema", "processando", pedidoEm)], [])).toEqual({ tipo: "gerando", desde: pedidoEm });
  });

  it("concluído com tema gerado depois do pedido: nada a avisar", () => {
    expect(estadoDoTema([pedido("gerar_tema", "concluido", pedidoEm)], [{ origem: "gerado", criadoEm: "2026-10-16T10:01:00Z" }])).toBeNull();
  });

  it("concluído sem tema novo: a revisão reprovou", () => {
    const temas = [{ origem: "gerado", criadoEm: "2026-10-15T10:00:00Z" }, { origem: "real", criadoEm: "2026-10-16T11:00:00Z" }];
    expect(estadoDoTema([pedido("gerar_tema", "concluido", pedidoEm)], temas)).toEqual({ tipo: "reprovado" });
  });

  it("vale o pedido mais recente; falha é avisada", () => {
    const pedidos = [pedido("gerar_tema", "concluido", "2026-10-16T09:00:00Z"), pedido("gerar_tema", "falhou", pedidoEm)];
    expect(estadoDoTema(pedidos, [])).toEqual({ tipo: "falhou" });
  });
});

describe("tempoDeEspera", () => {
  const agora = new Date("2026-10-16T10:05:00Z");

  it("segundos até 1 minuto, depois minutos", () => {
    expect(tempoDeEspera("2026-10-16T10:04:20Z", agora)).toEqual({ texto: "há 40 s", demorando: false });
    expect(tempoDeEspera("2026-10-16T10:03:00Z", agora)).toEqual({ texto: "há 2 min", demorando: false });
  });

  it("passa a demorando depois do limite", () => {
    expect(tempoDeEspera("2026-10-16T10:01:00Z", agora).demorando).toBe(true);
    expect(tempoDeEspera("2026-10-16T10:04:00Z", agora, 30).demorando).toBe(true);
  });
});

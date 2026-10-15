import type { z } from "zod/v4";

export type Provedor = "anthropic" | "openai";

export interface UsoIa {
  provedor: Provedor;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
}

export interface PedidoJson<S extends z.ZodType> {
  finalidade: string;
  sistema: string;
  prompt: string;
  schema: S;
  nomeSchema: string;
}

export interface RespostaJson<T> {
  dados: T;
  uso: UsoIa;
}

export interface ProvedorIa {
  readonly nome: Provedor;
  gerarJson<S extends z.ZodType>(pedido: PedidoJson<S>): Promise<RespostaJson<z.infer<S>>>;
}

export type MotivoErroIa = "api" | "recusa" | "saida_invalida";

export class ErroIa extends Error {
  constructor(
    public readonly provedor: Provedor,
    public readonly motivo: MotivoErroIa,
    mensagem: string,
    public readonly uso?: UsoIa,
  ) {
    super(mensagem);
    this.name = "ErroIa";
  }
}

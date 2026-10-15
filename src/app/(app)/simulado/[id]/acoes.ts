"use server";

import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { entregarSimulado, ErroEstudo, marcarNoSimulado } from "@/estudo/servico";
import type { Marcacao } from "@/estudo/tipos";
import { contextoDoUsuario } from "../../contexto";
import type { Retorno } from "../../sessao/[id]/acoes";

const MARCACOES: Marcacao[] = ["C", "E", "branco"];

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroEstudo) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function marcar(p: { sessaoId: string; itemId: string; resposta: Marcacao; duvida: boolean }): Promise<Retorno<null>> {
  if (!MARCACOES.includes(p.resposta)) return { ok: false, erro: "Resposta inválida." };
  const { db } = await contextoDoUsuario();
  try {
    await marcarNoSimulado(criarRepositorioEstudo(db), { ...p, duvida: Boolean(p.duvida), agora: new Date() });
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

export async function entregar(sessaoId: string): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await entregarSimulado(criarRepositorioEstudo(db), sessaoId, new Date());
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

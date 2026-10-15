"use server";

import { redirect } from "next/navigation";
import { criarRepositorioEstudo, marcarSuspeito } from "@/db/repositorios/estudo";
import { encerrarTreino, ErroEstudo, responderItem, type Correcao } from "@/estudo/servico";
import type { Marcacao } from "@/estudo/tipos";
import { contextoDoUsuario } from "../../contexto";

export type Retorno<T> = { ok: true; dados: T } | { ok: false; erro: string };

const MARCACOES: Marcacao[] = ["C", "E", "branco"];

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroEstudo) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function responder(p: {
  sessaoId: string;
  itemId: string;
  resposta: Marcacao;
  duvida: boolean;
  tempoMs: number | null;
}): Promise<Retorno<Correcao>> {
  if (!MARCACOES.includes(p.resposta)) return { ok: false, erro: "Resposta inválida." };
  const { db } = await contextoDoUsuario();
  try {
    const tempoMs = p.tempoMs === null ? null : Math.max(0, Math.min(Math.round(p.tempoMs), 3_600_000));
    const dados = await responderItem(criarRepositorioEstudo(db), { ...p, duvida: Boolean(p.duvida), tempoMs, agora: new Date() });
    return { ok: true, dados };
  } catch (e) {
    return falha(e);
  }
}

export async function encerrar(sessaoId: string) {
  const { db } = await contextoDoUsuario();
  try {
    await encerrarTreino(criarRepositorioEstudo(db), sessaoId, new Date());
  } catch (e) {
    if (!(e instanceof ErroEstudo)) throw e;
  }
  redirect(`/sessao/${sessaoId}`);
}

export async function marcarComoSuspeito(itemId: string, motivo: string): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await marcarSuspeito(db, itemId, motivo.trim().slice(0, 500));
    return { ok: true, dados: null };
  } catch (e) {
    console.error(e);
    return { ok: false, erro: "Não foi possível marcar o item." };
  }
}

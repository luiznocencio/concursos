"use server";

import { contarTL, distribuirEmLinhas } from "@/core";
import { criarRepositorioEstudo, type Cliente } from "@/db/repositorios/estudo";
import { entregarRedacao, ErroRedacao, redacaoDoSimulado, salvarTexto } from "@/db/repositorios/redacao";
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

// Grava o texto final da redação do simulado e a entrega para correção (se houver texto).
// Falhas aqui não impedem a entrega das objetivas: a redação continua como rascunho, e o resultado avisa.
async function entregarRedacaoDoSimulado(db: Cliente, sessaoId: string, texto: string | null) {
  try {
    const r = await redacaoDoSimulado(db, sessaoId);
    if (!r || r.status !== "rascunho") return;
    const final = (texto ?? r.texto).slice(0, 20_000);
    const folha = distribuirEmLinhas(final, r.config.caracteresPorLinha, r.config.linhasMax);
    await salvarTexto(db, r.id, { texto: final, ...folha });
    if (contarTL(folha.linhas) > 0) await entregarRedacao(db, r.id);
  } catch (e) {
    if (!(e instanceof ErroRedacao)) console.error(e);
  }
}

export async function entregar(sessaoId: string, textoRedacao: string | null = null): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await entregarSimulado(criarRepositorioEstudo(db), sessaoId, new Date());
  } catch (e) {
    return falha(e);
  }
  await entregarRedacaoDoSimulado(db, sessaoId, textoRedacao);
  return { ok: true, dados: null };
}

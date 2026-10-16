"use server";

import { redirect } from "next/navigation";
import { distribuirEmLinhas } from "@/core";
import {
  carregarRedacao,
  criarRedacao,
  entregarRedacao,
  enviarFotos,
  ErroRedacao,
  pedirTema,
  salvarTexto,
} from "@/db/repositorios/redacao";
import { mensagemDoBanco } from "@/lib/redacao";
import type { Retorno } from "../sessao/[id]/acoes";
import { contextoDoUsuario, exigirCargo } from "../contexto";

const MAX_TEXTO = 20_000;

function falha(e: unknown): { ok: false; erro: string } {
  if (e instanceof ErroRedacao) return { ok: false, erro: mensagemDoBanco(e.message) };
  console.error(e);
  return { ok: false, erro: "Não foi possível salvar. Verifique a conexão e tente de novo." };
}

export async function novaRedacao(formData: FormData) {
  const { db, user } = await contextoDoUsuario();
  const temaId = String(formData.get("tema") ?? "");
  if (!temaId) redirect("/redacao");
  const id = await criarRedacao(db, user.id, temaId);
  redirect(`/redacao/${id}`);
}

export async function pedirNovoTema() {
  const { db, cargo } = await exigirCargo();
  const enfileirou = await pedirTema(db, cargo.concursoSlug);
  redirect(`/redacao?aviso=${enfileirou ? "tema-pedido" : "tema-ja-pedido"}`);
}

// Grava o texto e as linhas da folha calculadas no servidor (o mesmo cálculo que a tela mostra).
export async function salvarRascunho(
  id: string,
  texto: string,
): Promise<Retorno<{ linhas: string[]; excedente: string[] }>> {
  const { db } = await contextoDoUsuario();
  try {
    const r = await carregarRedacao(db, id);
    if (!r) return { ok: false, erro: "Redação não encontrada." };
    if (r.status !== "rascunho") return { ok: false, erro: "Esta redação já foi entregue. Atualize a página." };
    const limpo = texto.slice(0, MAX_TEXTO);
    const folha = distribuirEmLinhas(limpo, r.config.caracteresPorLinha, r.config.linhasMax);
    await salvarTexto(db, id, { texto: limpo, ...folha });
    return { ok: true, dados: folha };
  } catch (e) {
    return falha(e);
  }
}

export async function entregar(id: string, texto: string): Promise<Retorno<null>> {
  const salvo = await salvarRascunho(id, texto);
  if (!salvo.ok) return salvo;
  const { db } = await contextoDoUsuario();
  try {
    await entregarRedacao(db, id);
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// As fotos já foram enviadas pelo navegador ao Storage, na pasta do usuário.
export async function registrarFotos(id: string, caminhos: string[]): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    await enviarFotos(db, id, caminhos.slice(0, 2));
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// Confirma a transcrição conferida pelo usuário e entrega para correção.
export async function confirmarTranscricao(id: string, linhas: string[]): Promise<Retorno<null>> {
  const { db } = await contextoDoUsuario();
  try {
    const r = await carregarRedacao(db, id);
    if (!r) return { ok: false, erro: "Redação não encontrada." };
    if (r.status !== "aguardando_confirmacao") return { ok: false, erro: "Esta redação já foi entregue. Atualize a página." };
    const limpas = linhas.slice(0, r.config.linhasMax).map((l) => String(l).replace(/\s+/g, " ").trim().slice(0, 200));
    while (limpas.length > 0 && limpas[limpas.length - 1] === "") limpas.pop();
    await salvarTexto(db, id, { linhas: limpas, excedente: r.excedente });
    await entregarRedacao(db, id);
    return { ok: true, dados: null };
  } catch (e) {
    return falha(e);
  }
}

// "Tentar de novo" de uma correção que falhou: a função do banco aceita reentregar a partir de "falhou".
export async function tentarDeNovo(id: string) {
  const { db } = await contextoDoUsuario();
  try {
    await entregarRedacao(db, id);
  } catch (e) {
    if (!(e instanceof ErroRedacao)) throw e;
    redirect(`/redacao/${id}?erro=${encodeURIComponent(mensagemDoBanco(e.message))}`);
  }
  redirect(`/redacao/${id}`);
}

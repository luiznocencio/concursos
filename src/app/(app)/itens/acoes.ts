"use server";

import { revalidatePath } from "next/cache";
import { moderarItem, type Decisao } from "@/db/repositorios/moderacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { contextoDoUsuario } from "../contexto";

const DECISOES: Decisao[] = ["aprovar", "descartar", "inverter"];

export async function decidir(formData: FormData) {
  const { user, moderador } = await contextoDoUsuario();
  if (!moderador) throw new Error("Apenas moderadores podem decidir itens.");
  const itemId = String(formData.get("item") ?? "");
  const decisao = String(formData.get("decisao") ?? "") as Decisao;
  if (!itemId || !DECISOES.includes(decisao)) throw new Error("Decisão inválida.");
  await moderarItem(criarClienteServico(), itemId, decisao, user.email ?? user.id);
  revalidatePath("/itens");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { criarRedacao, listarTemas } from "@/db/repositorios/redacao";
import {
  iniciarEstudarAgora,
  iniciarRevisao,
  iniciarSimulado,
  iniciarTreinoTopico,
  pedirGeracaoDosFaltantes,
  type InicioSessao,
} from "@/estudo/servico";
import { escolherTemaDoSimulado } from "@/lib/redacao";
import { COOKIE_CARGO, contextoDoUsuario, exigirCargo } from "./contexto";

const QUANTIDADES = [10, 20, 30];

function irParaSessao(r: InicioSessao, voltar: string): never {
  if (r.tipo === "criada") redirect(`/sessao/${r.sessaoId}`);
  redirect(`${voltar}?aviso=sem-itens&pedidos=${r.pedidosGeracao}`);
}

export async function escolherCargo(formData: FormData) {
  const { cargos } = await contextoDoUsuario();
  const id = String(formData.get("cargo") ?? "");
  if (cargos.some((c) => c.id === id)) {
    (await cookies()).set(COOKIE_CARGO, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  redirect("/");
}

export async function estudarAgora() {
  const { db, cargo } = await exigirCargo();
  irParaSessao(await iniciarEstudarAgora(criarRepositorioEstudo(db), cargo.id, new Date()), "/");
}

export async function treinarTopicos(formData: FormData) {
  const { db, cargo } = await exigirCargo();
  const canonicos = [...new Set(formData.getAll("canonico").map(String).filter(Boolean))];
  if (canonicos.length === 0) redirect("/treinar?aviso=escolha");
  const pedido = Number(formData.get("total"));
  const total = QUANTIDADES.includes(pedido) ? pedido : 10;
  irParaSessao(await iniciarTreinoTopico(criarRepositorioEstudo(db), cargo.id, canonicos, total), "/treinar");
}

export async function revisarErros() {
  const { db, cargo } = await exigirCargo();
  const r = await iniciarRevisao(criarRepositorioEstudo(db), cargo.id, new Date());
  if (r.tipo === "sem_itens") redirect("/?aviso=sem-revisao");
  redirect(`/sessao/${r.sessaoId}`);
}

// Com a discursiva, o simulado leva uma redação (tema real ainda não feito, se houver) e dura o tempo inteiro do cargo.
export async function comecarSimulado(formData: FormData) {
  const { db, cargo, user } = await exigirCargo();
  const comDiscursiva = formData.get("discursiva") === "sim";
  const tema = comDiscursiva ? escolherTemaDoSimulado(await listarTemas(db, cargo.concursoSlug)) : null;
  if (comDiscursiva && !tema) redirect("/simulado?aviso=sem-tema");
  const r = await iniciarSimulado(criarRepositorioEstudo(db), cargo.id, comDiscursiva);
  if (r.tipo === "faltam_itens") redirect("/simulado?aviso=faltam");
  if (tema) await criarRedacao(db, user.id, tema.id, r.sessaoId);
  redirect(`/simulado/${r.sessaoId}`);
}

export async function gerarFaltantes(formData: FormData) {
  const { db, cargo } = await exigirCargo();
  const canonicos = formData.getAll("canonico").map(String).filter(Boolean);
  const novos = await pedirGeracaoDosFaltantes(criarRepositorioEstudo(db), cargo.id, canonicos);
  redirect(`/simulado?aviso=geracao&pedidos=${novos}`);
}

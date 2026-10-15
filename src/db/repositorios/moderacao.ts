import type { ClienteServico } from "../supabase/servico";

function falhou(operacao: string, erro: { message: string } | null): never {
  throw new Error(`${operacao}: ${erro?.message ?? "erro desconhecido"}`);
}

export type Decisao = "aprovar" | "descartar" | "inverter";

interface ItemModeravel {
  status: string;
  formato: string;
  gabarito: string;
  justificativa: string;
  validacao: unknown;
}

// Alteração a gravar no item. "inverter" aprova trocando Certo/Errado e, se houver, adota a
// justificativa do validador. Devolve null quando o item não está na fila (já decidido).
export function alteracaoDeModeracao(item: ItemModeravel, decisao: Decisao, por: string, agora: Date) {
  if (item.status !== "revisao" && item.status !== "suspeito") return null;
  if (decisao === "inverter" && item.formato !== "certo_errado") throw new Error("Só itens Certo/Errado podem ser invertidos");
  const validacao = (item.validacao ?? {}) as Record<string, unknown>;
  const em = agora.toISOString();
  const moderacao = { decisao, por, em, status_anterior: item.status, gabarito_anterior: item.gabarito };
  const base = { validacao: { ...validacao, moderacao }, atualizado_em: em };
  if (decisao === "descartar") return { ...base, status: "descartado" };
  if (decisao === "aprovar") return { ...base, status: "aprovado" };
  const justificativaValidador = validacao.justificativa_validador;
  return {
    ...base,
    status: "aprovado",
    gabarito: item.gabarito === "C" ? "E" : "C",
    justificativa: typeof justificativaValidador === "string" && justificativaValidador ? justificativaValidador : item.justificativa,
  };
}

export async function moderarItem(db: ClienteServico, itemId: string, decisao: Decisao, por: string): Promise<void> {
  const { data: item, error: e1 } = await db
    .from("itens")
    .select("status, formato, gabarito, justificativa, validacao")
    .eq("id", itemId)
    .single();
  if (e1) falhou("item", e1);
  const alteracao = alteracaoDeModeracao(item, decisao, por, new Date());
  if (!alteracao) return;
  const { error } = await db.from("itens").update(alteracao).eq("id", itemId).eq("status", item.status);
  if (error) falhou("moderar item", error);
}

export interface CustoFinalidade {
  finalidade: string;
  chamadas: number;
  custoUsd: number;
}

export function inicioDoMes(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1));
}

export async function custoIaDoMes(db: ClienteServico, agora: Date): Promise<CustoFinalidade[]> {
  const { data, error } = await db
    .from("ai_usage")
    .select("finalidade, custo_usd")
    .gte("criado_em", inicioDoMes(agora).toISOString())
    .limit(10_000);
  if (error) falhou("custo de IA", error);
  const porFinalidade = new Map<string, CustoFinalidade>();
  for (const u of data) {
    const acc = porFinalidade.get(u.finalidade) ?? { finalidade: u.finalidade, chamadas: 0, custoUsd: 0 };
    acc.chamadas++;
    acc.custoUsd += Number(u.custo_usd);
    porFinalidade.set(u.finalidade, acc);
  }
  return [...porFinalidade.values()].sort((a, b) => b.custoUsd - a.custoUsd);
}

export async function situacaoDaFila(db: ClienteServico) {
  const [abertos, falhas] = await Promise.all([
    db.from("jobs").select("id", { count: "exact", head: true }).in("status", ["pendente", "processando"]),
    db.from("jobs").select("id, payload, erro, atualizado_em").eq("status", "falhou").order("atualizado_em", { ascending: false }).limit(5),
  ]);
  if (abertos.error) falhou("jobs abertos", abertos.error);
  if (falhas.error) falhou("jobs com falha", falhas.error);
  return {
    abertos: abertos.count ?? 0,
    falhas: falhas.data.map((j) => ({
      id: j.id,
      canonico: String((j.payload as Record<string, unknown>).canonico ?? ""),
      erro: j.erro ?? "",
      em: j.atualizado_em,
    })),
  };
}

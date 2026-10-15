import { notFound, redirect } from "next/navigation";
import { criarRepositorioEstudo, itensDaSessao } from "@/db/repositorios/estudo";
import { prazoDoSimulado } from "@/estudo/servico";
import { PlayerSimulado, type ProvaNoSimulado } from "@/components/simulado/player-simulado";
import { exigirCargo } from "../../contexto";

export default async function PaginaSimulado({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const sessao = await repo.sessao(id);
  if (!sessao) notFound();
  if (sessao.config.tipo !== "completo") redirect(`/sessao/${id}`);
  if (sessao.finalizadaEm) redirect(`/simulado/${id}/resultado`);

  const [estrutura, itens] = await Promise.all([repo.estrutura(sessao.cargoId), itensDaSessao(db, id, () => false)]);
  const provas = sessao.config.provas.reduce<ProvaNoSimulado[]>((acc, p) => {
    const inicio = acc.at(-1)?.fim ?? 0;
    const nome = estrutura.provas.find((x) => x.slug === p.slug)?.nome ?? p.slug;
    return [...acc, { slug: p.slug, nome, inicio, fim: inicio + p.itens.length }];
  }, []);

  return <PlayerSimulado sessaoId={id} itens={itens} provas={provas} prazo={prazoDoSimulado(sessao)!.toISOString()} />;
}

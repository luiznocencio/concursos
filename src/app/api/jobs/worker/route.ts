import { criarRepositorioDiscursiva, limparFotosVencidas } from "@/db/repositorios/discursiva";
import { carregarContexto, criarFilaJobs, criarRepositorioPipeline } from "@/db/repositorios/pipeline";
import { criarClienteServico } from "@/db/supabase/servico";
import { bearerValido } from "@/lib/auth/segredo";
import { criarProvedores } from "@/pipeline/config";
import { processadoresDiscursiva } from "@/pipeline/discursiva/jobs";
import { executarProximoJob } from "@/pipeline/executar-job";
import { gerarLote } from "@/pipeline/gerar-lote";

// Uma geração (gerar + validar até 5 itens) ou uma correção de redação pode levar alguns minutos.
export const maxDuration = 300;

export async function POST(request: Request) {
  if (!bearerValido(request.headers.get("authorization"), process.env.WORKER_SECRET)) {
    return Response.json({ erro: "não autorizado" }, { status: 401 });
  }
  const db = criarClienteServico();
  const provedores = criarProvedores();
  const resultado = await executarProximoJob({
    fila: criarFilaJobs(db),
    carregarContexto: (concurso, canonico) => carregarContexto(db, concurso, canonico),
    gerar: (entrada, jobId) => gerarLote({ provedores, repo: criarRepositorioPipeline(db), jobId }, entrada),
    processadores: processadoresDiscursiva({ provedores, repo: criarRepositorioDiscursiva(db) }),
  });
  // Com a fila vazia, aproveita a chamada para apagar fotos de redação com prazo vencido.
  if (resultado.status === "vazio") await limparFotosVencidas(db);
  return Response.json(resultado);
}

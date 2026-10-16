import { chamarComReserva, ErroPipeline } from "../gerar-lote";
import { promptTranscricao, SISTEMA_TRANSCRITOR } from "./prompts";
import { transcricaoSchema, type Transcricao } from "./schemas";
import type { DepsDiscursiva, TranscricaoParaGravar } from "./tipos";

// Acima desta fração de linhas ilegíveis, pedimos outra foto em vez de corrigir uma transcrição ruim.
export const LIMITE_ILEGIVEIS = 0.2;

export function avaliarTranscricao(t: Transcricao, linhasMax: number): TranscricaoParaGravar {
  const linhas = t.linhas.map((l) => ({ texto: l.texto.trim(), ilegivel: l.ilegivel }));
  while (linhas.length > 0 && linhas[linhas.length - 1].texto === "") linhas.pop();
  const escritas = linhas.filter((l) => l.texto !== "");
  if (escritas.length === 0) {
    return { ok: false, aviso: "Não encontramos texto na foto. Envie uma foto da folha de texto definitivo." };
  }
  const ilegiveis = escritas.filter((l) => l.ilegivel).length;
  if (ilegiveis / escritas.length > LIMITE_ILEGIVEIS) {
    return {
      ok: false,
      aviso: `A foto ficou difícil de ler (${ilegiveis} de ${escritas.length} linhas). Envie outra, com boa luz e a folha inteira.`,
    };
  }
  const textos = linhas.map((l) => l.texto);
  return { ok: true, linhas: textos.slice(0, linhasMax), excedente: textos.slice(linhasMax) };
}

export type ResumoTranscricao = { status: "transcrita"; ok: boolean } | { status: "ignorada"; motivo: string };

// Lê as fotos da folha (Claude, com o GPT de reserva) e deixa a transcrição para o usuário conferir.
export async function transcreverRedacao(deps: DepsDiscursiva, redacaoId: string): Promise<ResumoTranscricao> {
  const r = await deps.repo.carregarRedacao(redacaoId);
  if (!r) throw new ErroPipeline(`Redação ${redacaoId} não encontrada`, true);
  if (r.status !== "transcrevendo") return { status: "ignorada", motivo: `estado ${r.status}` };
  if (r.fotos.length === 0) throw new ErroPipeline(`Redação ${redacaoId} sem fotos`, true);

  const imagens = await deps.repo.baixarFotos(r.fotos);
  const resposta = await chamarComReserva(deps, deps.provedores, "discursiva_transcricao", { total: 0 }, (p) =>
    p.gerarJson({
      finalidade: "discursiva_transcricao",
      sistema: SISTEMA_TRANSCRITOR,
      prompt: promptTranscricao({ linhasMax: r.config.linhasMax }),
      schema: transcricaoSchema,
      nomeSchema: "transcricao",
      imagens,
    }),
  );
  await deps.repo.gravarCorrecao(r.id, "transcricao", resposta.uso, resposta.dados);
  const avaliacao = avaliarTranscricao(resposta.dados, r.config.linhasMax);
  await deps.repo.gravarTranscricao(r, avaliacao);
  return { status: "transcrita", ok: avaliacao.ok };
}

// Gera um lote agora, sem passar pela fila, e mostra o resultado e o custo. Faz chamadas reais às IAs.
// Uso: npm run ia:lote -- <slug-do-concurso> <topico-canonico> [quantidade]
import { carregarContexto, criarRepositorioPipeline } from "../src/db/repositorios/pipeline";
import { criarClienteServico } from "../src/db/supabase/servico";
import { criarProvedores } from "../src/pipeline/config";
import { gerarLote } from "../src/pipeline/gerar-lote";

async function main() {
  const [concurso, canonico, quantidade = "3"] = process.argv.slice(2);
  if (!concurso || !canonico) throw new Error("uso: npm run ia:lote -- <slug-do-concurso> <topico-canonico> [quantidade]");
  const db = criarClienteServico();
  const contexto = await carregarContexto(db, concurso, canonico);
  const resumo = await gerarLote(
    { provedores: criarProvedores(), repo: criarRepositorioPipeline(db), jobId: null },
    { ...contexto, quantidade: Number(quantidade), rodada: Math.floor(Date.now() / 1000) },
  );
  console.log(JSON.stringify(resumo, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

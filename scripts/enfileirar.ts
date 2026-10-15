// Enfileira a geração de itens para um tópico; o worker processa a fila.
// Uso: npm run ia:enfileirar -- <slug-do-concurso> <topico-canonico> [quantidade]
import { enfileirarGeracao } from "../src/db/repositorios/pipeline";
import { criarClienteServico } from "../src/db/supabase/servico";

async function main() {
  const [concurso, canonico, quantidade = "5"] = process.argv.slice(2);
  if (!concurso || !canonico) throw new Error("uso: npm run ia:enfileirar -- <slug-do-concurso> <topico-canonico> [quantidade]");
  const id = await enfileirarGeracao(criarClienteServico(), concurso, canonico, Number(quantidade));
  console.log(`job ${id}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

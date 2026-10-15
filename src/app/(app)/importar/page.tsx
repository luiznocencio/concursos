import { notFound } from "next/navigation";
import { AssistenteImportacao } from "@/components/importar/assistente";
import { textoApoio, titulo } from "@/components/ui";
import { dadosDaImportacao } from "@/db/repositorios/importacao";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import { contextoDoUsuario, exigirCargo } from "../contexto";

// A sugestão de tópicos chama a IA em paralelo, um lote a cada 25 itens; vale para as Server Actions da página.
export const maxDuration = 300;

export default async function Importar() {
  const { moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const { db, cargo } = await exigirCargo();
  const { concurso, opcoes } = await dadosDaImportacao(db, cargo.id);

  return (
    <>
      <h1 className={titulo.pagina}>Importar prova</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens reais de provas anteriores da banca, com o gabarito oficial. Entram aprovados, ligados aos tópicos do edital, e servem
        de referência de estilo para os itens gerados.
      </p>
      <AssistenteImportacao concurso={concurso.nome} opcoes={opcoes} reaisNasSessoes={itensReaisVisiveis()} />
    </>
  );
}

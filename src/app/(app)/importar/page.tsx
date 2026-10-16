import { notFound } from "next/navigation";
import { AssistenteImportacao } from "@/components/importar/assistente";
import { ImportarTemaReal } from "@/components/importar/tema-real";
import { cartao, textoApoio, titulo } from "@/components/ui";
import { dadosDaImportacao } from "@/db/repositorios/importacao";
import { configDaDiscursiva } from "@/db/repositorios/redacao";
import { itensReaisVisiveis } from "@/lib/itens-reais";
import { contextoDoUsuario, exigirCargo } from "../contexto";

// A sugestão de tópicos chama a IA em paralelo, um lote a cada 25 itens; vale para as Server Actions da página.
export const maxDuration = 300;

export default async function Importar() {
  const { moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const { db, cargo } = await exigirCargo();
  const [{ concurso, opcoes }, discursiva] = await Promise.all([
    dadosDaImportacao(db, cargo.id),
    configDaDiscursiva(db, cargo.concursoSlug),
  ]);

  return (
    <>
      <h1 className={titulo.pagina}>Importar prova</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens reais de provas anteriores da banca, com o gabarito oficial. Entram aprovados, ligados aos tópicos do edital, e servem
        de referência de estilo para os itens gerados.
      </p>
      <AssistenteImportacao concurso={concurso.nome} opcoes={opcoes} reaisNasSessoes={itensReaisVisiveis()} />

      {discursiva && (
        <section className={`${cartao} mt-12 flex flex-col gap-4`}>
          <h2 className={titulo.secao}>Tema de redação</h2>
          <p className={`${textoApoio} max-w-[60ch]`}>
            Proposta real de prova discursiva, com o padrão de resposta da banca. Entra aprovada e aparece primeiro na lista de
            temas.
          </p>
          <ImportarTemaReal pontuacaoMaxima={discursiva.pontuacaoMaxima} />
        </section>
      )}
    </>
  );
}

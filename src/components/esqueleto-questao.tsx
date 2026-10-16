import { Esqueleto, PaginaCarregando } from "./carregando";

// Formato de uma questão em andamento (treino ou simulado): enunciado, opções e navegação.
export function EsqueletoQuestao({ rotulo, comLateral = false }: { rotulo: string; comLateral?: boolean }) {
  return (
    <PaginaCarregando rotulo={rotulo}>
      <div className={`grid gap-8 ${comLateral ? "lg:grid-cols-[1fr_300px]" : ""}`}>
        <div className="flex flex-col gap-4">
          <Esqueleto className="h-4 w-40" />
          <Esqueleto className="h-5 w-full" />
          <Esqueleto className="h-5 w-full" />
          <Esqueleto className="h-5 w-3/4" />
          <div className="mt-4 flex gap-3">
            <Esqueleto className="h-12 w-32" />
            <Esqueleto className="h-12 w-32" />
          </div>
        </div>
        {comLateral && <Esqueleto className="hidden h-96 rounded-xl lg:block" />}
      </div>
    </PaginaCarregando>
  );
}

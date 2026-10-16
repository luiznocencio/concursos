import { Esqueleto, PaginaCarregando } from "@/components/carregando";

// Formato da redação: proposta e, abaixo, o texto e a folha de 30 linhas.
export default function Carregando() {
  return (
    <PaginaCarregando rotulo="Carregando a redação…">
      <Esqueleto className="h-6 w-40" />
      <Esqueleto className="h-32 rounded-xl" />
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <Esqueleto className="h-80" />
        <Esqueleto className="h-80" />
      </div>
    </PaginaCarregando>
  );
}

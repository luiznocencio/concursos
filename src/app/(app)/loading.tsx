import { Esqueleto, PaginaCarregando } from "@/components/carregando";

// Esqueleto padrão das páginas do app: título, texto e cartões, no formato do conteúdo que vai chegar.
export default function Carregando() {
  return (
    <PaginaCarregando rotulo="Carregando a página…">
      <Esqueleto className="h-10 w-64 max-w-full" />
      <Esqueleto className="h-5 w-[32rem] max-w-full" />
      <div className="mt-6 grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Esqueleto className="h-48 rounded-xl" />
        <Esqueleto className="h-48 rounded-xl" />
      </div>
      <Esqueleto className="h-64 rounded-xl" />
    </PaginaCarregando>
  );
}

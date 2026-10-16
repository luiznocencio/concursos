import { CircleNotch } from "@phosphor-icons/react/ssr";

// Indicador de andamento padrão do app (um só ícone em todo lugar, heurística de consistência).
// Sem animação para quem pede movimento reduzido.
export function Indicador({ tamanho = 16, className = "" }: { tamanho?: number; className?: string }) {
  return <CircleNotch size={tamanho} weight="bold" aria-hidden className={`shrink-0 animate-spin motion-reduce:animate-none ${className}`} />;
}

// Bloco do esqueleto de carregamento: tem o formato do conteúdo que vai chegar.
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-tinta/5 motion-reduce:animate-none ${className}`} />;
}

// Página inteira em carregamento: anuncia o estado para leitores de tela e mostra os blocos.
export function PaginaCarregando({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

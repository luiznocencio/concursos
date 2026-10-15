import { nota } from "@/lib/formato";

export interface PontoEvolucao {
  id: string;
  rotulo: string;
  nota: number;
}

// Notas de uma prova nos simulados entregues, com a linha do corte. Barras simples, sem trilho de fundo.
export function Evolucao({ nome, maximo, corte, pontos }: { nome: string; maximo: number; corte: number | null; pontos: PontoEvolucao[] }) {
  const altura = (v: number) => `${Math.max(2, (Math.max(0, v) / maximo) * 100)}%`;
  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex justify-between gap-4 text-sm">
        <span className="font-medium">{nome}</span>
        {corte !== null && <span className="text-pedra">corte {corte}</span>}
      </figcaption>
      <div className="relative flex h-32 items-end gap-2 border-b border-borda-forte">
        {corte !== null && (
          <div className="absolute inset-x-0 border-t border-dashed border-coral" style={{ bottom: altura(corte) }} aria-hidden />
        )}
        {pontos.map((p) => (
          <div key={p.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs tabular-nums text-grafite">{nota(p.nota)}</span>
            <div
              className={`w-full max-w-10 rounded-t ${corte !== null && p.nota < corte ? "bg-coral/70" : "bg-azul"}`}
              style={{ height: altura(p.nota) }}
              title={`${p.rotulo}: ${nota(p.nota)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {pontos.map((p) => (
          <span key={p.id} className="flex-1 text-center text-xs text-pedra">
            {p.rotulo}
          </span>
        ))}
      </div>
    </figure>
  );
}

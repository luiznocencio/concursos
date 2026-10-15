import { aproveitamento } from "@/lib/formato";

// Quatro semanas de aproveitamento líquido (−1 a 1) em barrinhas a partir de uma linha de base.
export function Tendencia({ valores }: { valores: (number | null)[] }) {
  const descricao = valores.map((v, i) => `semana ${i + 1}: ${v === null ? "sem respostas" : aproveitamento(v)}`).join("; ");
  return (
    <span className="inline-flex h-7 items-center gap-1" role="img" aria-label={descricao}>
      {valores.map((v, i) => (
        <span key={i} className="relative flex h-full w-2.5 flex-col justify-center">
          {v === null ? (
            <span className="h-px w-2.5 bg-black/20" />
          ) : (
            <span
              className={`absolute left-0 w-2.5 rounded-[2px] ${v >= 0 ? "bottom-1/2 bg-azul" : "top-1/2 bg-coral"}`}
              style={{ height: `${Math.max(6, Math.abs(v) * 50)}%` }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

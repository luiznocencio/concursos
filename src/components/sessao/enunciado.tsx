// Texto-base (quando há) e enunciado do item. Sem estado: serve à tela de treino, ao simulado e às listas de correção.
export function Enunciado({ textoBase, enunciado, topicos }: { textoBase: string | null; enunciado: string; topicos: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      {topicos.length > 0 && (
        <p className="flex flex-wrap gap-2">
          {topicos.map((t) => (
            <span key={t} className="rounded-full bg-tinta/5 px-3 py-1 text-xs font-medium text-tinta/70">
              {t}
            </span>
          ))}
        </p>
      )}
      {textoBase && (
        <div className="max-h-[50dvh] overflow-y-auto rounded-lg border border-borda bg-papel px-5 py-4 text-[15px] leading-relaxed whitespace-pre-line text-tinta/80">
          {textoBase}
        </div>
      )}
      <p className="max-w-[70ch] text-lg leading-relaxed whitespace-pre-line">{enunciado}</p>
    </div>
  );
}

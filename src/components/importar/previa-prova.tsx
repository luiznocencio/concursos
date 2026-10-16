import { pilula } from "@/components/ui";
import type { GrupoPrevia, ItemPrevia } from "@/importacao/previa";

export function GabaritoOficial({ gabarito }: { gabarito: "C" | "E" }) {
  return <span className={gabarito === "C" ? pilula.azul : pilula.neutra}>{gabarito === "C" ? "Certo" : "Errado"}</span>;
}

// Texto-base recolhido: abre para conferir sem empurrar os itens para baixo.
export function TextoBase({ texto }: { texto: string }) {
  return (
    <details className="group rounded-lg border border-borda bg-papel">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-grafite">
        <span className="line-clamp-1">Texto-base: {texto.split("\n")[0]}</span>
      </summary>
      <div className="max-h-[40dvh] overflow-y-auto border-t border-borda px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-tinta/80">
        {texto}
      </div>
    </details>
  );
}

export function LinhaItem({ item, children }: { item: ItemPrevia; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex items-start gap-3">
        <span className="w-8 shrink-0 pt-0.5 text-sm font-medium text-pedra tabular-nums">{item.numero}</span>
        <p className="flex-1 leading-relaxed">{item.enunciado}</p>
        <GabaritoOficial gabarito={item.gabarito} />
      </div>
      {children && <div className="pl-11">{children}</div>}
    </li>
  );
}

// Grupos lidos da prova: texto-base e itens com o gabarito oficial.
export function PreviaProva({ grupos }: { grupos: GrupoPrevia[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {grupos.map((g) => (
        <li key={g.itens[0].numero} className="rounded-xl border border-borda bg-superficie px-6 pt-5 pb-1">
          {g.textoBase ? <TextoBase texto={g.textoBase} /> : <p className="text-sm text-pedra">Itens sem texto-base</p>}
          <ul className="divide-y divide-borda">
            {g.itens.map((i) => (
              <LinhaItem key={i.numero} item={i} />
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

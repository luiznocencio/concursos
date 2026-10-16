import { CheckCircle, CircleNotch } from "@phosphor-icons/react/ssr";
import { AutoAtualizar } from "@/components/auto-atualizar";
import { TempoDeEspera } from "@/components/tempo-de-espera";
import type { Passo } from "@/lib/redacao";

// Enquanto o worker trabalha, recarrega os dados da página a cada 5 s; a página troca de tela quando o estado muda.
export function Andamento({ passos, desde }: { passos: Passo[]; desde: string }) {
  return (
    <div className="flex flex-col gap-4">
      <AutoAtualizar />
      <ul className="flex flex-col gap-3" aria-live="polite">
        {passos.map((p) => (
          <li key={p.nome} className="flex items-center gap-3">
            {p.feito ? (
              <CheckCircle size={22} weight="fill" className="text-azul" aria-label="concluído" />
            ) : (
              <CircleNotch size={22} className="animate-spin text-pedra motion-reduce:animate-none" aria-label="em andamento" />
            )}
            <span className={p.feito ? "" : "text-grafite"}>{p.nome}</span>
          </li>
        ))}
      </ul>
      <TempoDeEspera
        desde={desde}
        demora="Está demorando mais que o normal. Se a IA falhar, o sistema tenta de novo sozinho."
      />
    </div>
  );
}

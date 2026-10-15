import { notFound } from "next/navigation";
import { filaRevisaoItens } from "@/db/repositorios/estudo";
import { Enunciado } from "@/components/sessao/enunciado";
import { nomeGabarito } from "@/components/sessao/feedback";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { dataEHora } from "@/lib/formato";
import { contextoDoUsuario } from "../contexto";
import { decidir } from "./acoes";

interface Validacao {
  gabarito_validador?: string | null;
  justificativa_validador?: string | null;
  mesmo_provedor?: boolean;
  gerador?: { provedor?: string };
  validador?: { provedor?: string };
  denuncias?: { motivo?: string; em?: string }[];
}

export default async function FilaDeItens() {
  const { db, moderador } = await contextoDoUsuario();
  if (!moderador) notFound();
  const itens = await filaRevisaoItens(db);

  return (
    <>
      <h1 className={titulo.pagina}>Revisão de itens</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Itens em que as duas IAs discordaram e itens marcados como suspeitos. Nenhum deles aparece nas sessões até a sua decisão.
      </p>

      {itens.length === 0 ? (
        <p className={`${cartao} mt-8 text-grafite`}>Fila vazia. Bom sinal.</p>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {itens.map((i) => {
            const v = (i.validacao ?? {}) as Validacao;
            return (
              <li key={i.id} className={`${cartao} flex flex-col gap-6`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={i.status === "suspeito" ? pilula.erro : pilula.alerta}>
                    {i.status === "suspeito" ? "Suspeito" : v.mesmo_provedor ? "Validado pelo mesmo provedor" : "IAs discordaram"}
                  </span>
                  <span className="text-sm text-pedra">{dataEHora(i.criadoEm)}</span>
                </div>
                <Enunciado textoBase={i.textoBase} enunciado={i.enunciado} topicos={i.topicos} />
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-papel p-4">
                    <p className="text-sm font-medium">
                      Gerador{v.gerador?.provedor ? ` (${v.gerador.provedor})` : ""}: {nomeGabarito(i.gabarito)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-grafite">{i.justificativa}</p>
                  </div>
                  <div className="rounded-lg bg-papel p-4">
                    <p className="text-sm font-medium">
                      Validador{v.validador?.provedor ? ` (${v.validador.provedor})` : ""}:{" "}
                      {v.gabarito_validador ? nomeGabarito(v.gabarito_validador) : "sem julgamento"}
                    </p>
                    {v.justificativa_validador && (
                      <p className="mt-2 text-sm leading-relaxed text-grafite">{v.justificativa_validador}</p>
                    )}
                  </div>
                </div>
                {i.citacao && (
                  <blockquote className="border-l-2 border-borda-forte pl-4 text-sm leading-relaxed text-tinta/70">
                    {i.citacao}
                    {i.fonte && <span className="mt-1 block text-pedra">{i.fonte}</span>}
                  </blockquote>
                )}
                {v.denuncias && v.denuncias.length > 0 && (
                  <ul className="flex flex-col gap-1 text-sm">
                    {v.denuncias.map((d, k) => (
                      <li key={k} className="text-vermelho-tinta">
                        Denúncia{d.em ? ` em ${dataEHora(d.em)}` : ""}: {d.motivo || "sem motivo"}
                      </li>
                    ))}
                  </ul>
                )}
                <form action={decidir} className="flex flex-wrap gap-2">
                  <input type="hidden" name="item" value={i.id} />
                  <button type="submit" name="decisao" value="aprovar" className={botao.contorno}>
                    Aprovar como está
                  </button>
                  <button type="submit" name="decisao" value="inverter" className={botao.contorno}>
                    Aprovar com gabarito {i.gabarito === "C" ? "Errado" : "Certo"}
                  </button>
                  <button type="submit" name="decisao" value="descartar" className={`${botao.texto} text-vermelho`}>
                    Descartar
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

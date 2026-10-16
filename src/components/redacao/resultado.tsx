import { ROTULO_CATEGORIA, type CategoriaErro } from "@/core";
import type { RedacaoCompleta } from "@/db/repositorios/redacao";
import { notasPorAspecto } from "@/pipeline/discursiva/consolidar";
import { correcaoConteudoSchema, type CorrecaoConteudo } from "@/pipeline/discursiva/schemas";
import { treinarTopicos } from "@/app/(app)/acoes";
import { botao, cartao, pilula, textoApoio, titulo } from "@/components/ui";
import { nota } from "@/lib/formato";
import { segmentosDaLinha } from "@/lib/redacao";
import { BotaoEnviar } from "@/components/botao-enviar";

const BANCAS = ["conteudo_1", "conteudo_2", "conteudo_3"] as const;
const NOME_TIPO: Record<string, string> = { grafia: "grafia", morfossintaxe: "morfossintaxe", propriedade_vocabular: "propriedade vocabular" };
const MOTIVO_ZERO: Record<string, string> = {
  sem_texto: "Texto sem linhas escritas recebe nota zero (edital, item 9.7.5, alínea f).",
  fuga_tema: "As bancas consideraram que o texto fugiu ao tema: a nota é zero (edital, item 9.7.5, alínea f).",
  npd_negativo: "Os erros de língua superaram a nota de conteúdo, e a nota final não fica negativa (edital, item 9.7.5, alínea e).",
};

function rotuloCategoria(c: string): string {
  return ROTULO_CATEGORIA[c as CategoriaErro] ?? c;
}

export function ResultadoRedacao({ r }: { r: RedacaoCompleta }) {
  const npd = r.npd ?? 0;
  const aprovado = npd >= r.config.notaMinima;
  const aspectos = r.tema.padrao.aspectos;
  const bancas = BANCAS.map((papel) => {
    const c = r.correcoes.find((x) => x.papel === papel);
    const lida = c ? correcaoConteudoSchema.safeParse(c.resposta) : null;
    return lida?.success ? { papel, correcao: lida.data as CorrecaoConteudo } : null;
  }).filter((b) => b !== null);
  const notas = bancas.map((b) => notasPorAspecto(b.correcao, aspectos));
  const usadas = new Set(r.detalhes?.usadas ?? []);
  const media = new Map((r.detalhes?.aspectos ?? []).map((a) => [a.codigo, a.nota]));
  const erros = r.erros.map((e, i) => ({ ...e, numero: i + 1 }));

  return (
    <div className="flex flex-col gap-12">
      <section className={`${cartao} flex flex-col gap-4 p-8`}>
        <p className="text-sm text-pedra">Nota na prova discursiva</p>
        <p className="flex flex-wrap items-baseline gap-3">
          <span className={titulo.pagina}>{nota(npd)}</span>
          <span className="text-grafite">de {r.config.pontuacaoMaxima}</span>
          <span className={aprovado ? pilula.azul : pilula.erro}>
            {aprovado ? "Acima" : "Abaixo"} do mínimo de {r.config.notaMinima}
          </span>
        </p>
        {r.zeradaMotivo ? (
          <p className={textoApoio}>{MOTIVO_ZERO[r.zeradaMotivo]}</p>
        ) : (
          <p className={`${textoApoio} tabular-nums`}>
            NPD = NC − 6 × NE ÷ TL = {nota(r.nc ?? 0)} − 6 × {r.ne ?? 0} ÷ {r.tl ?? 0} = {nota(npd)}
          </p>
        )}
        {r.terceiraCorrecao && (
          <p className="text-sm text-grafite">
            As duas primeiras bancas divergiram em mais de 25% da nota: houve terceira correção, e valeu a média das duas
            notas mais próximas.
          </p>
        )}
      </section>

      {r.prioridades.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className={titulo.secao}>O que estudar primeiro</h2>
          <ol className="flex flex-col gap-3">
            {r.prioridades.map((p, i) => (
              <li key={i} className={`${cartao} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                <div className="min-w-0">
                  <p className="font-medium">{p.titulo}</p>
                  <p className="text-sm text-grafite">{p.detalhe}</p>
                </div>
                {p.canonico && (
                  <form action={treinarTopicos}>
                    <input type="hidden" name="canonico" value={p.canonico} />
                    <input type="hidden" name="total" value="10" />
                    <BotaoEnviar pendente="Montando o treino…" className={botao.secundario}>
                      Treinar 10 itens
                    </BotaoEnviar>
                  </form>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <h2 className={titulo.secao}>Conteúdo</h2>
        <ul className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {aspectos.map((a, k) => (
            <li key={a.codigo} className="px-5 py-4">
              <details>
                <summary className="flex cursor-pointer list-none items-start gap-4">
                  <span className="min-w-0 flex-1">
                    <span className="text-pedra">{a.codigo}</span> {a.descricao}
                    <span className="mt-1 block text-sm text-pedra">
                      {bancas.map((b, i) => `Banca ${i + 1}: ${nota(notas[i][k])}`).join(" · ")}
                      {usadas.size > 0 && bancas.some((b) => !usadas.has(b.papel)) && " (vale a média das duas mais próximas)"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold">{nota(media.get(a.codigo) ?? 0)}</span>
                    <span className="text-sm text-pedra"> de {nota(a.pontos)}</span>
                  </span>
                </summary>
                <ul className="mt-3 flex flex-col gap-2 text-sm text-grafite">
                  {bancas.map((b, i) => {
                    const j = b.correcao.aspectos.find((x) => x.codigo.trim() === a.codigo)?.justificativa;
                    return j ? (
                      <li key={b.papel}>
                        <span className="font-medium text-tinta">Banca {i + 1}:</span> {j}
                      </li>
                    ) : null;
                  })}
                </ul>
              </details>
            </li>
          ))}
        </ul>
        {bancas.map((b, i) => (
          <p key={b.papel} className="text-sm text-grafite">
            <span className="font-medium text-tinta">Banca {i + 1}:</span> {b.correcao.comentario}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className={titulo.secao}>
          Língua portuguesa <span className="text-base font-normal text-pedra">({erros.length === 1 ? "1 erro" : `${erros.length} erros`})</span>
        </h2>
        <ol className="rounded-xl border border-borda bg-superficie font-mono text-[13px] leading-7">
          {r.linhas.map((linha, i) => (
            <li key={i} className="flex border-b border-borda last:border-b-0">
              <span className="w-9 shrink-0 border-r border-borda pr-2 text-right text-pedra select-none">{i + 1}</span>
              <span className="min-w-0 flex-1 px-2 break-words whitespace-pre-wrap">
                {segmentosDaLinha(
                  linha,
                  erros.filter((e) => e.linha === i + 1),
                ).map((s, j) =>
                  s.erro === null ? (
                    <span key={j}>{s.texto}</span>
                  ) : (
                    <a
                      key={j}
                      href={`#erro-${s.erro}`}
                      aria-label={`${s.texto} (erro ${s.erro})`}
                      className="text-vermelho underline decoration-wavy underline-offset-4"
                    >
                      {s.texto}
                      <sup className="ml-0.5 font-sans">{s.erro}</sup>
                    </a>
                  ),
                )}
              </span>
            </li>
          ))}
        </ol>
        {erros.length > 0 && (
          <ol className="flex flex-col gap-3">
            {erros.map((e) => (
              <li key={e.id} id={`erro-${e.numero}`} className="scroll-mt-24 text-[15px]">
                <p>
                  <span className="font-semibold">{e.numero}.</span> Linha {e.linha} · {rotuloCategoria(e.categoria)}{" "}
                  <span className="text-pedra">({NOME_TIPO[e.tipo] ?? e.tipo})</span>
                </p>
                <p className="text-grafite">
                  <span className="text-vermelho line-through">{e.trecho}</span> → <span className="text-tinta">{e.correcao}</span>.{" "}
                  {e.explicacao}
                </p>
              </li>
            ))}
          </ol>
        )}
        {(r.detalhes?.erros_descartados ?? 0) > 0 && (
          <p className="text-sm text-pedra">
            {r.detalhes!.erros_descartados} apontamento(s) da revisão foram descartados porque não correspondiam ao texto.
          </p>
        )}
      </section>

      <section>
        <details className={cartao}>
          <summary className="cursor-pointer font-semibold">Padrão de resposta</summary>
          <ul className="mt-4 flex flex-col gap-1 text-[15px]">
            {aspectos.map((a) => (
              <li key={a.codigo}>
                <span className="text-pedra">{a.codigo}</span> {a.descricao} — até {nota(a.pontos)} pontos
              </li>
            ))}
          </ul>
          <p className={`${textoApoio} mt-4 whitespace-pre-line`}>{r.tema.padrao.expectativas}</p>
        </details>
      </section>
    </div>
  );
}

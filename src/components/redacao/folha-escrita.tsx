"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { entregar, salvarRascunho } from "@/app/(app)/redacao/acoes";
import { contarTL, distribuirEmLinhas } from "@/core/discursiva/linhas";
import type { ConfigDiscursiva } from "@/core/discursiva/tipos";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";
import { duracao } from "@/lib/formato";

type Salvamento = "salvo" | "pendente" | "salvando" | "erro";
const ESPERA_SALVAR_MS = 1500;
const TEMPO_SUGERIDO_MS = 60 * 60_000;

// Conta o tempo desde a primeira tecla, sem guardar no servidor (é só uma referência para treinar).
function TempoEscrevendo({ inicio }: { inicio: number | null }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (inicio === null) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inicio]);
  if (inicio === null) return <span className="text-pedra">o tempo começa na primeira tecla</span>;
  const passou = Math.max(0, agora - inicio);
  return (
    <span className={`tabular-nums ${passou > TEMPO_SUGERIDO_MS ? "text-vermelho" : "text-grafite"}`}>
      {duracao(passou)} {passou > TEMPO_SUGERIDO_MS ? "(passou de 1 hora)" : "de 1 hora sugerida"}
    </span>
  );
}

// Escrita da redação: o texto digitado é distribuído nas linhas da folha como na prova, e salvo sozinho.
// `noSimulado`: sem entrega nem cronômetro próprios (o simulado entrega tudo junto e tem o seu tempo);
// `aoMudar` repassa o texto atual para o simulado enviar na entrega.
export function FolhaEscrita({
  redacaoId,
  textoInicial,
  config,
  noSimulado = false,
  aoMudar,
}: {
  redacaoId: string;
  textoInicial: string;
  config: ConfigDiscursiva;
  noSimulado?: boolean;
  aoMudar?: (texto: string) => void;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(textoInicial);
  const [salvamento, setSalvamento] = useState<Salvamento>("salvo");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [entregando, iniciarEntrega] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const folha = distribuirEmLinhas(texto, config.caracteresPorLinha, config.linhasMax);
  const tl = contarTL(folha.linhas);

  async function salvar(valor: string) {
    setSalvamento("salvando");
    const r = await salvarRascunho(redacaoId, valor);
    if (r.ok) {
      setSalvamento("salvo");
      setErro(null);
    } else {
      setSalvamento("erro");
      setErro(r.erro);
    }
  }

  function aoDigitar(valor: string) {
    setTexto(valor);
    aoMudar?.(valor);
    setSalvamento("pendente");
    if (inicio === null) setInicio(Date.now());
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => salvar(valor), ESPERA_SALVAR_MS);
  }

  function confirmarEntrega() {
    if (timer.current) clearTimeout(timer.current);
    iniciarEntrega(async () => {
      const r = await entregar(redacaoId, texto);
      if (!r.ok) {
        setErro(r.erro);
        setConfirmando(false);
        return;
      }
      router.refresh();
    });
  }

  const estado = { salvo: "Rascunho salvo", pendente: "Salvando em instantes…", salvando: "Salvando…", erro: "Não salvou" }[salvamento];

  return (
    <div className="flex flex-col gap-6">
      {/* No simulado a coluna é mais estreita: texto e folha ficam um embaixo do outro. */}
      <div className={`grid gap-6 ${noSimulado ? "" : "lg:grid-cols-2"}`}>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="texto" className="text-sm font-medium">
            Seu texto
          </label>
          <textarea
            id="texto"
            value={texto}
            onChange={(e) => aoDigitar(e.target.value)}
            rows={18}
            spellCheck={false}
            placeholder="Escreva aqui. Use Enter para começar um parágrafo novo."
            className="min-h-80 w-full resize-y rounded-lg border border-borda-campo bg-superficie px-4 py-3 text-[15px] leading-relaxed"
          />
          <p className="flex flex-wrap justify-between gap-2 text-sm" aria-live="polite">
            <span className={`flex items-center gap-1.5 ${salvamento === "erro" ? "text-vermelho" : "text-pedra"}`}>
              {salvamento === "salvando" && <Indicador tamanho={12} />}
              {estado}
            </span>
            {!noSimulado && <TempoEscrevendo inicio={inicio} />}
          </p>
        </div>

        <figure className="flex min-w-0 flex-col gap-2">
          <figcaption className="flex justify-between gap-2 text-sm">
            <span className="font-medium">Folha de texto definitivo</span>
            <span className={`tabular-nums ${folha.excedente.length ? "text-vermelho" : "text-pedra"}`}>
              {tl}/{config.linhasMax} linhas
            </span>
          </figcaption>
          {/* Largura fixa para as linhas não quebrarem; no celular a folha rola na horizontal. */}
          <div className="overflow-x-auto rounded-lg border border-borda bg-superficie">
            <ol className="min-w-[30rem] text-[13px] leading-6">
              {Array.from({ length: config.linhasMax }, (_, i) => (
                <li key={i} className="flex border-b border-borda last:border-b-0">
                  <span className="w-9 shrink-0 border-r border-borda pr-2 text-right text-pedra tabular-nums select-none">{i + 1}</span>
                  <span className="px-2 whitespace-pre">{folha.linhas[i] ?? ""}</span>
                </li>
              ))}
            </ol>
          </div>
          {folha.excedente.length > 0 && (
            <p className="text-sm text-vermelho">
              {folha.excedente.length === 1 ? "1 linha passou" : `${folha.excedente.length} linhas passaram`} do limite e não
              serão corrigidas (edital, item 9.7.5): {folha.excedente.join(" ").slice(0, 120)}…
            </p>
          )}
        </figure>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-vermelho">
          {erro}
        </p>
      )}
      {noSimulado ? (
        <p className="text-sm text-pedra">A redação é entregue junto com o simulado.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {confirmando ? (
            <>
              <span className="text-sm">Depois de entregar, o texto não pode mais ser editado.</span>
              <button type="button" onClick={confirmarEntrega} disabled={entregando} aria-busy={entregando} className={botao.primario}>
                {entregando && <Indicador />}
                {entregando ? "Entregando…" : "Entregar agora"}
              </button>
              <button type="button" onClick={() => setConfirmando(false)} disabled={entregando} className={botao.texto}>
                Continuar escrevendo
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} disabled={tl === 0} className={botao.primario}>
              Entregar para correção
            </button>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { gravar, sugerir } from "@/app/(app)/importar/acoes";
import { botao, cartao, textoApoio, titulo } from "@/components/ui";
import type { ResultadoImportacao } from "@/db/repositorios/importacao";
import { faixas, montarPrevia, type PreviaImportacao } from "@/importacao/previa";
import type { OpcaoTopico } from "@/importacao/topicos";
import { EscolhaTopicos } from "./escolha-topicos";
import { PreviaProva } from "./previa-prova";

type Etapa = "colar" | "previa" | "topicos" | "resumo";

const ETAPAS: { id: Etapa; nome: string }[] = [
  { id: "colar", nome: "Colar a prova" },
  { id: "previa", nome: "Conferir" },
  { id: "topicos", nome: "Tópicos" },
  { id: "resumo", nome: "Pronto" },
];

const campo = "w-full rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-[15px] placeholder:text-pedra";

function Passos({ atual }: { atual: Etapa }) {
  const indice = ETAPAS.findIndex((e) => e.id === atual);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Etapas da importação">
      {ETAPAS.map((e, k) => (
        <li
          key={e.id}
          aria-current={k === indice ? "step" : undefined}
          className={`flex items-center gap-2 ${k === indice ? "font-medium text-tinta" : k < indice ? "text-grafite" : "text-pedra"}`}
        >
          <span
            className={`flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
              k === indice ? "bg-tinta text-papel" : "bg-tinta/5"
            }`}
          >
            {k + 1}
          </span>
          {e.nome}
        </li>
      ))}
    </ol>
  );
}

function Inconsistencias({ previa }: { previa: PreviaImportacao }) {
  const linhas = [
    previa.anulados.length > 0 && `Anulados, não entram: ${faixas(previa.anulados)}.`,
    previa.semGabarito.length > 0 && `Sem gabarito, não entram: ${faixas(previa.semGabarito)}.`,
    previa.gabaritoSemItem.length > 0 && `No gabarito, mas não encontrados no texto: ${faixas(previa.gabaritoSemItem)}.`,
    ...previa.avisos,
  ].filter((l): l is string => Boolean(l));
  if (linhas.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-grafite">
        <CheckCircle size={18} weight="fill" className="text-azul" aria-hidden />
        Nenhuma inconsistência entre o texto e o gabarito.
      </p>
    );
  }
  return (
    <div className="rounded-lg bg-marigold-claro px-4 py-3 text-sm text-marigold-tinta" role="status">
      <p className="flex items-center gap-2 font-medium">
        <WarningCircle size={18} weight="fill" aria-hidden />
        Confira antes de seguir
      </p>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-6">
        {linhas.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

// Importação em quatro etapas. A leitura da prova e do gabarito roda no navegador; a sugestão de
// tópicos e a gravação são Server Actions que conferem o moderador.
export function AssistenteImportacao({
  concurso,
  opcoes,
  reaisNasSessoes,
}: {
  concurso: string;
  opcoes: OpcaoTopico[];
  reaisNasSessoes: boolean;
}) {
  const [etapa, setEtapa] = useState<Etapa>("colar");
  const [provaOrigem, setProvaOrigem] = useState("");
  const [textoProva, setTextoProva] = useState("");
  const [textoGabarito, setTextoGabarito] = useState("");
  const [previa, setPrevia] = useState<PreviaImportacao | null>(null);
  const [topicos, setTopicos] = useState<Record<number, string[]>>({});
  const [sugeridos, setSugeridos] = useState<Record<number, string[]>>({});
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const itens = previa?.grupos.flatMap((g) => g.itens) ?? [];
  const semTopico = itens.filter((i) => (topicos[i.numero] ?? []).length === 0).map((i) => i.numero);

  function irPara(nova: Etapa) {
    setErro(null);
    setEtapa(nova);
    window.scrollTo({ top: 0 });
  }

  function analisar(ev: React.FormEvent) {
    ev.preventDefault();
    setPrevia(montarPrevia(textoProva, textoGabarito));
    setTopicos({});
    setSugeridos({});
    irPara("previa");
  }

  function pedirSugestao() {
    if (!previa) return;
    setErro(null);
    iniciar(async () => {
      const r = await sugerir(previa.grupos);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setSugeridos(r.dados);
      setTopicos(r.dados);
      irPara("topicos");
    });
  }

  function confirmarGravacao() {
    if (!previa) return;
    setErro(null);
    iniciar(async () => {
      const r = await gravar({
        provaOrigem,
        grupos: previa.grupos.map((g) => ({
          textoBase: g.textoBase,
          itens: g.itens.map((i) => ({ ...i, canonicos: topicos[i.numero] ?? [] })),
        })),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setResultado(r.dados);
      irPara("resumo");
    });
  }

  function recomecar() {
    setTextoProva("");
    setTextoGabarito("");
    setPrevia(null);
    setResultado(null);
    irPara("colar");
  }

  const alerta = erro && (
    <p role="alert" className="text-sm text-vermelho">
      {erro}
    </p>
  );

  return (
    <div className="mt-8 flex flex-col gap-8">
      <Passos atual={etapa} />

      {etapa === "colar" && (
        <form onSubmit={analisar} className={`${cartao} flex max-w-3xl flex-col gap-6`}>
          <div className="flex flex-col gap-2">
            <label htmlFor="prova-origem" className="text-sm font-medium">
              Prova de origem
            </label>
            <input
              id="prova-origem"
              value={provaOrigem}
              onChange={(e) => setProvaOrigem(e.target.value)}
              required
              minLength={3}
              maxLength={120}
              placeholder="CBM-AL 2021 Soldado"
              className={campo}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="texto-prova" className="text-sm font-medium">
              Texto da prova
            </label>
            <p id="ajuda-prova" className="text-sm text-pedra">
              Cole os textos, os comandos (&quot;Julgue os itens a seguir...&quot;) e os itens numerados. Separe os blocos com uma linha em branco.
            </p>
            <textarea
              id="texto-prova"
              aria-describedby="ajuda-prova"
              value={textoProva}
              onChange={(e) => setTextoProva(e.target.value)}
              required
              rows={16}
              className={`${campo} leading-relaxed`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="texto-gabarito" className="text-sm font-medium">
              Gabarito oficial
            </label>
            <p id="ajuda-gabarito" className="text-sm text-pedra">
              Número e resposta (&quot;1 C 2 E 3 X&quot;) ou a tabela do gabarito definitivo. X ou ANULADO marca item anulado, que não é importado.
            </p>
            <textarea
              id="texto-gabarito"
              aria-describedby="ajuda-gabarito"
              value={textoGabarito}
              onChange={(e) => setTextoGabarito(e.target.value)}
              required
              rows={4}
              className={`${campo} font-mono text-sm`}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={provaOrigem.trim().length < 3 || !textoProva.trim() || !textoGabarito.trim()}
              className={botao.primario}
            >
              Analisar prova
            </button>
          </div>
        </form>
      )}

      {etapa === "previa" && previa && (
        <>
          <section className={`${cartao} flex flex-col gap-4`} aria-labelledby="titulo-previa">
            <h2 id="titulo-previa" className={titulo.secao}>
              {previa.total === 1 ? "1 item pronto para importar" : `${previa.total} itens prontos para importar`}
            </h2>
            <p className={textoApoio}>
              {provaOrigem}. Confira o texto-base de cada grupo e o gabarito de cada item.
            </p>
            <Inconsistencias previa={previa} />
            {alerta}
            <div className="flex flex-wrap gap-2">
              {previa.total > 0 && (
                <>
                  <button type="button" onClick={pedirSugestao} disabled={pendente} className={botao.primario}>
                    {pendente ? "Pedindo sugestões..." : "Sugerir tópicos com IA"}
                  </button>
                  <button type="button" onClick={() => irPara("topicos")} disabled={pendente} className={botao.contorno}>
                    Escolher tópicos sem IA
                  </button>
                </>
              )}
              <button type="button" onClick={() => irPara("colar")} disabled={pendente} className={botao.texto}>
                Voltar e corrigir o texto
              </button>
            </div>
          </section>
          <PreviaProva grupos={previa.grupos} />
        </>
      )}

      {etapa === "topicos" && previa && (
        <>
          <section className={`${cartao} flex flex-col gap-4`} aria-labelledby="titulo-topicos">
            <h2 id="titulo-topicos" className={titulo.secao}>
              Tópicos de cada item
            </h2>
            <p className={textoApoio}>
              Tópicos do edital de {concurso}. {Object.keys(sugeridos).length > 0 ? "As sugestões da IA vêm marcadas; confirme ou troque." : "Escolha ao menos um por item."}
            </p>
            <p className="text-sm text-grafite" aria-live="polite">
              {semTopico.length === 0 ? "Todos os itens têm tópico." : `Faltam tópicos nos itens ${faixas(semTopico)}.`}
            </p>
            {alerta}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={confirmarGravacao} disabled={pendente || semTopico.length > 0} className={botao.primario}>
                {pendente ? "Gravando..." : itens.length === 1 ? "Gravar 1 item" : `Gravar ${itens.length} itens`}
              </button>
              <button type="button" onClick={() => irPara("previa")} disabled={pendente} className={botao.texto}>
                Voltar
              </button>
            </div>
          </section>
          <EscolhaTopicos
            grupos={previa.grupos}
            opcoes={opcoes}
            topicos={topicos}
            sugeridos={sugeridos}
            aoMudar={(numero, canonicos) => setTopicos((t) => ({ ...t, [numero]: canonicos }))}
          />
        </>
      )}

      {etapa === "resumo" && resultado && (
        <section className={`${cartao} flex max-w-2xl flex-col gap-4`} aria-labelledby="titulo-resumo">
          <h2 id="titulo-resumo" className={titulo.secao}>
            {resultado.gravados === 1 ? "1 item gravado" : `${resultado.gravados} itens gravados`}
          </h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
            <dt className="text-pedra">Prova</dt>
            <dd>{provaOrigem}</dd>
            <dt className="text-pedra">Novos</dt>
            <dd className="tabular-nums">{resultado.gravados}</dd>
            <dt className="text-pedra">Já existiam</dt>
            <dd className="tabular-nums">
              {resultado.duplicados.length === 0 ? "nenhum" : `${resultado.duplicados.length} (itens ${faixas(resultado.duplicados)})`}
            </dd>
          </dl>
          <p className={textoApoio}>
            {reaisNasSessoes
              ? "Os itens entram como aprovados e já aparecem nas sessões de estudo dos tópicos escolhidos."
              : "Modo produto: os itens reais não aparecem nas sessões e servem só de referência de estilo para a geração."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={recomecar} className={botao.primario}>
              Importar outra prova
            </button>
            <Link href="/treinar" className={botao.texto}>
              Ir para o treino
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

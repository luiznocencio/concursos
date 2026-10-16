"use client";

import { useActionState } from "react";
import { importarTema, type EstadoTema } from "@/app/(app)/importar/acoes";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";

const campo = "w-full rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-[15px]";

// Formulário de tema real de discursiva. Em caso de erro, os campos voltam preenchidos.
export function ImportarTemaReal({ pontuacaoMaxima }: { pontuacaoMaxima: number }) {
  const [estado, enviar, enviando] = useActionState<EstadoTema, FormData>(importarTema, null);
  const valores = estado?.tipo === "erro" ? estado.campos : null;
  // A chave muda a cada resposta: o formulário remonta com os valores devolvidos (ou vazio depois de gravar).
  return (
    <form key={estado?.vez ?? 0} action={enviar} className="flex flex-col gap-5">
      {estado?.tipo === "gravado" && (
        <p role="status" className="rounded-xl bg-azul-claro px-4 py-3 text-[15px] text-azul-tinta">
          Tema gravado. Ele já aparece em Redação, entre os temas reais.
        </p>
      )}
      {estado?.tipo === "duplicado" && (
        <p role="status" className="rounded-xl bg-marigold-claro px-4 py-3 text-[15px] text-marigold-tinta">
          Esse tema já estava cadastrado; nada foi gravado.
        </p>
      )}
      {estado?.tipo === "erro" && (
        <ul role="alert" className="list-disc rounded-xl bg-vermelho-claro py-3 pr-4 pl-8 text-[15px] text-vermelho">
          {estado.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Prova de origem
        <input name="provaOrigem" defaultValue={valores?.provaOrigem} placeholder="CEBRASPE 2021 · CBM-AL · Soldado" className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Enunciado (comando da prova)
        <textarea name="enunciado" rows={6} defaultValue={valores?.enunciado} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Textos de apoio
        <span className="font-normal text-pedra">Um por bloco, separados por linha em branco. Opcional: “Texto I” na primeira linha e “Fonte: …” na última.</span>
        <textarea name="textosApoio" rows={6} defaultValue={valores?.textosApoio} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Padrão de resposta
        <span className="font-normal text-pedra">
          Uma linha por aspecto: código | descrição | pontos. Os pontos somam {pontuacaoMaxima}.
        </span>
        <textarea
          name="padrao"
          rows={5}
          defaultValue={valores?.padrao}
          placeholder={"1 | Apresentação e estrutura textual | 3\n2.1 | Primeiro tópico | 9\n2.2 | Segundo tópico | 9\n2.3 | Terceiro tópico | 9"}
          className={`${campo} font-mono text-[13px]`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        O que a banca espera (opcional)
        <textarea name="expectativas" rows={4} defaultValue={valores?.expectativas} className={campo} />
      </label>
      <button type="submit" disabled={enviando} aria-busy={enviando} className={`${botao.contorno} self-start`}>
        {enviando && <Indicador />}
        {enviando ? "Gravando…" : "Gravar tema"}
      </button>
    </form>
  );
}

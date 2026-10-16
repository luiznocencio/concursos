"use client";

import { Camera } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { registrarFotos } from "@/app/(app)/redacao/acoes";
import { criarClienteNavegador } from "@/db/supabase/navegador";
import { Indicador } from "@/components/carregando";
import { botao } from "@/components/ui";
import { BUCKET_FOTOS, validarFoto } from "@/lib/redacao";

const LADO_MAXIMO = 2000;

// Reduz a foto para no máximo 2000 px no lado maior (JPEG), o bastante para ler a letra e leve para enviar.
async function reduzirFoto(arquivo: File): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(imagem.width * escala);
  canvas.height = Math.round(imagem.height * escala);
  canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível ler a foto."))), "image/jpeg", 0.85),
  );
}

export function EnvioFoto({ redacaoId, usuarioId }: { redacaoId: string; usuarioId: string }) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // Passo atual do envio (reduzir, enviar, registrar), mostrado no botão: o envio de 2 fotos pode levar vários segundos.
  const [passo, setPasso] = useState("Enviando…");

  function escolher(lista: FileList | null) {
    const escolhidos = Array.from(lista ?? []).slice(0, 2);
    const problema = escolhidos.map(validarFoto).find(Boolean) ?? null;
    setErro(problema);
    setArquivos(problema ? [] : escolhidos);
  }

  function enviar() {
    iniciar(async () => {
      try {
        const db = criarClienteNavegador();
        const caminhos: string[] = [];
        const total = arquivos.length;
        for (const [i, arquivo] of arquivos.entries()) {
          const deQuantas = total > 1 ? ` ${i + 1} de ${total}` : "";
          setPasso(`Reduzindo a foto${deQuantas}…`);
          const reduzida = await reduzirFoto(arquivo);
          setPasso(`Enviando a foto${deQuantas}…`);
          const caminho = `${usuarioId}/${redacaoId}/${Date.now()}-${i + 1}.jpg`;
          const { error } = await db.storage.from(BUCKET_FOTOS).upload(caminho, reduzida, { contentType: "image/jpeg" });
          if (error) throw error;
          caminhos.push(caminho);
        }
        setPasso("Registrando para a transcrição…");
        const r = await registrarFotos(redacaoId, caminhos);
        if (!r.ok) {
          setErro(r.erro);
          return;
        }
        router.refresh();
      } catch (e) {
        console.error(e);
        setErro("Não foi possível enviar a foto. Verifique a conexão e tente de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className={`${botao.secundario} w-fit cursor-pointer has-focus-visible:outline-2`}>
        <Camera size={20} aria-hidden />
        <span>Escolher fotos da folha (até 2)</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => escolher(e.target.files)}
          className="sr-only"
        />
      </label>
      {arquivos.length > 0 && <p className="text-sm text-grafite">{arquivos.map((a) => a.name).join(", ")}</p>}
      {erro && (
        <p role="alert" className="text-sm text-vermelho">
          {erro}
        </p>
      )}
      <button
        type="button"
        onClick={enviar}
        disabled={arquivos.length === 0 || enviando}
        aria-busy={enviando}
        className={`${botao.contorno} self-start`}
      >
        {enviando && <Indicador />}
        {enviando ? passo : "Enviar para transcrição"}
      </button>
    </div>
  );
}

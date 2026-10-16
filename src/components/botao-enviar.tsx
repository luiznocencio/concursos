"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Indicador } from "./carregando";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  // Texto enquanto o formulário é enviado, dizendo o que está acontecendo ("Montando a sessão…").
  pendente: string;
};

// Botão de envio de formulário com Server Action: responde na hora ao clique, mostra o andamento
// e fica desativado até a resposta (evita envio duplo). Com `name`/`value`, só o botão clicado mostra o andamento.
export function BotaoEnviar({ pendente, children, disabled, name, value, ...props }: Props) {
  const { pending, data } = useFormStatus();
  const esteBotao = pending && (name === undefined || data?.get(name) === String(value));
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} aria-busy={esteBotao} {...props}>
      {esteBotao ? (
        <>
          <Indicador />
          {pendente}
        </>
      ) : (
        children
      )}
    </button>
  );
}

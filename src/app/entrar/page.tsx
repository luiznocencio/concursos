import { botao } from "@/components/ui";
import { enviarLinkMagico } from "./actions";
import { BotaoEnviar } from "@/components/botao-enviar";

const MENSAGENS: Record<string, string> = {
  email: "Informe um e-mail válido.",
  "nao-autorizado": "Este e-mail não tem acesso à plataforma.",
  envio: "Não foi possível enviar o link. Tente de novo em alguns minutos.",
  limite: "Limite de e-mails de acesso atingido. Use o último link recebido ou tente de novo em até 1 hora.",
  link: "O link expirou ou já foi usado. Peça um novo.",
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string; proximo?: string }>;
}) {
  const { erro, enviado, proximo } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-[40px] font-semibold leading-tight tracking-tight">Entrar</h1>
      {enviado ? (
        <p className="rounded-xl border border-borda bg-superficie p-6 text-grafite">
          Enviamos um link de acesso para o seu e-mail. Abra-o neste navegador.
        </p>
      ) : (
        <form action={enviarLinkMagico} className="flex flex-col gap-3 rounded-xl border border-borda bg-superficie p-6">
          <label htmlFor="email" className="text-sm font-medium">
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-borda-campo bg-superficie px-3 py-2"
          />
          <input type="hidden" name="proximo" value={proximo ?? "/"} />
          {erro && <p className="text-sm text-vermelho">{MENSAGENS[erro] ?? "Algo deu errado."}</p>}
          <BotaoEnviar pendente="Enviando o link…" className={botao.primario}>
            Receber link de acesso
          </BotaoEnviar>
        </form>
      )}
    </main>
  );
}

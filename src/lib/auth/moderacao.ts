import { emailPermitido } from "./rotas";

// Quem pode aprovar ou descartar itens e ver custos de IA. Sem MODERADORES_EMAILS, vale a lista de acesso.
export function ehModerador(email: string | null | undefined, env: Record<string, string | undefined> = process.env): boolean {
  if (!email) return false;
  return emailPermitido(email, env.MODERADORES_EMAILS ?? env.AUTH_EMAILS_PERMITIDOS);
}

"use server";

import { ErroIa } from "@/ai/tipos";
import { dadosDaImportacao, importarItensReais, registrarUsoSugestao, type ResultadoImportacao } from "@/db/repositorios/importacao";
import { criarClienteServico } from "@/db/supabase/servico";
import { ErroImportacao, importacaoSchema, montarLoteReal, previaSchema } from "@/importacao/gravacao";
import { lerTemaReal, type CamposTema } from "@/importacao/tema";
import { configDaDiscursiva } from "@/db/repositorios/redacao";
import type { Json } from "@/db/types";
import { sugerirTopicos } from "@/importacao/topicos";
import { criarProvedores } from "@/pipeline/config";
import type { Retorno } from "../sessao/[id]/acoes";
import { contextoDoUsuario, exigirCargo } from "../contexto";

const SO_MODERADOR = { ok: false, erro: "Apenas moderadores importam itens." } as const;

// Fora do try: contextoDoUsuario e exigirCargo redirecionam, e o redirect não pode ser engolido.
async function moderador() {
  const { moderador } = await contextoDoUsuario();
  return moderador ? exigirCargo() : null;
}

function falha(e: unknown, padrao: string): { ok: false; erro: string } {
  if (e instanceof ErroImportacao) return { ok: false, erro: e.message };
  console.error(e);
  return { ok: false, erro: padrao };
}

// Sugestão de tópicos canônicos por IA (Claude, o primeiro de criarProvedores). Melhor-esforço:
// se falhar, a tela segue com a escolha manual.
export async function sugerir(grupos: unknown): Promise<Retorno<Record<number, string[]>>> {
  const ctx = await moderador();
  if (!ctx) return SO_MODERADOR;
  const lidos = previaSchema.safeParse(grupos);
  if (!lidos.success) return { ok: false, erro: "Prévia inválida. Volte e analise a prova de novo." };
  try {
    const { opcoes } = await dadosDaImportacao(ctx.db, ctx.cargo.id);
    const [claude] = criarProvedores();
    const registrarUso = registrarUsoSugestao(criarClienteServico());
    const r = await sugerirTopicos({ provedor: claude, registrarUso }, { grupos: lidos.data, opcoes });
    return { ok: true, dados: r.porItem };
  } catch (e) {
    if (e instanceof ErroIa) {
      console.error(e);
      return { ok: false, erro: "A IA não respondeu agora. Escolha os tópicos à mão ou tente de novo." };
    }
    return falha(e, "Não foi possível sugerir tópicos. Escolha à mão ou tente de novo.");
  }
}

export async function gravar(importacao: unknown): Promise<Retorno<ResultadoImportacao>> {
  const ctx = await moderador();
  if (!ctx) return SO_MODERADOR;
  const lida = importacaoSchema.safeParse(importacao);
  if (!lida.success) return { ok: false, erro: "Dados incompletos. Confira a prova de origem e os itens." };
  try {
    const { banca, opcoes } = await dadosDaImportacao(ctx.db, ctx.cargo.id);
    const lote = montarLoteReal({
      banca,
      importadoPor: ctx.user.email ?? ctx.user.id,
      importacao: lida.data,
      canonicosPermitidos: new Set(opcoes.map((o) => o.canonico)),
    });
    return { ok: true, dados: await importarItensReais(criarClienteServico(), lote) };
  } catch (e) {
    return falha(e, "Não foi possível gravar. Nada foi importado; tente de novo.");
  }
}

// `vez` conta os envios: o formulário usa como chave para remontar com os valores certos.
export type EstadoTema =
  | { vez: number; tipo: "gravado" | "duplicado"; enunciado: string }
  | { vez: number; tipo: "erro"; erros: string[]; campos: CamposTema }
  | null;

// Tema real de discursiva: validado aqui (inclusive a soma dos pontos) e gravado pela função do banco,
// que só a chave de serviço executa. O mesmo enunciado não entra duas vezes.
export async function importarTema(anterior: EstadoTema, formData: FormData): Promise<EstadoTema> {
  const vez = (anterior?.vez ?? 0) + 1;
  const ctx = await moderador();
  const campos: CamposTema = {
    provaOrigem: String(formData.get("provaOrigem") ?? ""),
    enunciado: String(formData.get("enunciado") ?? ""),
    textosApoio: String(formData.get("textosApoio") ?? ""),
    padrao: String(formData.get("padrao") ?? ""),
    expectativas: String(formData.get("expectativas") ?? ""),
  };
  if (!ctx) return { vez, tipo: "erro", erros: [SO_MODERADOR.erro], campos };
  try {
    const config = await configDaDiscursiva(ctx.db, ctx.cargo.concursoSlug);
    if (!config) return { vez, tipo: "erro", erros: ["Este concurso não tem prova discursiva."], campos };
    const lido = lerTemaReal(campos, config.pontuacaoMaxima);
    if (!lido.ok) return { vez, tipo: "erro", erros: lido.erros, campos };
    const { data, error } = await criarClienteServico().rpc("discursiva_importar_temas", {
      p_lote: { concurso: ctx.cargo.concursoSlug, prova_origem: lido.provaOrigem, temas: [lido.tema] } as unknown as Json,
    });
    if (error) throw new Error(error.message);
    const r = data as { gravados: number };
    return { vez, tipo: r.gravados === 1 ? "gravado" : "duplicado", enunciado: lido.tema.enunciado };
  } catch (e) {
    console.error(e);
    return { vez, tipo: "erro", erros: ["Não foi possível gravar o tema. Tente de novo."], campos };
  }
}

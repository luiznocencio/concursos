import { calcularPrioridades } from "@/core";
import { criarRepositorioEstudo } from "@/db/repositorios/estudo";
import { tabelaDesempenho } from "@/estudo/painel";
import { Aviso } from "@/components/aviso";
import { botao, textoApoio, titulo } from "@/components/ui";
import { aproveitamento, plural } from "@/lib/formato";
import { treinarTopicos } from "../acoes";
import { exigirCargo } from "../contexto";
import { BotaoEnviar } from "@/components/botao-enviar";
import { GeracaoDeItens } from "@/components/geracao-itens";
import { meusPedidosIa } from "@/db/repositorios/pedidos";

export default async function Treinar({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string; pedidos?: string }>;
}) {
  const { aviso, pedidos } = await searchParams;
  const { db, cargo } = await exigirCargo();
  const repo = criarRepositorioEstudo(db);
  const agora = new Date();
  const [estrutura, candidatos, historico, pedidosIa] = await Promise.all([
    repo.estrutura(cargo.id),
    repo.candidatos(cargo.id),
    repo.historico(cargo.id),
    meusPedidosIa(db),
  ]);
  const tabela = tabelaDesempenho(estrutura.topicosAlvo, calcularPrioridades(estrutura.topicosAlvo, historico, agora), historico, agora);
  const naoVistos = new Map<string, number>();
  for (const i of candidatos) {
    if (i.visto) continue;
    for (const c of i.canonicos) naoVistos.set(c, (naoVistos.get(c) ?? 0) + 1);
  }

  return (
    <>
      <Aviso codigo={aviso} pedidos={pedidos} />
      <GeracaoDeItens pedidos={pedidosIa} />
      <h1 className={titulo.pagina}>Treinar por tópico</h1>
      <p className={`${textoApoio} mt-3 max-w-[60ch]`}>
        Escolha os tópicos do edital. Os itens que você ainda não viu vêm primeiro; quando faltam, pedimos mais à IA.
      </p>

      <form action={treinarTopicos} className="mt-8 flex flex-col gap-6">
        <div className="divide-y divide-borda rounded-xl border border-borda bg-superficie">
          {tabela.map((d) => (
            <details key={d.disciplina} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center gap-4 py-4">
                <span className="flex-1 font-semibold">{estrutura.disciplinas[d.disciplina]}</span>
                <span className="text-sm text-pedra">{plural(d.topicos.length, "tópico", "tópicos")}</span>
              </summary>
              <ul className="flex flex-col pb-4">
                {d.topicos.map((t) => (
                  <li key={`${t.disciplina}:${t.codigo}`}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-realce">
                      <input type="checkbox" name="canonico" value={t.canonico} className="mt-1 size-4 accent-azul" />
                      <span className="flex-1">
                        <span className="text-pedra">{t.codigo}</span> {t.titulo}
                        <span className="block text-sm text-pedra">
                          {t.n === 0 ? "nunca praticado" : `${aproveitamento(t.aproveitamento)} em ${plural(t.n, "resposta", "respostas")}`}
                          {" · "}
                          {plural(naoVistos.get(t.canonico) ?? 0, "item novo", "itens novos")}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="sticky bottom-4 flex flex-wrap items-center gap-4 self-start rounded-xl border border-borda bg-superficie px-4 py-3">
          <label htmlFor="total" className="text-sm font-medium">
            Quantidade
          </label>
          <select id="total" name="total" defaultValue="10" className="rounded-lg border border-borda-campo bg-superficie px-3 py-2 text-sm">
            <option value="10">10 itens</option>
            <option value="20">20 itens</option>
            <option value="30">30 itens</option>
          </select>
          <BotaoEnviar pendente="Montando o treino…" className={botao.primario}>
            Começar treino
          </BotaoEnviar>
        </div>
      </form>
    </>
  );
}

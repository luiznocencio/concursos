import { criarClienteServidor } from "@/db/supabase/server";
import { sair } from "./actions";

export default async function Inicio() {
  const supabase = await criarClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: concursos } = await supabase
    .from("concursos")
    .select("slug, nome, data_prova, cargos(slug, nome)")
    .order("nome");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <header className="flex items-center justify-between">
        <p className="text-sm text-black/60">{user?.email}</p>
        <form action={sair}>
          <button type="submit" className="rounded-lg px-3 py-1.5 text-sm text-black/90 hover:bg-black/5">
            Sair
          </button>
        </form>
      </header>
      <h1 className="text-[40px] font-semibold leading-tight tracking-tight">Seus concursos</h1>
      {(concursos ?? []).map((c) => (
        <section key={c.slug} className="rounded-xl border border-black/10 bg-white p-6">
          <h2 className="text-[22px] font-bold tracking-tight">{c.nome}</h2>
          <p className="text-[#615d59]">Prova em {new Date(`${c.data_prova}T12:00:00`).toLocaleDateString("pt-BR")}</p>
          <ul className="mt-3 flex gap-2">
            {c.cargos.map((cargo) => (
              <li key={cargo.slug} className="rounded-full bg-[#e6f3fe] px-3 py-1 text-sm text-[#0075de]">
                {cargo.nome}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

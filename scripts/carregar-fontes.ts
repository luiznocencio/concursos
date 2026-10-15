// Carrega as leis de editais/<slug>/fontes/ no Supabase (tabelas fontes e fonte_dispositivos).
// Uso: npm run fontes:carregar -- <slug-do-concurso>   (precisa de SUPABASE_SECRET_KEY no .env.local)
import { readFileSync } from "node:fs";
import { dividirEmArtigos } from "../src/core/fontes/dispositivos";
import { parseManifestoFontes } from "../src/core/fontes/manifesto";
import { criarClienteServico } from "../src/db/supabase/servico";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("uso: npm run fontes:carregar -- <slug-do-concurso>");
  const pasta = `editais/${slug}/fontes`;
  const manifesto = parseManifestoFontes(readFileSync(`${pasta}/fontes.yaml`, "utf8"));
  const db = criarClienteServico();

  for (const f of manifesto.fontes) {
    const dispositivos = dividirEmArtigos(readFileSync(`${pasta}/${f.arquivo}`, "utf8"));
    if (dispositivos.length === 0) throw new Error(`${f.arquivo}: nenhum artigo encontrado`);

    const { data: fonte, error } = await db
      .from("fontes")
      .upsert({ slug: f.slug, tipo: f.tipo, titulo: f.titulo, url_oficial: f.url_oficial, canonicos: f.canonicos }, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw new Error(`${f.slug}: ${error.message}`);

    const { error: eDel } = await db.from("fonte_dispositivos").delete().eq("fonte_id", fonte.id);
    if (eDel) throw new Error(`${f.slug}: ${eDel.message}`);
    const { error: eIns } = await db
      .from("fonte_dispositivos")
      .insert(dispositivos.map((d, ordem) => ({ fonte_id: fonte.id, referencia: d.referencia, texto: d.texto, ordem })));
    if (eIns) throw new Error(`${f.slug}: ${eIns.message}`);

    console.log(`${f.slug}: ${dispositivos.length} artigos`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

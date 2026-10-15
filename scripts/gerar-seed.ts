import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseEdital } from "../src/core/edital/parse";
import { sqlDoEdital } from "../src/db/seed/edital-sql";

const slug = process.argv[2];
if (!slug) {
  console.error("uso: npm run seed:gerar -- <slug-do-concurso>");
  process.exit(1);
}

const edital = parseEdital(readFileSync(`editais/${slug}/edital.yaml`, "utf8"));
mkdirSync("supabase/seed", { recursive: true });
writeFileSync(`supabase/seed/${slug}.sql`, sqlDoEdital(edital));
console.log(`supabase/seed/${slug}.sql gerado`);

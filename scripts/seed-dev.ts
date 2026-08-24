import { config } from "dotenv";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { SEED_SONGS } from "../src/data/seedSongs";

config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local. Veja .env.example e README > Setup local."
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { count, error: countError } = await supabase
    .from("songs")
    .select("id", { count: "exact", head: true })
    .in("source", ["original", "additional"]);

  if (countError) {
    console.error("Erro ao consultar catálogo existente:", countError.message);
    process.exit(1);
  }

  if ((count ?? 0) >= SEED_SONGS.length) {
    console.log(`Catálogo já tem ${count} músicas de seed — nada a fazer (idempotente).`);
    return;
  }

  const rows = SEED_SONGS.map((s) => ({
    title: s.title,
    artist: s.artist,
    version: null,
    key: null,
    capo: null,
    difficulty: s.difficulty,
    energy: s.energy,
    bpm: null,
    moments: s.moments,
    themes: s.themes,
    tags: s.tags,
    youtube_url: null,
    spotify_url: null,
    active: true,
    source: s.source,
  }));

  const { error: insertError, count: insertedCount } = await supabase
    .from("songs")
    .insert(rows, { count: "exact" });

  if (insertError) {
    console.error("Erro ao inserir catálogo de seed:", insertError.message);
    process.exit(1);
  }

  console.log(`${insertedCount ?? rows.length} músicas inseridas com sucesso.`);
}

main();

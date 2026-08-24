import { config } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseSongsCsv } from "../src/lib/csv/parseSongsCsv";
import { findPotentialDuplicates } from "../src/lib/catalog/dedupe";

config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const filePath = process.argv[2] ?? path.resolve(__dirname, "..", "data", "seed-songs.csv");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }

  const csvText = readFileSync(filePath, "utf-8");
  const { valid, invalid } = parseSongsCsv(csvText);
  console.log(`Lidas ${valid.length} linhas válidas e ${invalid.length} inválidas de ${filePath}`);

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: existingRows } = await supabase.from("songs").select("id, title, artist");
  const existing = (existingRows ?? []) as { id: string; title: string; artist: string | null }[];

  const toInsert: typeof valid = [];
  let duplicated = 0;

  for (const row of valid) {
    const matches = findPotentialDuplicates([{ title: row.title, artist: row.artist ?? null }], existing);
    if (matches.some((m) => m.exact)) {
      duplicated++;
      continue;
    }
    toInsert.push(row);
  }

  if (toInsert.length > 0) {
    const rows = toInsert.map((r) => ({
      title: r.title,
      artist: r.artist ?? null,
      version: r.version ?? null,
      key: r.key ?? null,
      capo: r.capo ?? null,
      difficulty: r.difficulty ?? null,
      energy: r.energy ?? null,
      bpm: r.bpm ?? null,
      moments: r.moments,
      themes: r.themes,
      tags: r.tags,
      youtube_url: r.youtube_url ?? null,
      source: "csv_import" as const,
    }));
    const { error } = await supabase.from("songs").insert(rows);
    if (error) {
      console.error("Erro ao inserir:", error.message);
      process.exit(1);
    }
  }

  console.log(`Importadas: ${toInsert.length} · Duplicadas (puladas): ${duplicated} · Inválidas: ${invalid.length}`);
  if (invalid.length > 0) {
    console.log("Linhas inválidas:", JSON.stringify(invalid.slice(0, 10), null, 2));
  }
}

main();

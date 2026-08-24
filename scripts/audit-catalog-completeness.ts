import { config } from "dotenv";
import path from "node:path";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { findPotentialDuplicates } from "../src/lib/catalog/dedupe";
import { calculateCompleteness } from "../src/lib/catalog/completeness";
import { songFromRow, type SongRow } from "../src/types/song";

config({ path: path.resolve(__dirname, "..", ".env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env.local.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data, error } = await supabase.from("songs").select("*").order("title");

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const songs = ((data ?? []) as SongRow[]).map(songFromRow);
  const withArtist = songs.filter((s) => s.artist);
  const withoutArtist = songs.filter((s) => !s.artist);
  const withYoutube = songs.filter((s) => s.youtubeUrl);
  const withoutYoutube = songs.filter((s) => !s.youtubeUrl);

  const rows = songs.map((s) => ({ ...s, completeness: calculateCompleteness(s) }));
  const buckets = {
    low: rows.filter((r) => r.completeness < 50),
    mid: rows.filter((r) => r.completeness >= 50 && r.completeness <= 80),
    high: rows.filter((r) => r.completeness > 80),
  };

  const duplicates = findPotentialDuplicates(songs.map((s) => ({ title: s.title, artist: s.artist })));

  const lines: string[] = [];
  lines.push("# Auditoria de completude do catálogo");
  lines.push("");
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Resumo");
  lines.push(`- Total de músicas: ${songs.length}`);
  lines.push(`- Com artista: ${withArtist.length} (${Math.round((withArtist.length / songs.length) * 100)}%)`);
  lines.push(`- Sem artista: ${withoutArtist.length}`);
  lines.push(`- Com link do YouTube: ${withYoutube.length}`);
  lines.push(`- Sem link do YouTube: ${withoutYoutube.length}`);
  lines.push(`- Possíveis duplicatas (título parecido): ${duplicates.length}`);
  lines.push("");
  lines.push("## Distribuição de completude");
  lines.push(`- <50%: ${buckets.low.length}`);
  lines.push(`- 50-80%: ${buckets.mid.length}`);
  lines.push(`- >80%: ${buckets.high.length}`);
  lines.push("");
  lines.push("## Músicas sem artista");
  for (const s of withoutArtist) lines.push(`- ${s.title}`);
  lines.push("");
  lines.push("## Duplicatas / títulos parecidos para revisão manual");
  if (duplicates.length === 0) {
    lines.push("Nenhuma.");
  } else {
    for (const d of duplicates) {
      lines.push(`- "${d.a.title}" (${d.a.artist ?? "sem artista"}) vs "${d.b.title}" (${d.b.artist ?? "sem artista"}) — ${d.exact ? "EXATA" : `${Math.round(d.similarity * 100)}%`}`);
    }
  }
  lines.push("");
  lines.push("## Completude por música (ordenado, menor primeiro)");
  for (const r of [...rows].sort((a, b) => a.completeness - b.completeness)) {
    lines.push(`- ${r.title}${r.artist ? ` — ${r.artist}` : ""}: ${r.completeness}%`);
  }

  const outPath = path.resolve(__dirname, "..", "data", "catalog-completeness-report.md");
  writeFileSync(outPath, lines.join("\n"), "utf-8");

  console.log(`Total: ${songs.length} | Com artista: ${withArtist.length} | Sem artista: ${withoutArtist.length}`);
  console.log(`Com YouTube: ${withYoutube.length} | Sem YouTube: ${withoutYoutube.length}`);
  console.log(`Duplicatas/parecidas: ${duplicates.length}`);
  console.log(`Completude: <50% = ${buckets.low.length} | 50-80% = ${buckets.mid.length} | >80% = ${buckets.high.length}`);
  console.log(`Relatório completo salvo em: ${outPath}`);
}

main();

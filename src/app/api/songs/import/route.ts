import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/apiGuards";
import { parseSongsCsv } from "@/lib/csv/parseSongsCsv";
import { findPotentialDuplicates } from "@/lib/catalog/dedupe";

/**
 * Importação de CSV do admin (seção 22). Nunca insere duplicata exata;
 * near-duplicates entram como "revisar", mas ainda são importadas —
 * a decisão final de mesclar/remover é do admin, não automática.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const csvText = await request.text();
  if (!csvText.trim()) {
    return NextResponse.json({ error: "Arquivo CSV vazio." }, { status: 400 });
  }

  const { valid, invalid } = parseSongsCsv(csvText);

  const supabase = createClient();
  const { data: existingRows, error: existingError } = await supabase.from("songs").select("id, title, artist");
  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  const existing = (existingRows ?? []) as { id: string; title: string; artist: string | null }[];

  const duplicated: { title: string; matchedExisting: string }[] = [];
  const reviewRecommended: { title: string; matchedExisting: string; similarity: number }[] = [];
  const toInsert: typeof valid = [];

  for (const row of valid) {
    const matches = findPotentialDuplicates([{ title: row.title, artist: row.artist ?? null }], existing);
    const exact = matches.find((m) => m.exact);
    if (exact) {
      duplicated.push({ title: row.title, matchedExisting: exact.b.title });
      continue;
    }
    const near = matches[0];
    if (near) {
      reviewRecommended.push({ title: row.title, matchedExisting: near.b.title, similarity: near.similarity });
    }
    toInsert.push(row);
  }

  let importedCount = 0;
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

    const { error: insertError, count } = await supabase.from("songs").insert(rows, { count: "exact" });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    importedCount = count ?? toInsert.length;
  }

  return NextResponse.json({
    imported: importedCount,
    duplicated,
    reviewRecommended,
    invalid,
    totalRows: valid.length + invalid.length,
  });
}

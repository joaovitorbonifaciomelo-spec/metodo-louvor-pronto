import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionInfo } from "@/lib/auth/session";
import { trackServer } from "@/lib/analytics/trackServer";
import { songFromRow, type SongRow } from "@/types/song";
import { calculateSongCompatibility } from "@/lib/recommendation/compatibility";
import { generateCompatibilityReasons } from "@/lib/recommendation/reasons";

/**
 * "Quais músicas combinam?" (seções 5-6). Determinístico — sem chamada a IA.
 */
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(20, Math.max(1, Number(searchParams.get("limit") ?? "5") || 5));

  const supabase = createClient();

  const { data: baseRow, error: baseError } = await supabase
    .from("songs")
    .select("*")
    .eq("id", params.id)
    .single();

  if (baseError || !baseRow) {
    return NextResponse.json({ error: "Música base não encontrada." }, { status: 404 });
  }

  const { data: catalogRows, error: catalogError } = await supabase
    .from("songs")
    .select("*")
    .eq("active", true)
    .neq("id", params.id)
    .limit(500);

  if (catalogError) {
    return NextResponse.json({ error: catalogError.message }, { status: 500 });
  }

  const base = songFromRow(baseRow as SongRow);
  const candidates = ((catalogRows ?? []) as SongRow[]).map(songFromRow);

  const results = candidates
    .map((candidate) => {
      const { score, breakdown } = calculateSongCompatibility(base, candidate);
      return {
        song: candidate,
        compatibility: score,
        reasons: generateCompatibilityReasons(base, candidate, breakdown),
      };
    })
    .sort((a, b) => b.compatibility - a.compatibility)
    .slice(0, limit);

  const { userId } = await getSessionInfo();
  await trackServer(supabase, "recommendation_generated", { songId: base.id, resultCount: results.length }, userId);

  return NextResponse.json({ base, results });
}

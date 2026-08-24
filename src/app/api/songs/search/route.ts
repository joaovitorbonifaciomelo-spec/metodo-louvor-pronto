import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionInfo } from "@/lib/auth/session";
import { trackServer } from "@/lib/analytics/trackServer";
import { songFromRow, type SongRow } from "@/types/song";

/**
 * Busca/autocomplete (seção 31). Público — inclusive para a experiência
 * pré-login da landing page (seção 25).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ songs: [] });
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("search_songs", { search_query: q, result_limit: 10 });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const songs = ((data ?? []) as SongRow[]).map(songFromRow);

  const { userId } = await getSessionInfo();
  await trackServer(supabase, "song_searched", { query: q, resultCount: songs.length }, userId);

  return NextResponse.json({ songs });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserIdOnly } from "@/lib/auth/session";
import { trackServer } from "@/lib/analytics/trackServer";
import { songFromRow, type SongRow } from "@/types/song";

/**
 * Busca/autocomplete (seção 31) — caminho mais quente do produto, precisa
 * ser rápido. Não bloqueia a resposta esperando analytics (fire-and-forget):
 * antes disso, cada busca pagava +2 round-trips ao Supabase (auth.getUser +
 * select em profiles, dentro de getSessionInfo) só para registrar o evento.
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

  void getUserIdOnly()
    .then((userId) => trackServer(supabase, "song_searched", { query: q, resultCount: songs.length }, userId))
    .catch(() => undefined);

  return NextResponse.json({ songs });
}

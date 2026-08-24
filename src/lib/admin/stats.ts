import type { SupabaseClient } from "@supabase/supabase-js";

export interface AdminStats {
  totalSongs: number;
  activeSongs: number;
  totalUsers: number;
  totalSetlists: number;
  pendingRequests: number;
  topSearches: { query: string; count: number }[];
  topRequests: { query: string; count: number }[];
  mostAddedSongs: { title: string; artist: string | null; count: number }[];
}

/** Agregações do dashboard admin (seção 23). Compartilhado entre a rota de API e a página. */
export async function getAdminStats(supabase: SupabaseClient): Promise<AdminStats> {
  const [{ count: totalSongs }, { count: activeSongs }, { count: totalUsers }, { count: totalSetlists }] =
    await Promise.all([
      supabase.from("songs").select("id", { count: "exact", head: true }),
      supabase.from("songs").select("id", { count: "exact", head: true }).eq("active", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("setlists").select("id", { count: "exact", head: true }),
    ]);

  const { data: searchEvents } = await supabase
    .from("analytics_events")
    .select("payload")
    .eq("event_name", "song_searched")
    .limit(5000);

  const searchCounts = new Map<string, number>();
  for (const row of searchEvents ?? []) {
    const query = String((row.payload as Record<string, unknown>)?.query ?? "").trim().toLowerCase();
    if (!query) continue;
    searchCounts.set(query, (searchCounts.get(query) ?? 0) + 1);
  }
  const topSearches = Array.from(searchCounts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { data: requestRows } = await supabase.from("song_requests").select("query, status").limit(5000);
  const requestCounts = new Map<string, number>();
  for (const row of requestRows ?? []) {
    const key = row.query.trim().toLowerCase();
    requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
  }
  const topRequests = Array.from(requestCounts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const { data: itemRows } = await supabase.from("setlist_items").select("song_id, songs(title, artist)").limit(5000);
  type SongJoinRow = {
    song_id: string;
    songs: { title: string; artist: string | null } | { title: string; artist: string | null }[] | null;
  };
  const songUsage = new Map<string, { title: string; artist: string | null; count: number }>();
  for (const row of (itemRows ?? []) as unknown as SongJoinRow[]) {
    const songInfo = Array.isArray(row.songs) ? row.songs[0] : row.songs;
    const key = row.song_id;
    const entry = songUsage.get(key) ?? { title: songInfo?.title ?? "—", artist: songInfo?.artist ?? null, count: 0 };
    entry.count += 1;
    songUsage.set(key, entry);
  }
  const mostAddedSongs = Array.from(songUsage.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSongs: totalSongs ?? 0,
    activeSongs: activeSongs ?? 0,
    totalUsers: totalUsers ?? 0,
    totalSetlists: totalSetlists ?? 0,
    pendingRequests: (requestRows ?? []).filter((r) => r.status === "pending").length,
    topSearches,
    topRequests,
    mostAddedSongs,
  };
}

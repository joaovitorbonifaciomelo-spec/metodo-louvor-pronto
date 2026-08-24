import type { SupabaseClient } from "@supabase/supabase-js";
import type { SetlistHistoryEntry } from "@/lib/recommendation/repetitionPenalty";

/**
 * Histórico de cultos do usuário, do mais recente para o mais antigo —
 * usado para penalizar repetição (seção 17). Ordenamos por created_at
 * como aproximação de "último culto"; suficiente para o MVP.
 */
export async function loadUserSetlistHistory(
  supabase: SupabaseClient,
  userId: string,
  limit = 20
): Promise<SetlistHistoryEntry[]> {
  const { data: setlists } = await supabase
    .from("setlists")
    .select("id, service_date, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (setlists ?? []) as { id: string; service_date: string | null; created_at: string }[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: items } = await supabase.from("setlist_items").select("setlist_id, song_id").in("setlist_id", ids);
  const itemRows = (items ?? []) as { setlist_id: string; song_id: string }[];

  const songIdsBySetlist = new Map<string, string[]>();
  for (const item of itemRows) {
    const list = songIdsBySetlist.get(item.setlist_id) ?? [];
    list.push(item.song_id);
    songIdsBySetlist.set(item.setlist_id, list);
  }

  return rows.map((row) => ({
    serviceDate: row.service_date,
    createdAt: row.created_at,
    songIds: songIdsBySetlist.get(row.id) ?? [],
  }));
}

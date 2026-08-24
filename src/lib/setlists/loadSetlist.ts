import type { SupabaseClient } from "@supabase/supabase-js";
import { songFromRow, type SongRow } from "@/types/song";
import type { Setlist, SetlistItemWithSong } from "@/types/setlist";
import type { SetlistRow, SetlistItemRow } from "@/types/database";

export function setlistFromRow(row: SetlistRow): Setlist {
  return {
    id: row.id,
    userId: row.user_id,
    churchId: row.church_id,
    name: row.name,
    serviceType: row.service_type as Setlist["serviceType"],
    theme: row.theme,
    serviceDate: row.service_date,
    teamLevel: row.team_level as Setlist["teamLevel"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface SetlistWithItems {
  setlist: Setlist;
  shareSlug: string | null;
  items: SetlistItemWithSong[];
}

/** Carrega um setlist com seus itens + músicas relacionadas em uma única leitura. */
export async function loadSetlistWithItems(
  supabase: SupabaseClient,
  setlistId: string
): Promise<SetlistWithItems | null> {
  const { data: setlistRow, error: setlistError } = await supabase
    .from("setlists")
    .select("*")
    .eq("id", setlistId)
    .single();

  if (setlistError || !setlistRow) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from("setlist_items")
    .select("*, songs(*)")
    .eq("setlist_id", setlistId)
    .order("position", { ascending: true });

  if (itemsError) return null;

  const items: SetlistItemWithSong[] = (itemRows ?? []).map((row: SetlistItemRow & { songs: SongRow }) => ({
    id: row.id,
    setlistId: row.setlist_id,
    songId: row.song_id,
    position: row.position,
    moment: row.moment,
    selectedKey: row.selected_key,
    notes: row.notes,
    referenceUrl: row.reference_url,
    locked: row.locked,
    song: songFromRow(row.songs),
  }));

  return { setlist: setlistFromRow(setlistRow as SetlistRow), shareSlug: (setlistRow as SetlistRow).share_slug, items };
}

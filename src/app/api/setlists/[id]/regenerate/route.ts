import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/apiGuards";
import { loadSetlistWithItems } from "@/lib/setlists/loadSetlist";
import { loadUserSetlistHistory } from "@/lib/setlists/loadHistory";
import { generateSetlist } from "@/lib/recommendation/generateSetlist";
import { songFromRow, type SongRow } from "@/types/song";

/**
 * "Gerar outra opção" (seção 16). Músicas travadas (locked) permanecem;
 * as demais são substituídas por uma nova sugestão compatível.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const current = await loadSetlistWithItems(supabase, params.id);
  if (!current) return NextResponse.json({ error: "Culto não encontrado." }, { status: 404 });
  if (current.setlist.userId !== guard.userId) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { data: songRows, error } = await supabase.from("songs").select("*").eq("active", true).limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const songs = ((songRows ?? []) as SongRow[]).map(songFromRow);

  const history = await loadUserSetlistHistory(supabase, guard.userId);

  const structure = current.items.map((item) => ({ moment: item.moment, count: 1 }));
  const lockedItems = current.items
    .filter((item) => item.locked)
    .map((item) => ({ position: item.position, songId: item.songId }));

  const [variant] = generateSetlist({
    songs,
    structure,
    teamLevel: current.setlist.teamLevel,
    theme: current.setlist.theme,
    history,
    lockedItems,
    variantCount: 1,
  });

  if (!variant) return NextResponse.json({ error: "Não foi possível gerar uma nova opção." }, { status: 500 });

  for (const generated of variant.items) {
    const original = current.items.find((i) => i.position === generated.position);
    if (!original || original.locked) continue;
    await supabase
      .from("setlist_items")
      .update({ song_id: generated.song.id })
      .eq("id", original.id)
      .eq("setlist_id", params.id);
  }

  const updated = await loadSetlistWithItems(supabase, params.id);
  return NextResponse.json(updated);
}

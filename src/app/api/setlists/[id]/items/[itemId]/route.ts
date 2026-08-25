import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAccess } from "@/lib/auth/apiGuards";
import { trackServer } from "@/lib/analytics/trackServer";

const updateSchema = z.object({
  songId: z.string().uuid().optional(),
  selectedKey: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  referenceUrl: z.string().url().nullable().optional(),
  locked: z.boolean().optional(),
});

/** Trocar música, travar/destravar, editar tom/observação/referência (seção 16). */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { songId, selectedKey, notes, referenceUrl, locked } = parsed.data;
  const update: Record<string, unknown> = {};
  if (songId !== undefined) update.song_id = songId;
  if (selectedKey !== undefined) update.selected_key = selectedKey;
  if (notes !== undefined) update.notes = notes;
  if (referenceUrl !== undefined) update.reference_url = referenceUrl;
  if (locked !== undefined) update.locked = locked;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("setlist_items")
    .update(update)
    .eq("id", params.itemId)
    .eq("setlist_id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao atualizar item." }, { status: 500 });
  }

  return NextResponse.json({ item: data });
}

/** Remover música do repertório (seção 16). */
export async function DELETE(_request: Request, { params }: { params: { id: string; itemId: string } }) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const { error } = await supabase.from("setlist_items").delete().eq("id", params.itemId).eq("setlist_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await trackServer(supabase, "song_removed", { setlistId: params.id, itemId: params.itemId }, guard.userId);
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAccess } from "@/lib/auth/apiGuards";
import { trackServer } from "@/lib/analytics/trackServer";
import { MOMENTS } from "@/types/song";

const addItemSchema = z.object({
  songId: z.string().uuid(),
  moment: z.enum(MOMENTS),
  selectedKey: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  referenceUrl: z.string().url().nullable().optional(),
});

/** Adiciona uma música ao final do repertório (seção 16 "adicionar outra"). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = addItemSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const supabase = createClient();
  const { data: existingItems } = await supabase
    .from("setlist_items")
    .select("position")
    .eq("setlist_id", params.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = ((existingItems ?? [])[0]?.position ?? 0) + 1;

  const { data, error } = await supabase
    .from("setlist_items")
    .insert({
      setlist_id: params.id,
      song_id: parsed.data.songId,
      position: nextPosition,
      moment: parsed.data.moment,
      selected_key: parsed.data.selectedKey ?? null,
      notes: parsed.data.notes ?? null,
      reference_url: parsed.data.referenceUrl ?? null,
      locked: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao adicionar música." }, { status: 500 });
  }

  await trackServer(supabase, "song_added", { setlistId: params.id, songId: parsed.data.songId }, guard.userId);
  return NextResponse.json({ item: data }, { status: 201 });
}

const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), position: z.number().int().min(1) })).min(1),
});

/** Reordenar músicas do repertório (seção 16 "mover posição"). */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const supabase = createClient();

  // Passo intermediário evita colisão da constraint unique(setlist_id, position).
  for (const [index, item] of parsed.data.items.entries()) {
    await supabase
      .from("setlist_items")
      .update({ position: -(index + 1) })
      .eq("id", item.id)
      .eq("setlist_id", params.id);
  }
  for (const item of parsed.data.items) {
    await supabase.from("setlist_items").update({ position: item.position }).eq("id", item.id).eq("setlist_id", params.id);
  }

  return NextResponse.json({ ok: true });
}

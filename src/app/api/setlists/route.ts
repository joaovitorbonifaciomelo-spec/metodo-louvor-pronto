import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAccess } from "@/lib/auth/apiGuards";
import { trackServer } from "@/lib/analytics/trackServer";
import { setlistFromRow } from "@/lib/setlists/loadSetlist";
import { SERVICE_TYPES, TEAM_LEVELS } from "@/types/setlist";
import { MOMENTS } from "@/types/song";
import type { SetlistRow } from "@/types/database";

/** "Meus Cultos" (seção 18): lista os repertórios salvos do usuário. */
export async function GET() {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("setlists")
    .select("*, setlist_items(count)")
    .eq("user_id", guard.userId)
    .order("service_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const setlists = (data ?? []).map((row) => ({
    ...setlistFromRow(row as SetlistRow),
    itemCount: (row as unknown as { setlist_items: { count: number }[] }).setlist_items?.[0]?.count ?? 0,
  }));

  return NextResponse.json({ setlists });
}

const itemInputSchema = z.object({
  songId: z.string().uuid(),
  position: z.number().int().min(1),
  moment: z.enum(MOMENTS),
  selectedKey: z.string().trim().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  referenceUrl: z.string().url().nullable().optional(),
  locked: z.boolean().optional().default(false),
});

const createSetlistSchema = z.object({
  name: z.string().trim().min(1).max(120),
  serviceType: z.enum(SERVICE_TYPES),
  theme: z.string().trim().max(200).nullable().optional(),
  serviceDate: z.string().trim().nullable().optional(),
  teamLevel: z.enum(TEAM_LEVELS),
  items: z.array(itemInputSchema).min(1).max(10),
});

/** Salva um repertório escolhido/editado pelo usuário (seções 15-16). */
export async function POST(request: Request) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = createSetlistSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const supabase = createClient();
  const { name, serviceType, theme, serviceDate, teamLevel, items } = parsed.data;

  const { data: setlistRow, error: setlistError } = await supabase
    .from("setlists")
    .insert({
      user_id: guard.userId,
      name,
      service_type: serviceType,
      theme: theme ?? null,
      service_date: serviceDate ?? null,
      team_level: teamLevel,
    })
    .select("*")
    .single();

  if (setlistError || !setlistRow) {
    return NextResponse.json({ error: setlistError?.message ?? "Falha ao criar culto." }, { status: 500 });
  }

  const setlistId = (setlistRow as SetlistRow).id;
  const itemRows = items.map((item) => ({
    setlist_id: setlistId,
    song_id: item.songId,
    position: item.position,
    moment: item.moment,
    selected_key: item.selectedKey ?? null,
    notes: item.notes ?? null,
    reference_url: item.referenceUrl ?? null,
    locked: item.locked ?? false,
  }));

  const { error: itemsError } = await supabase.from("setlist_items").insert(itemRows);
  if (itemsError) {
    await supabase.from("setlists").delete().eq("id", setlistId);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  await trackServer(supabase, "setlist_created", { setlistId, songCount: items.length }, guard.userId);

  return NextResponse.json({ setlist: setlistFromRow(setlistRow as SetlistRow) }, { status: 201 });
}

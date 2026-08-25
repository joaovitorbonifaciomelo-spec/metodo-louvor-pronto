import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireActiveAccess } from "@/lib/auth/apiGuards";
import { songFromRow, type SongRow } from "@/types/song";
import { generateSetlist } from "@/lib/recommendation/generateSetlist";
import { loadUserSetlistHistory } from "@/lib/setlists/loadHistory";
import { TEAM_LEVELS } from "@/types/setlist";
import { MOMENTS } from "@/types/song";

const bodySchema = z.object({
  teamLevel: z.enum(TEAM_LEVELS),
  structure: z
    .array(z.object({ moment: z.enum(MOMENTS), count: z.number().int().min(1).max(10) }))
    .min(1)
    .max(10),
  theme: z.string().trim().max(200).nullable().optional(),
  mandatorySongId: z.string().uuid().nullable().optional(),
  variantCount: z.number().int().min(1).max(3).optional().default(2),
  lockedItems: z.array(z.object({ position: z.number().int().min(1), songId: z.string().uuid() })).optional(),
});

/** Gera 2-3 propostas de repertório (seção 15). Não persiste nada ainda. */
export async function POST(request: Request) {
  const guard = await requireActiveAccess();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const totalSongs = parsed.data.structure.reduce((sum, slot) => sum + slot.count, 0);
  if (totalSongs > 10) {
    return NextResponse.json({ error: "O repertório pode ter no máximo 10 músicas." }, { status: 400 });
  }

  const supabase = createClient();
  const [{ data: songRows, error }, history] = await Promise.all([
    supabase.from("songs").select("*").eq("active", true).limit(1000),
    loadUserSetlistHistory(supabase, guard.userId),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const songs = ((songRows ?? []) as SongRow[]).map(songFromRow);

  const variants = generateSetlist({
    songs,
    structure: parsed.data.structure,
    teamLevel: parsed.data.teamLevel,
    theme: parsed.data.theme,
    mandatorySongId: parsed.data.mandatorySongId,
    history,
    lockedItems: parsed.data.lockedItems,
    variantCount: parsed.data.variantCount,
  });

  return NextResponse.json({ variants });
}

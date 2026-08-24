import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/apiGuards";
import { songFromRow, type SongRow } from "@/types/song";
import { DIFFICULTIES, MOMENTS_ENUM, THEMES_FREEFORM } from "@/lib/validation/songSchemas";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase.from("songs").select("*").eq("id", params.id).single();

  if (error || !data) {
    return NextResponse.json({ error: "Música não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ song: songFromRow(data as SongRow) });
}

const updateSchema = z.object({
  title: z.string().trim().min(1).optional(),
  artist: z.string().trim().nullable().optional(),
  version: z.string().trim().nullable().optional(),
  key: z.string().trim().nullable().optional(),
  capo: z.number().int().min(0).max(12).nullable().optional(),
  difficulty: z.enum(DIFFICULTIES).nullable().optional(),
  energy: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional(),
  bpm: z.number().int().min(40).max(300).nullable().optional(),
  moments: z.array(z.enum(MOMENTS_ENUM)).optional(),
  themes: z.array(THEMES_FREEFORM).optional(),
  tags: z.array(z.string()).optional(),
  youtubeUrl: z.string().url().nullable().optional(),
  spotifyUrl: z.string().url().nullable().optional(),
  active: z.boolean().optional(),
  reviewRequired: z.boolean().optional(),
  youtubeStatus: z.enum(["pending", "found", "review", "not_found", "confirmed"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { youtubeUrl, spotifyUrl, reviewRequired, youtubeStatus, ...rest } = parsed.data;
  const update: Record<string, unknown> = { ...rest };
  if (youtubeUrl !== undefined) update.youtube_url = youtubeUrl;
  if (spotifyUrl !== undefined) update.spotify_url = spotifyUrl;
  if (reviewRequired !== undefined) update.review_required = reviewRequired;
  if (youtubeStatus !== undefined) update.youtube_status = youtubeStatus;

  const supabase = createClient();
  const { data, error } = await supabase.from("songs").update(update).eq("id", params.id).select("*").single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao atualizar." }, { status: 500 });
  }

  return NextResponse.json({ song: songFromRow(data as SongRow) });
}

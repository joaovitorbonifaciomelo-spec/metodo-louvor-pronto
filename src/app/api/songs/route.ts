import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/apiGuards";
import { songFromRow, type SongRow } from "@/types/song";
import { createSongSchema } from "@/lib/validation/songSchemas";

/** Listagem administrativa com busca/filtro (seção 23). */
export async function GET(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const activeParam = searchParams.get("active");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = 25;

  const supabase = createClient();
  let query = supabase.from("songs").select("*", { count: "exact" }).order("title", { ascending: true });

  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
  if (activeParam === "true") query = query.eq("active", true);
  if (activeParam === "false") query = query.eq("active", false);

  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    songs: ((data ?? []) as SongRow[]).map(songFromRow),
    total: count ?? 0,
    page,
    pageSize,
  });
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const json = await request.json().catch(() => null);
  const parsed = createSongSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { youtubeUrl, spotifyUrl, ...rest } = parsed.data;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("songs")
    .insert({ ...rest, youtube_url: youtubeUrl ?? null, spotify_url: spotifyUrl ?? null, source: "manual" })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao criar música." }, { status: 500 });
  }

  return NextResponse.json({ song: songFromRow(data as SongRow) }, { status: 201 });
}

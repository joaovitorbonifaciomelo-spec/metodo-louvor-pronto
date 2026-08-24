import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { songFromRow, type SongRow } from "@/types/song";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";

export default async function AdminMusicasPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const supabase = createClient();

  let query = supabase.from("songs").select("*").order("title", { ascending: true }).limit(100);
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);

  const { data } = await query;
  const songs = ((data ?? []) as SongRow[]).map(songFromRow);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-base-50">Músicas ({songs.length})</h1>
        <Link href="/admin/musicas/nova" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90">
          Nova música
        </Link>
      </div>

      <form className="max-w-sm">
        <Input name="q" defaultValue={q} placeholder="Buscar por título ou artista…" />
      </form>

      <div className="flex flex-col gap-2">
        {songs.map((song) => (
          <Card key={song.id} className="flex items-center justify-between gap-3">
            <div>
              <Link href={`/admin/musicas/${song.id}`} className="font-medium text-base-100 hover:text-accent">
                {song.title}
              </Link>
              <p className="text-xs text-base-400">
                {song.artist ?? "sem artista"} · {song.moments.join(", ") || "sem momento"}
              </p>
            </div>
            <ToggleActiveButton songId={song.id} active={song.active} />
          </Card>
        ))}
      </div>
    </div>
  );
}

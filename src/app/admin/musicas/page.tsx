import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { songFromRow, type SongRow } from "@/types/song";
import { calculateCompleteness } from "@/lib/catalog/completeness";
import { Badge, Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { ToggleActiveButton } from "@/components/admin/toggle-active-button";
import { cn } from "@/lib/utils";

function completenessTone(pct: number): "accent" | "neutral" | "warning" {
  if (pct > 80) return "accent";
  if (pct >= 50) return "neutral";
  return "warning";
}

export default async function AdminMusicasPage({
  searchParams,
}: {
  searchParams: { q?: string; review?: string; youtube?: string };
}) {
  const q = searchParams.q?.trim();
  const reviewOnly = searchParams.review === "1";
  const youtubeFilter = searchParams.youtube ?? "";
  const supabase = createClient();

  let query = supabase.from("songs").select("*").order("title", { ascending: true }).limit(300);
  if (q) query = query.or(`title.ilike.%${q}%,artist.ilike.%${q}%`);
  if (reviewOnly) query = query.eq("review_required", true);
  if (youtubeFilter) query = query.eq("youtube_status", youtubeFilter);

  const { data } = await query;
  const songs = ((data ?? []) as SongRow[]).map(songFromRow);
  const reviewCount = songs.filter((s) => s.reviewRequired).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-base-50">Músicas ({songs.length})</h1>
        <Link href="/admin/musicas/nova" className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg hover:bg-accent/90">
          Nova música
        </Link>
      </div>

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input name="q" defaultValue={q} placeholder="Buscar por título ou artista…" className="sm:max-w-sm" />
        <Select name="review" defaultValue={reviewOnly ? "1" : ""} className="sm:w-56">
          <option value="">Todas as músicas</option>
          <option value="1">Precisa de revisão {!reviewOnly ? "" : `(${reviewCount})`}</option>
        </Select>
        <Select name="youtube" defaultValue={youtubeFilter} className="sm:w-56">
          <option value="">YouTube: qualquer status</option>
          <option value="pending">YouTube: pendente</option>
          <option value="review">YouTube: precisa revisão</option>
          <option value="found">YouTube: encontrado</option>
          <option value="not_found">YouTube: não encontrado</option>
        </Select>
        <button type="submit" className="min-h-[44px] rounded-xl bg-base-800 px-4 text-sm text-base-200 hover:bg-base-700">
          Filtrar
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {songs.map((song) => {
          const completeness = calculateCompleteness(song);
          return (
            <Card key={song.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/musicas/${song.id}`} className="truncate font-medium text-base-100 hover:text-accent">
                    {song.title}
                  </Link>
                  {song.reviewRequired && <Badge tone="warning">revisar</Badge>}
                  {song.youtubeStatus === "review" && <Badge tone="warning">YouTube: revisar</Badge>}
                  <Badge tone={completenessTone(completeness)}>{completeness}% completa</Badge>
                </div>
                <p className={cn("text-xs", song.artist ? "text-base-400" : "text-amber-400/80")}>
                  {song.artist ?? "sem artista"} · {song.moments.join(", ") || "sem momento"}
                </p>
              </div>
              <ToggleActiveButton songId={song.id} active={song.active} />
            </Card>
          );
        })}

        {songs.length === 0 && (
          <Card className="text-center text-sm text-base-400">Nenhuma música encontrada com esse filtro.</Card>
        )}
      </div>
    </div>
  );
}

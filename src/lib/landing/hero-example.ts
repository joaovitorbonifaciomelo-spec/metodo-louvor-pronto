import { createClient } from "@/lib/supabase/server";
import { calculateSongCompatibility } from "@/lib/recommendation/compatibility";
import { generateCompatibilityReasons } from "@/lib/recommendation/reasons";
import { songFromRow, type Song, type SongRow } from "@/types/song";
import type { CompatibilityReason } from "@/lib/recommendation/reasons";

export interface HeroExamplePair {
  base: Song;
  match: Song;
  compatibility: number;
  reasons: CompatibilityReason[];
}

/**
 * Busca um par real do catálogo para ilustrar a página de vendas (hero e
 * seção de medleys) usando o mesmo motor de compatibilidade do produto —
 * nunca um exemplo inventado. Retorna null quando o catálogo público ainda
 * não tem músicas suficientes; as seções que chamam isto devem lidar com
 * esse caso sem quebrar o layout.
 */
export async function getHeroExamplePair(): Promise<HeroExamplePair | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("songs")
    .select("*")
    .eq("active", true)
    .order("title", { ascending: true })
    .limit(30);

  const songs = ((data ?? []) as SongRow[]).map(songFromRow);
  if (songs.length < 2) return null;

  const base = songs[0];
  if (!base) return null;
  const candidates = songs.slice(1);
  const best = candidates
    .map((candidate) => {
      const { score, breakdown } = calculateSongCompatibility(base, candidate);
      return { candidate, score, breakdown };
    })
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return null;

  return {
    base,
    match: best.candidate,
    compatibility: best.score,
    reasons: generateCompatibilityReasons(base, best.candidate, best.breakdown),
  };
}

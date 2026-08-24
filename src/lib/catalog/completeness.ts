import type { Song } from "@/types/song";

/** Pesos de completude do catálogo (seção 14 do briefing de UX/performance). */
const FIELDS: { check: (s: Song) => boolean; weight: number }[] = [
  { check: (s) => Boolean(s.artist), weight: 15 },
  { check: (s) => Boolean(s.key), weight: 15 },
  { check: (s) => s.capo !== null, weight: 5 },
  { check: (s) => s.bpm !== null, weight: 10 },
  { check: (s) => s.energy !== null, weight: 15 },
  { check: (s) => Boolean(s.difficulty), weight: 10 },
  { check: (s) => s.moments.length > 0, weight: 10 },
  { check: (s) => s.themes.length > 0, weight: 10 },
  { check: (s) => Boolean(s.youtubeUrl), weight: 10 },
];
const TOTAL_WEIGHT = FIELDS.reduce((sum, f) => sum + f.weight, 0);

/** Percentual de completude de metadados de uma música (0-100). */
export function calculateCompleteness(song: Song): number {
  const score = FIELDS.reduce((sum, f) => sum + (f.check(song) ? f.weight : 0), 0);
  return Math.round((score / TOTAL_WEIGHT) * 100);
}

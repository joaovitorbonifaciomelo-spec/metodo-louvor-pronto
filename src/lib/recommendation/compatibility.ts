import type { Difficulty, EnergyLevel, Song } from "@/types/song";
import { calculateKeyCompatibility, type KeyCompatibilityResult } from "./keyCompatibility";
import { COMPATIBILITY_WEIGHTS } from "./weights";

const MOMENT_FLOW_ORDER = [
  "Abertura",
  "Celebração",
  "Adoração",
  "Ministração",
  "Ceia",
  "Apelo",
  "Oferta",
  "Encerramento",
] as const;

const DIFFICULTY_RANK: Record<Difficulty, number> = {
  iniciante: 0,
  intermediaria: 1,
  avancada: 2,
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function jaccard(a: string[], b: string[]): { ratio: number; shared: string[] } {
  if (a.length === 0 || b.length === 0) return { ratio: 0.4, shared: [] };
  const normA = a.map(normalize);
  const normB = new Set(b.map(normalize));
  const shared = a.filter((t) => normB.has(normalize(t)));
  const union = new Set([...normA, ...b.map(normalize)]);
  return { ratio: union.size === 0 ? 0 : shared.length / union.size, shared };
}

function momentDistance(momentsA: string[], momentsB: string[]): { matched: boolean; adjacent: boolean; shared: string[] } {
  const shared = momentsA.filter((m) => momentsB.includes(m));
  if (shared.length > 0) return { matched: true, adjacent: false, shared };

  let minDistance = Infinity;
  for (const a of momentsA) {
    const idxA = MOMENT_FLOW_ORDER.indexOf(a as (typeof MOMENT_FLOW_ORDER)[number]);
    if (idxA === -1) continue;
    for (const b of momentsB) {
      const idxB = MOMENT_FLOW_ORDER.indexOf(b as (typeof MOMENT_FLOW_ORDER)[number]);
      if (idxB === -1) continue;
      minDistance = Math.min(minDistance, Math.abs(idxA - idxB));
    }
  }
  return { matched: false, adjacent: minDistance === 1, shared: [] };
}

function energyScore(a: EnergyLevel | null, b: EnergyLevel | null): { ratio: number; diff: number | null } {
  if (a === null || b === null) return { ratio: 0.5, diff: null };
  const diff = Math.abs(a - b);
  const ratio = diff === 0 ? 1 : diff === 1 ? 0.7 : diff === 2 ? 0.4 : 0.1;
  return { ratio, diff };
}

function difficultyScore(
  a: Difficulty | null,
  b: Difficulty | null
): { ratio: number; relation: "same" | "adjacent" | "far" | "unknown" } {
  if (!a || !b) return { ratio: 0.5, relation: "unknown" };
  if (a === b) return { ratio: 1, relation: "same" };
  const diff = Math.abs(DIFFICULTY_RANK[a] - DIFFICULTY_RANK[b]);
  return diff === 1 ? { ratio: 0.6, relation: "adjacent" } : { ratio: 0.2, relation: "far" };
}

function capoScore(a: number | null, b: number | null): { ratio: number; diff: number | null } {
  if (a === null || b === null) return { ratio: 0.5, diff: null };
  const diff = Math.abs(a - b);
  const ratio = diff === 0 ? 1 : diff <= 1 ? 0.8 : diff <= 2 ? 0.6 : diff <= 3 ? 0.4 : 0.2;
  return { ratio, diff };
}

export interface CompatibilityBreakdown {
  theme: { ratio: number; shared: string[]; weight: number; points: number };
  moment: { matched: boolean; adjacent: boolean; shared: string[]; weight: number; points: number };
  energy: { ratio: number; diff: number | null; weight: number; points: number };
  key: KeyCompatibilityResult & { weight: number; points: number };
  difficulty: { ratio: number; relation: "same" | "adjacent" | "far" | "unknown"; weight: number; points: number };
  capo: { ratio: number; diff: number | null; weight: number; points: number };
  tags: { ratio: number; shared: string[]; weight: number; points: number };
}

export interface CompatibilityResult {
  score: number;
  breakdown: CompatibilityBreakdown;
}

export function calculateSongCompatibility(base: Song, candidate: Song): CompatibilityResult {
  const theme = jaccard(base.themes, candidate.themes);
  const moment = momentDistance(base.moments, candidate.moments);
  const energy = energyScore(base.energy, candidate.energy);
  const key = calculateKeyCompatibility(base.key, candidate.key);
  const difficulty = difficultyScore(base.difficulty, candidate.difficulty);
  const capo = capoScore(base.capo, candidate.capo);
  const tags = jaccard(base.tags, candidate.tags);

  const momentRatio = moment.matched ? 1 : moment.adjacent ? 0.5 : 0;

  const breakdown: CompatibilityBreakdown = {
    theme: { ratio: theme.ratio, shared: theme.shared, weight: COMPATIBILITY_WEIGHTS.theme, points: theme.ratio * COMPATIBILITY_WEIGHTS.theme },
    moment: { ...moment, weight: COMPATIBILITY_WEIGHTS.moment, points: momentRatio * COMPATIBILITY_WEIGHTS.moment },
    energy: { ratio: energy.ratio, diff: energy.diff, weight: COMPATIBILITY_WEIGHTS.energy, points: energy.ratio * COMPATIBILITY_WEIGHTS.energy },
    key: { ...key, weight: COMPATIBILITY_WEIGHTS.key, points: (key.score / 100) * COMPATIBILITY_WEIGHTS.key },
    difficulty: { ratio: difficulty.ratio, relation: difficulty.relation, weight: COMPATIBILITY_WEIGHTS.difficulty, points: difficulty.ratio * COMPATIBILITY_WEIGHTS.difficulty },
    capo: { ratio: capo.ratio, diff: capo.diff, weight: COMPATIBILITY_WEIGHTS.capo, points: capo.ratio * COMPATIBILITY_WEIGHTS.capo },
    tags: { ratio: tags.ratio, shared: tags.shared, weight: COMPATIBILITY_WEIGHTS.tags, points: tags.ratio * COMPATIBILITY_WEIGHTS.tags },
  };

  const rawScore =
    breakdown.theme.points +
    breakdown.moment.points +
    breakdown.energy.points +
    breakdown.key.points +
    breakdown.difficulty.points +
    breakdown.capo.points +
    breakdown.tags.points;

  return { score: Math.round(Math.min(100, Math.max(0, rawScore))), breakdown };
}

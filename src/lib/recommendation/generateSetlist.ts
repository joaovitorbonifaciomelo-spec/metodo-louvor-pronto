import type { Difficulty, Song } from "@/types/song";
import type { TeamLevel } from "@/types/setlist";
import { calculateSongCompatibility } from "./compatibility";
import { generateCompatibilityReasons, type CompatibilityReason } from "./reasons";
import { applyPenalty, calculateRepetitionPenalty, computeSongUsage, type SetlistHistoryEntry } from "./repetitionPenalty";
import { ENERGY_CURVE_BY_MOMENT } from "./weights";

export interface SetlistStructureSlot {
  moment: string;
  count: number;
}

export interface LockedItem {
  position: number;
  songId: string;
}

export interface GenerateSetlistInput {
  songs: Song[];
  structure: SetlistStructureSlot[];
  teamLevel: TeamLevel;
  theme?: string | null;
  mandatorySongId?: string | null;
  history?: SetlistHistoryEntry[];
  lockedItems?: LockedItem[];
  variantCount?: number;
  referenceDate?: Date;
}

export interface GeneratedSetlistItem {
  position: number;
  moment: string;
  song: Song;
  compatibilityScore: number | null;
  reasons: CompatibilityReason[];
  locked: boolean;
}

export interface GeneratedSetlist {
  label: string;
  items: GeneratedSetlistItem[];
}

const TEAM_LEVEL_ALLOWED: Record<TeamLevel, Difficulty[][]> = {
  iniciante: [["iniciante"], ["iniciante", "intermediaria"], ["iniciante", "intermediaria", "avancada"]],
  intermediaria: [["iniciante", "intermediaria"], ["iniciante", "intermediaria", "avancada"]],
  avancada: [["iniciante", "intermediaria", "avancada"]],
};

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function filterByTeamLevel(songs: Song[], teamLevel: TeamLevel): Song[] {
  const tiers = TEAM_LEVEL_ALLOWED[teamLevel];
  for (const allowed of tiers) {
    const filtered = songs.filter((s) => !s.difficulty || allowed.includes(s.difficulty));
    if (filtered.length > 0) return filtered;
  }
  return songs;
}

function themeMatchBonus(song: Song, theme: string | null | undefined): number {
  if (!theme) return 0;
  const needle = normalize(theme);
  if (!needle) return 0;
  const haystacks = [...song.themes, ...song.tags, song.title].map(normalize);
  return haystacks.some((h) => h.includes(needle) || needle.includes(h)) ? 20 : 0;
}

function energyTargetScore(song: Song, moment: string, indexWithinMoment: number): number {
  const curve = ENERGY_CURVE_BY_MOMENT[moment] ?? [3];
  const target = curve[Math.min(indexWithinMoment, curve.length - 1)] ?? 3;
  if (song.energy === null) return 10;
  const diff = Math.abs(song.energy - target);
  return diff === 0 ? 20 : diff === 1 ? 12 : diff === 2 ? 5 : 0;
}

interface FlatSlot {
  position: number;
  moment: string;
  indexWithinMoment: number;
}

function flattenStructure(structure: SetlistStructureSlot[]): FlatSlot[] {
  const slots: FlatSlot[] = [];
  let position = 1;
  for (const slot of structure) {
    for (let i = 0; i < slot.count; i++) {
      slots.push({ position, moment: slot.moment, indexWithinMoment: i });
      position++;
    }
  }
  return slots;
}

function scoreCandidateWithHistory(
  candidate: Song,
  history: SetlistHistoryEntry[],
  referenceDate: Date,
  baseScore: number
): number {
  const usage = computeSongUsage(history, candidate.id, referenceDate);
  const penalty = calculateRepetitionPenalty(usage);
  return applyPenalty(baseScore, penalty);
}

/**
 * Gera 1+ variantes de repertório respeitando estrutura, energia por momento,
 * nível da equipe, música obrigatória e músicas travadas. Determinístico e
 * testável — nenhuma chamada a IA generativa.
 */
export function generateSetlist(input: GenerateSetlistInput): GeneratedSetlist[] {
  const {
    songs,
    structure,
    teamLevel,
    theme = null,
    mandatorySongId = null,
    history = [],
    lockedItems = [],
    variantCount = 2,
    referenceDate = new Date(),
  } = input;

  const activeSongs = songs.filter((s) => s.active);
  const slots = flattenStructure(structure);
  const variants: GeneratedSetlist[] = [];

  for (let variantIndex = 0; variantIndex < variantCount; variantIndex++) {
    const usedIds = new Set<string>();
    const items: GeneratedSetlistItem[] = [];
    let previousSong: Song | null = null;
    let mandatoryPlaced = false;

    for (const slot of slots) {
      const lock = lockedItems.find((l) => l.position === slot.position);
      let chosen: Song | undefined;

      if (lock) {
        chosen = activeSongs.find((s) => s.id === lock.songId);
      } else if (mandatorySongId && !mandatoryPlaced) {
        const mandatorySong = activeSongs.find((s) => s.id === mandatorySongId);
        if (mandatorySong && mandatorySong.moments.includes(slot.moment)) {
          chosen = mandatorySong;
          mandatoryPlaced = true;
        }
      }

      if (!chosen) {
        let candidates = filterByTeamLevel(
          activeSongs.filter((s) => s.moments.includes(slot.moment) && !usedIds.has(s.id)),
          teamLevel
        );
        if (candidates.length === 0) {
          candidates = activeSongs.filter((s) => !usedIds.has(s.id));
        }

        const scored = candidates.map((candidate) => {
          const baseScore = previousSong
            ? calculateSongCompatibility(previousSong, candidate).score
            : 50 + energyTargetScore(candidate, slot.moment, slot.indexWithinMoment) + themeMatchBonus(candidate, theme);
          return { candidate, score: scoreCandidateWithHistory(candidate, history, referenceDate, baseScore) };
        });

        scored.sort((a, b) => b.score - a.score);
        const pickIndex = Math.min(variantIndex, scored.length - 1);
        chosen = scored[Math.max(pickIndex, 0)]?.candidate;
      }

      if (!chosen) continue;

      usedIds.add(chosen.id);
      const compatibility = previousSong ? calculateSongCompatibility(previousSong, chosen) : null;
      items.push({
        position: slot.position,
        moment: slot.moment,
        song: chosen,
        compatibilityScore: compatibility?.score ?? null,
        reasons: compatibility ? generateCompatibilityReasons(previousSong as Song, chosen, compatibility.breakdown) : [],
        locked: Boolean(lock),
      });
      previousSong = chosen;
    }

    variants.push({ label: String.fromCharCode(65 + variantIndex), items });
  }

  return variants;
}

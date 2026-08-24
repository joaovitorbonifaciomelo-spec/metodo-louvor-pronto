import { REPETITION_PENALTY } from "./weights";

export interface SongUsage {
  /** Quantos cultos atrás (1 = último culto salvo) a música foi tocada; null = nunca tocada. */
  servicesAgo: number | null;
  /** Dias desde a última vez tocada; null = nunca tocada. */
  daysAgo: number | null;
}

/**
 * Penaliza músicas tocadas recentemente para incentivar variedade.
 * NÃO é uma regra absoluta — apenas reduz o score; o líder pode escolher mesmo assim.
 */
export function calculateRepetitionPenalty(usage: SongUsage): number {
  if (usage.servicesAgo === null) return 0;

  if (usage.servicesAgo <= 1) return REPETITION_PENALTY.lastService;
  if (usage.servicesAgo === 2) return REPETITION_PENALTY.lastTwoServices;
  if (usage.servicesAgo <= REPETITION_PENALTY.recentWindow) return REPETITION_PENALTY.recentlyPlayed;

  if (usage.daysAgo !== null && usage.daysAgo >= REPETITION_PENALTY.unusedForMonthsThreshold) {
    return REPETITION_PENALTY.unusedForMonthsBonus;
  }

  return 0;
}

export function applyPenalty(score: number, penalty: number): number {
  return Math.round(Math.min(100, Math.max(0, score + penalty)));
}

export interface SetlistHistoryEntry {
  serviceDate: string | null;
  createdAt: string;
  songIds: string[];
}

/**
 * Calcula, para uma música, há quantos cultos e quantos dias ela foi tocada
 * pela última vez, a partir do histórico de setlists do usuário/igreja
 * (ordenado do mais recente para o mais antigo).
 */
export function computeSongUsage(
  historyDesc: SetlistHistoryEntry[],
  songId: string,
  referenceDate: Date = new Date()
): SongUsage {
  for (let i = 0; i < historyDesc.length; i++) {
    const entry = historyDesc[i];
    if (entry && entry.songIds.includes(songId)) {
      const dateStr = entry.serviceDate ?? entry.createdAt;
      const days = Math.max(0, Math.round((referenceDate.getTime() - new Date(dateStr).getTime()) / 86_400_000));
      return { servicesAgo: i + 1, daysAgo: days };
    }
  }
  return { servicesAgo: null, daysAgo: null };
}

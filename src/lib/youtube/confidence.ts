import type { YoutubeSearchResult } from "./searchYoutube";

const POSITIVE_TERMS = ["oficial", "official", "ao vivo", "live", "clipe"];
/**
 * Termos que reduzem confiança — NÃO são proibidos (seção 10): um "ao vivo"
 * cover ainda pode ser a melhor referência disponível, só priorizamos a
 * gravação "principal" quando houver uma.
 */
const NEGATIVE_TERMS = ["karaoke", "cover", "tutorial", "cifra", "instrumental", "slowed", "remix", "reaction"];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function wordOverlapRatio(a: string, b: string): number {
  const wordsA = normalize(a)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (wordsA.length === 0) return 0;
  const normB = normalize(b);
  const matched = wordsA.filter((w) => normB.includes(w));
  return matched.length / wordsA.length;
}

export interface ConfidenceResult {
  score: number; // 0-100
  reasons: string[];
}

/** Heurística de confiança para um resultado de busca do YouTube (seção 10). */
export function calculateYoutubeConfidence(
  song: { title: string; artist: string | null },
  result: YoutubeSearchResult
): ConfidenceResult {
  const reasons: string[] = [];
  let score = 10; // baseline por ser um vídeo válido retornado pela API

  const titleOverlap = wordOverlapRatio(song.title, result.title);
  if (titleOverlap >= 0.8) {
    score += 35;
    reasons.push("título contém o nome da música");
  } else if (titleOverlap >= 0.5) {
    score += 18;
    reasons.push("título contém parte do nome da música");
  }

  if (song.artist) {
    const normalizedArtist = normalize(song.artist);
    const titleHasArtist = normalize(result.title).includes(normalizedArtist);
    const channelHasArtist =
      normalize(result.channelTitle).includes(normalizedArtist) || normalizedArtist.includes(normalize(result.channelTitle));
    if (titleHasArtist) {
      score += 15;
      reasons.push("título contém o artista");
    }
    if (channelHasArtist) {
      score += 15;
      reasons.push("canal corresponde ao artista");
    }
  }

  const normalizedTitle = normalize(result.title);
  for (const term of POSITIVE_TERMS) {
    if (normalizedTitle.includes(term)) {
      score += 5;
      reasons.push(`contém "${term}"`);
      break;
    }
  }

  let penalties = 0;
  for (const term of NEGATIVE_TERMS) {
    if (normalizedTitle.includes(term)) {
      penalties += 12;
      reasons.push(`termo reduz confiança: "${term}"`);
    }
  }
  score -= Math.min(penalties, 36);

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export const YOUTUBE_CONFIDENCE_THRESHOLDS = {
  /** >= confirma automaticamente o link (ainda editável/substituível no admin). */
  autoConfirm: 60,
  /** < não vale a pena nem guardar como sugestão de revisão. */
  minimumToSuggest: 25,
} as const;

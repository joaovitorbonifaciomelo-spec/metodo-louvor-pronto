/**
 * Detecção de duplicatas de catálogo — usada tanto na auditoria do seed inicial
 * quanto na importação de CSV pelo admin (seção 22 do briefing).
 *
 * Estratégia em duas camadas:
 *  - match exato após normalização (acentos/pontuação/caixa) => duplicata certa
 *  - similaridade de palavras (Jaccard) acima do limiar => possível duplicata,
 *    entra em lista de revisão, NUNCA é bloqueada/mesclada automaticamente.
 */

const STOPWORDS = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "que",
  "é", "eh", "meu", "minha", "teu", "tua", "seu", "sua", "com", "para",
  "pra", "por", "no", "na", "nos", "nas", "um", "uma",
]);

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(title: string): Set<string> {
  return new Set(normalizeTitle(title).split(" ").filter((w) => w.length > 0 && !STOPWORDS.has(w)));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) if (b.has(word)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DuplicateCandidate {
  a: { title: string; artist?: string | null };
  b: { title: string; artist?: string | null };
  similarity: number;
  exact: boolean;
}

const REVIEW_THRESHOLD = 0.6;

/**
 * Compara uma lista de músicas contra si mesma (ou uma lista B contra uma lista A
 * já existente) e retorna candidatos a duplicata. Não remove nada — apenas relata.
 */
export function findPotentialDuplicates<
  T extends { title: string; artist?: string | null },
  U extends { title: string; artist?: string | null } = T
>(candidates: T[], against: U[] = candidates as unknown as U[]): DuplicateCandidate[] {
  const results: DuplicateCandidate[] = [];
  const sameList = (against as unknown) === (candidates as unknown);

  for (let i = 0; i < candidates.length; i++) {
    const start = sameList ? i + 1 : 0;
    for (let j = start; j < against.length; j++) {
      const a = candidates[i]!;
      const b = against[j]!;
      if (sameList && (a as unknown) === (b as unknown)) continue;

      const normA = normalizeTitle(a.title);
      const normB = normalizeTitle(b.title);
      if (normA === normB) {
        results.push({ a, b, similarity: 1, exact: true });
        continue;
      }

      const sim = jaccardSimilarity(significantWords(a.title), significantWords(b.title));
      if (sim >= REVIEW_THRESHOLD) {
        results.push({ a, b, similarity: sim, exact: false });
      }
    }
  }

  return results.sort((x, y) => y.similarity - x.similarity);
}

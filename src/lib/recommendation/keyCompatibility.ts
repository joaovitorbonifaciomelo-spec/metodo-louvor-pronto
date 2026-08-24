/**
 * Compatibilidade tonal — determinística, baseada em teoria musical básica
 * (círculo das quintas + relativo maior/menor). Não depende de IA.
 *
 * Importante: isto NÃO avalia arranjo, andamento ou execução — apenas a
 * distância teórica entre duas tonalidades. A decisão final é sempre da banda.
 */

const PITCH_CLASS: Record<string, number> = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

/** Ordem do círculo das quintas partindo de C, por classe de altura (pitch class). */
const CIRCLE_OF_FIFTHS: number[] = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];

export type KeyMode = "major" | "minor";

export interface ParsedKey {
  tonic: number; // pitch class 0-11
  mode: KeyMode;
  raw: string;
}

export type KeyCompatibilityBucket = "same" | "simple_transition" | "requires_adaptation" | "unknown";

export interface KeyCompatibilityResult {
  score: number; // 0-100
  bucket: KeyCompatibilityBucket;
  label: string;
}

export function parseKey(input: string | null | undefined): ParsedKey | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([A-Ga-g])([#b]?)(m|min|maj)?$/);
  if (!match) return null;

  const [, letter, accidental, modeToken] = match;
  if (!letter) return null;
  const noteName = `${letter.toUpperCase()}${accidental ?? ""}`;
  const tonic = PITCH_CLASS[noteName];
  if (tonic === undefined) return null;

  const mode: KeyMode = modeToken === "m" || modeToken === "min" ? "minor" : "major";
  return { tonic, mode, raw: trimmed };
}

function circleDistance(a: number, b: number): number {
  const posA = CIRCLE_OF_FIFTHS.indexOf(a);
  const posB = CIRCLE_OF_FIFTHS.indexOf(b);
  const diff = Math.abs(posA - posB);
  return Math.min(diff, 12 - diff);
}

/** Pitch class do relativo maior (para colocar tons maiores/menores na mesma régua). */
function relativeMajorTonic(key: ParsedKey): number {
  return key.mode === "major" ? key.tonic : (key.tonic + 3) % 12;
}

export function calculateKeyCompatibility(
  keyA: string | null | undefined,
  keyB: string | null | undefined
): KeyCompatibilityResult {
  const a = parseKey(keyA);
  const b = parseKey(keyB);

  if (!a || !b) {
    return { score: 50, bucket: "unknown", label: "Tom não informado" };
  }

  if (a.tonic === b.tonic && a.mode === b.mode) {
    return { score: 100, bucket: "same", label: "Mesmo tom" };
  }

  const isRelativePair =
    a.mode !== b.mode &&
    ((a.mode === "major" && b.tonic === (a.tonic + 9) % 12) ||
      (a.mode === "minor" && b.tonic === (a.tonic + 3) % 12));
  if (isRelativePair) {
    return { score: 90, bucket: "simple_transition", label: "Relativo maior/menor" };
  }

  if (a.tonic === b.tonic && a.mode !== b.mode) {
    return { score: 70, bucket: "simple_transition", label: "Tonalidade paralela" };
  }

  const distance = circleDistance(relativeMajorTonic(a), relativeMajorTonic(b));
  switch (distance) {
    case 1:
      return { score: 80, bucket: "simple_transition", label: "Tonalidades vizinhas" };
    case 2:
      return { score: 60, bucket: "simple_transition", label: "Transição possível" };
    case 3:
      return { score: 45, bucket: "requires_adaptation", label: "Requer adaptação" };
    case 4:
      return { score: 30, bucket: "requires_adaptation", label: "Requer adaptação" };
    case 5:
      return { score: 20, bucket: "requires_adaptation", label: "Requer adaptação" };
    default:
      return { score: 15, bucket: "requires_adaptation", label: "Requer adaptação" };
  }
}

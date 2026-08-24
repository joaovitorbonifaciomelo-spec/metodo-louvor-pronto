import type { Song } from "@/types/song";
import type { CompatibilityBreakdown } from "./compatibility";

export interface CompatibilityReason {
  kind: "positive" | "warning";
  text: string;
  weight: number; // usado só para ordenar por relevância
}

/**
 * Traduz o breakdown numérico em frases compreensíveis para o usuário.
 * Não expõe apenas "87%" — explica o motivo (ver seção 13 do briefing).
 */
export function generateCompatibilityReasons(
  base: Song,
  candidate: Song,
  breakdown: CompatibilityBreakdown
): CompatibilityReason[] {
  const reasons: CompatibilityReason[] = [];

  if (breakdown.theme.shared.length > 0) {
    reasons.push({
      kind: "positive",
      text: `Tema em comum: ${breakdown.theme.shared.slice(0, 2).join(", ")}`,
      weight: breakdown.theme.weight,
    });
  } else if (base.themes.length > 0 && candidate.themes.length > 0) {
    reasons.push({ kind: "warning", text: "Temas diferentes", weight: breakdown.theme.weight * 0.5 });
  }

  if (breakdown.moment.matched) {
    reasons.push({
      kind: "positive",
      text: `Mesmo momento do culto (${candidate.moments[0] ?? base.moments[0]})`,
      weight: breakdown.moment.weight,
    });
  } else if (breakdown.moment.adjacent) {
    reasons.push({
      kind: "positive",
      text: `Boa opção para caminhar para ${candidate.moments[0] ?? "o próximo momento"}`,
      weight: breakdown.moment.weight * 0.7,
    });
  } else {
    reasons.push({ kind: "warning", text: "Momentos distantes no culto", weight: breakdown.moment.weight * 0.4 });
  }

  if (breakdown.energy.diff !== null) {
    if (breakdown.energy.diff === 0) {
      reasons.push({ kind: "positive", text: `Mantém a energia (nível ${base.energy})`, weight: breakdown.energy.weight });
    } else if (breakdown.energy.diff === 1) {
      reasons.push({
        kind: "positive",
        text: `Boa continuidade de energia (${base.energy} → ${candidate.energy})`,
        weight: breakdown.energy.weight * 0.8,
      });
    } else {
      reasons.push({
        kind: "warning",
        text: `Mudança de energia (${base.energy} → ${candidate.energy})`,
        weight: breakdown.energy.weight * 0.5,
      });
    }
  }

  if (breakdown.key.bucket === "same") {
    reasons.push({ kind: "positive", text: "Mesmo tom", weight: breakdown.key.weight });
  } else if (breakdown.key.bucket === "simple_transition") {
    reasons.push({ kind: "positive", text: breakdown.key.label, weight: breakdown.key.weight * 0.7 });
  } else if (breakdown.key.bucket === "requires_adaptation") {
    reasons.push({ kind: "warning", text: "Requer adaptação de tom", weight: breakdown.key.weight * 0.6 });
  }

  if (breakdown.difficulty.relation === "same") {
    reasons.push({ kind: "positive", text: "Mesmo nível de dificuldade", weight: breakdown.difficulty.weight * 0.5 });
  } else if (breakdown.difficulty.relation === "far") {
    reasons.push({ kind: "warning", text: "Diferença grande de dificuldade", weight: breakdown.difficulty.weight });
  }

  if (breakdown.capo.diff !== null && breakdown.capo.diff >= 3) {
    reasons.push({ kind: "warning", text: "Capotraste bem diferente", weight: breakdown.capo.weight });
  }

  if (breakdown.tags.shared.length > 0) {
    reasons.push({
      kind: "positive",
      text: `Tags em comum: ${breakdown.tags.shared.slice(0, 2).join(", ")}`,
      weight: breakdown.tags.weight * 0.6,
    });
  }

  return reasons.sort((a, b) => b.weight - a.weight).slice(0, 5);
}

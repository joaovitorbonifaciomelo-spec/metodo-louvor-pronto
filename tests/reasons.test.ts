import { describe, expect, it } from "vitest";
import { calculateSongCompatibility } from "@/lib/recommendation/compatibility";
import { generateCompatibilityReasons } from "@/lib/recommendation/reasons";
import { makeSong } from "./testFixtures";

describe("generateCompatibilityReasons", () => {
  it("explains a strong match with positive reasons", () => {
    const base = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["fidelidade"] });
    const candidate = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["fidelidade", "graça"] });
    const { breakdown } = calculateSongCompatibility(base, candidate);
    const reasons = generateCompatibilityReasons(base, candidate, breakdown);

    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some((r) => r.kind === "positive" && r.text.includes("Mesmo tom"))).toBe(true);
    expect(reasons.every((r) => r.kind === "positive")).toBe(true);
  });

  it("warns about tonal adaptation and energy jumps on a weak match", () => {
    const base = makeSong({ key: "C", energy: 5, moments: ["Celebração"], themes: ["celebração"] });
    const candidate = makeSong({ key: "F#", energy: 1, moments: ["Ministração"], themes: ["arrependimento"] });
    const { breakdown } = calculateSongCompatibility(base, candidate);
    const reasons = generateCompatibilityReasons(base, candidate, breakdown);

    expect(reasons.some((r) => r.kind === "warning")).toBe(true);
  });

  it("never returns more than 5 reasons", () => {
    const base = makeSong();
    const candidate = makeSong({ key: "D" });
    const { breakdown } = calculateSongCompatibility(base, candidate);
    const reasons = generateCompatibilityReasons(base, candidate, breakdown);
    expect(reasons.length).toBeLessThanOrEqual(5);
  });

  it("orders reasons by relevance (highest weight first)", () => {
    const base = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["fidelidade"] });
    const candidate = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["fidelidade"] });
    const { breakdown } = calculateSongCompatibility(base, candidate);
    const reasons = generateCompatibilityReasons(base, candidate, breakdown);
    const weights = reasons.map((r) => r.weight);
    const sorted = [...weights].sort((a, b) => b - a);
    expect(weights).toEqual(sorted);
  });
});

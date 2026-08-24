import { describe, expect, it } from "vitest";
import { calculateSongCompatibility } from "@/lib/recommendation/compatibility";
import { COMPATIBILITY_WEIGHTS_TOTAL } from "@/lib/recommendation/weights";
import { makeSong } from "./testFixtures";

describe("calculateSongCompatibility", () => {
  it("gives a near-maximum score to two very similar songs", () => {
    const base = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["graça", "cruz"], difficulty: "intermediaria" });
    const candidate = makeSong({ key: "G", energy: 3, moments: ["Adoração"], themes: ["graça", "cruz"], difficulty: "intermediaria" });
    const result = calculateSongCompatibility(base, candidate);
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it("gives a low score to very different songs", () => {
    const base = makeSong({ key: "C", energy: 5, moments: ["Celebração"], themes: ["celebração"], difficulty: "avancada", capo: 0 });
    const candidate = makeSong({ key: "F#", energy: 1, moments: ["Ministração"], themes: ["arrependimento"], difficulty: "iniciante", capo: 5 });
    const result = calculateSongCompatibility(base, candidate);
    expect(result.score).toBeLessThan(35);
  });

  it("never exceeds the total possible weight of 100", () => {
    const base = makeSong();
    const candidate = makeSong();
    const result = calculateSongCompatibility(base, candidate);
    expect(COMPATIBILITY_WEIGHTS_TOTAL).toBe(100);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("rewards shared moment even without shared themes", () => {
    const base = makeSong({ moments: ["Celebração"], themes: ["alegria"] });
    const sameMoment = makeSong({ moments: ["Celebração"], themes: ["missão"] });
    const differentMoment = makeSong({ moments: ["Ceia"], themes: ["missão"] });

    const withSameMoment = calculateSongCompatibility(base, sameMoment);
    const withDifferentMoment = calculateSongCompatibility(base, differentMoment);
    expect(withSameMoment.breakdown.moment.points).toBeGreaterThan(withDifferentMoment.breakdown.moment.points);
  });

  it("is deterministic for the same inputs", () => {
    const base = makeSong({ id: "a" });
    const candidate = makeSong({ id: "b", key: "D" });
    const first = calculateSongCompatibility(base, candidate);
    const second = calculateSongCompatibility(base, candidate);
    expect(first.score).toBe(second.score);
  });
});

import { describe, expect, it } from "vitest";
import { applyPenalty, calculateRepetitionPenalty, computeSongUsage } from "@/lib/recommendation/repetitionPenalty";

describe("calculateRepetitionPenalty", () => {
  it("penalizes a song played in the last service the most", () => {
    expect(calculateRepetitionPenalty({ servicesAgo: 1, daysAgo: 3 })).toBe(-30);
  });

  it("penalizes a song played in the last two services less", () => {
    expect(calculateRepetitionPenalty({ servicesAgo: 2, daysAgo: 10 })).toBe(-20);
  });

  it("applies a small penalty for songs played recently but not in the last 2 services", () => {
    expect(calculateRepetitionPenalty({ servicesAgo: 4, daysAgo: 30 })).toBe(-10);
  });

  it("gives a small bonus to songs unused for a long time", () => {
    expect(calculateRepetitionPenalty({ servicesAgo: 10, daysAgo: 120 })).toBeGreaterThan(0);
  });

  it("is neutral for a song never played", () => {
    expect(calculateRepetitionPenalty({ servicesAgo: null, daysAgo: null })).toBe(0);
  });
});

describe("applyPenalty", () => {
  it("clamps the result between 0 and 100", () => {
    expect(applyPenalty(10, -30)).toBe(0);
    expect(applyPenalty(98, 10)).toBe(100);
    expect(applyPenalty(50, -10)).toBe(40);
  });
});

describe("computeSongUsage", () => {
  const now = new Date("2026-08-24T00:00:00Z");

  it("finds how many services ago a song was played", () => {
    const history = [
      { serviceDate: "2026-08-17", createdAt: "2026-08-17", songIds: ["b"] },
      { serviceDate: "2026-08-10", createdAt: "2026-08-10", songIds: ["a", "c"] },
    ];
    const usage = computeSongUsage(history, "a", now);
    expect(usage.servicesAgo).toBe(2);
    expect(usage.daysAgo).toBe(14);
  });

  it("returns null usage when the song was never played", () => {
    const usage = computeSongUsage([], "unknown", now);
    expect(usage).toEqual({ servicesAgo: null, daysAgo: null });
  });
});

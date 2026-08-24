import { describe, expect, it } from "vitest";
import { canCreateSetlist, canSearchToday, getPlanLimits } from "@/lib/config/plans";

describe("plan limits", () => {
  it("free plan blocks setlist creation after reaching the limit", () => {
    const limits = getPlanLimits("free");
    expect(canCreateSetlist("free", limits.maxSetlists! - 1)).toBe(true);
    expect(canCreateSetlist("free", limits.maxSetlists!)).toBe(false);
  });

  it("pro plan has unlimited setlists", () => {
    expect(canCreateSetlist("pro", 9999)).toBe(true);
  });

  it("defaults to free plan when null/undefined", () => {
    expect(getPlanLimits(null).id).toBe("free");
    expect(getPlanLimits(undefined).id).toBe("free");
  });

  it("free plan blocks searches after the daily limit", () => {
    const limits = getPlanLimits("free");
    expect(canSearchToday("free", limits.maxSearchesPerDay! - 1)).toBe(true);
    expect(canSearchToday("free", limits.maxSearchesPerDay!)).toBe(false);
  });
});

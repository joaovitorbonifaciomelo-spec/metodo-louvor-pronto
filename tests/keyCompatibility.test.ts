import { describe, expect, it } from "vitest";
import { calculateKeyCompatibility, parseKey } from "@/lib/recommendation/keyCompatibility";

describe("parseKey", () => {
  it("parses major keys", () => {
    expect(parseKey("G")).toEqual({ tonic: 7, mode: "major", raw: "G" });
    expect(parseKey("F#")).toEqual({ tonic: 6, mode: "major", raw: "F#" });
  });

  it("parses minor keys", () => {
    expect(parseKey("Am")).toEqual({ tonic: 9, mode: "minor", raw: "Am" });
    expect(parseKey("Ebm")).toEqual({ tonic: 3, mode: "minor", raw: "Ebm" });
  });

  it("returns null for invalid input", () => {
    expect(parseKey(null)).toBeNull();
    expect(parseKey("")).toBeNull();
    expect(parseKey("H")).toBeNull();
  });
});

describe("calculateKeyCompatibility", () => {
  it("scores same key as 100 / same", () => {
    const result = calculateKeyCompatibility("G", "G");
    expect(result.score).toBe(100);
    expect(result.bucket).toBe("same");
  });

  it("treats relative major/minor as a simple transition", () => {
    const result = calculateKeyCompatibility("C", "Am");
    expect(result.bucket).toBe("simple_transition");
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("treats neighboring keys on the circle of fifths as simple transition", () => {
    const result = calculateKeyCompatibility("G", "D");
    expect(result.bucket).toBe("simple_transition");
  });

  it("treats distant keys as requiring adaptation", () => {
    const result = calculateKeyCompatibility("C", "F#");
    expect(result.bucket).toBe("requires_adaptation");
    expect(result.score).toBeLessThan(50);
  });

  it("returns unknown/neutral when a key is missing", () => {
    const result = calculateKeyCompatibility(null, "G");
    expect(result.bucket).toBe("unknown");
    expect(result.score).toBe(50);
  });

  it("is symmetric regardless of argument order", () => {
    const a = calculateKeyCompatibility("D", "A");
    const b = calculateKeyCompatibility("A", "D");
    expect(a.score).toBe(b.score);
    expect(a.bucket).toBe(b.bucket);
  });
});

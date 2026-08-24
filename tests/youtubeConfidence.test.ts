import { describe, expect, it } from "vitest";
import { calculateYoutubeConfidence, YOUTUBE_CONFIDENCE_THRESHOLDS } from "@/lib/youtube/confidence";

describe("calculateYoutubeConfidence", () => {
  it("gives high confidence to an official video matching title and artist", () => {
    const result = calculateYoutubeConfidence(
      { title: "Bondade de Deus", artist: "Isaías Saad" },
      { videoId: "abc", title: "Bondade de Deus - Isaías Saad (Oficial)", channelTitle: "Isaías Saad", thumbnailUrl: null }
    );
    expect(result.score).toBeGreaterThanOrEqual(YOUTUBE_CONFIDENCE_THRESHOLDS.autoConfirm);
  });

  it("gives low confidence to an unrelated video", () => {
    const result = calculateYoutubeConfidence(
      { title: "Bondade de Deus", artist: "Isaías Saad" },
      { videoId: "xyz", title: "Como trocar uma corda de violão", channelTitle: "Canal de Violão", thumbnailUrl: null }
    );
    expect(result.score).toBeLessThan(YOUTUBE_CONFIDENCE_THRESHOLDS.minimumToSuggest);
  });

  it("penalizes but does not zero out a cover version", () => {
    const result = calculateYoutubeConfidence(
      { title: "Bondade de Deus", artist: "Isaías Saad" },
      { videoId: "def", title: "Bondade de Deus (cover)", channelTitle: "Alguém Tocando", thumbnailUrl: null }
    );
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons.some((r) => r.includes("cover"))).toBe(true);
  });

  it("still scores reasonably without a known artist", () => {
    const result = calculateYoutubeConfidence(
      { title: "Ousado Amor", artist: null },
      { videoId: "ghi", title: "Ousado Amor - Ao Vivo", channelTitle: "Qualquer Canal", thumbnailUrl: null }
    );
    expect(result.score).toBeGreaterThan(20);
  });
});

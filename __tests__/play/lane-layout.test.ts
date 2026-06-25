import { describe, expect, it } from "vitest";
import { computeLaneOverlap, CARD_ASPECT } from "@/lib/play/lane-layout";

describe("computeLaneOverlap", () => {
  it("derives card width from lane height × aspect", () => {
    const { cardWidth } = computeLaneOverlap({ count: 1, laneWidth: 1000, laneHeight: 140 });
    expect(cardWidth).toBeCloseTo(140 * CARD_ASPECT);
  });

  it("spaces cards out with a positive gap when they fit", () => {
    const { overlapMargin, rowWidth } = computeLaneOverlap({ count: 3, laneWidth: 1000, laneHeight: 140 });
    expect(overlapMargin).toBeGreaterThan(0); // gap, not overlap
    expect(rowWidth).toBeLessThanOrEqual(1000);
  });

  it("compresses so the row never exceeds the lane width", () => {
    const { overlapMargin, rowWidth } = computeLaneOverlap({ count: 40, laneWidth: 600, laneHeight: 140 });
    expect(overlapMargin).toBeLessThan(0); // overlapping
    expect(rowWidth).toBeLessThanOrEqual(600 + 0.5); // fits (float slack)
  });

  it("never collapses past the minimum sliver even at extreme counts", () => {
    const { cardWidth, step } = computeLaneOverlap({ count: 200, laneWidth: 300, laneHeight: 140 });
    expect(step).toBeGreaterThanOrEqual(0.18 * cardWidth - 1e-6);
  });

  it("handles the empty lane without dividing by zero", () => {
    const r = computeLaneOverlap({ count: 0, laneWidth: 600, laneHeight: 140 });
    expect(r.rowWidth).toBe(0);
    expect(Number.isFinite(r.step)).toBe(true);
  });
});

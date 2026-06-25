import { describe, expect, it } from "vitest";
import { PHASES, FIRST_PHASE, nextPhase, isLastPhase } from "@/lib/game/phases";

describe("phases", () => {
  it("starts at the first phase", () => {
    expect(FIRST_PHASE).toBe("untap");
    expect(PHASES[0]).toBe("untap");
  });

  it("advances through every phase in order", () => {
    const walked: string[] = [FIRST_PHASE];
    let p = FIRST_PHASE;
    for (let i = 0; i < PHASES.length + 2; i++) {
      const n = nextPhase(p);
      if (n !== p) walked.push(n);
      p = n;
    }
    expect(walked).toEqual([...PHASES]);
  });

  it("clamps at the last phase", () => {
    const last = PHASES[PHASES.length - 1];
    expect(isLastPhase(last)).toBe(true);
    expect(nextPhase(last)).toBe(last);
  });

  it("falls back to the first phase for an unknown value", () => {
    // @ts-expect-error — deliberately passing a non-Phase to exercise the guard.
    expect(nextPhase("not-a-phase")).toBe(FIRST_PHASE);
  });
});

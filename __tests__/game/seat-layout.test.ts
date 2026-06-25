import { describe, expect, it } from "vitest";
import { getSeatLayout, type SeatInfo } from "@/lib/game/seat-layout";

const ffa = (n: number): SeatInfo[] =>
  Array.from({ length: n }, (_, i) => ({ seat: i, teamId: i }));

const teams2v2: SeatInfo[] = [
  { seat: 0, teamId: 0 },
  { seat: 1, teamId: 1 },
  { seat: 2, teamId: 0 },
  { seat: 3, teamId: 1 },
];

const sideOf = (p: ReturnType<typeof getSeatLayout>, seat: number) =>
  p.find((x) => x.seat === seat)?.side;

describe("getSeatLayout", () => {
  it("1v1: me bottom, opponent top", () => {
    const p = getSeatLayout(0, ffa(2), "per-player");
    expect(sideOf(p, 0)).toBe("bottom");
    expect(sideOf(p, 1)).toBe("top");
    expect(p.find((x) => x.seat === 0)?.countOnSide).toBe(1);
  });

  it("per-player 4P: me bottom alone, all opponents share the top", () => {
    const p = getSeatLayout(2, ffa(4), "per-player");
    expect(p.filter((x) => x.side === "bottom").map((x) => x.seat)).toEqual([
      2,
    ]);
    expect(
      p
        .filter((x) => x.side === "top")
        .map((x) => x.seat)
        .sort(),
    ).toEqual([0, 1, 3]);
    expect(p.find((x) => x.seat === 0)?.countOnSide).toBe(3);
  });

  it("2v2 shared-team: my team bottom, enemy team top", () => {
    const p = getSeatLayout(2, teams2v2, "shared-team"); // I'm seat 2, team 0
    expect(sideOf(p, 2)).toBe("bottom");
    expect(sideOf(p, 0)).toBe("bottom"); // teammate
    expect(sideOf(p, 1)).toBe("top");
    expect(sideOf(p, 3)).toBe("top");
    // I am the first column on my side.
    expect(p.find((x) => x.seat === 2)?.indexOnSide).toBe(0);
    expect(p.filter((x) => x.side === "bottom")).toHaveLength(2);
  });

  it("ignores teams when life is per-player even if teamIds are set", () => {
    const p = getSeatLayout(0, teams2v2, "per-player");
    expect(p.filter((x) => x.side === "bottom").map((x) => x.seat)).toEqual([
      0,
    ]);
    expect(p.filter((x) => x.side === "top")).toHaveLength(3);
  });

  it("places every seat exactly once", () => {
    const p = getSeatLayout(1, ffa(4), "per-player");
    expect(p.map((x) => x.seat).sort()).toEqual([0, 1, 2, 3]);
  });
});

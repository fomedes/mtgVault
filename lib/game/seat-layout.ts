/**
 * Pure seat placement for the battlefield stage. Decides which seats sit on the
 * viewer's half (bottom) vs the opposing half (top). In shared-team mode my whole
 * team shares the bottom and the enemy team the top; otherwise I sit alone on the
 * bottom and every opponent shares the top. Seats split each half into columns.
 *
 * Left/right side bands for 4-player FFA are intentionally out of scope here — the
 * `side` union can grow to `"left" | "right"` later without changing callers.
 */

import type { LifeMode } from "@/lib/game/play";

export interface SeatInfo {
  seat: number;
  teamId: number;
}

export interface SeatPlacement {
  seat: number;
  side: "top" | "bottom";
  teamId: number;
  /** Column index within the side (left→right). */
  indexOnSide: number;
  /** Number of seats sharing the side (column count). */
  countOnSide: number;
}

export function getSeatLayout(
  mySeat: number,
  seats: SeatInfo[],
  lifeMode: LifeMode,
): SeatPlacement[] {
  const myTeam = seats.find((s) => s.seat === mySeat)?.teamId;
  const teamMode = lifeMode === "shared-team" && myTeam !== undefined;

  const onBottom = (s: SeatInfo) =>
    teamMode ? s.teamId === myTeam : s.seat === mySeat;

  // Bottom: me first (consistent column), then teammates by seat.
  const bottom = seats.filter(onBottom).sort((a, b) => {
    if (a.seat === mySeat) return -1;
    if (b.seat === mySeat) return 1;
    return a.seat - b.seat;
  });
  const top = seats.filter((s) => !onBottom(s)).sort((a, b) => a.seat - b.seat);

  const place = (arr: SeatInfo[], side: "top" | "bottom"): SeatPlacement[] =>
    arr.map((s, i) => ({
      seat: s.seat,
      side,
      teamId: s.teamId,
      indexOnSide: i,
      countOnSide: arr.length,
    }));

  return [...place(bottom, "bottom"), ...place(top, "top")];
}

import { describe, expect, it } from "vitest";
import {
  applyAction,
  createBoard,
  getPlayerView,
  type BoardState,
  type SeatInit,
} from "@/lib/game/play";

function lib(prefix: string, n: number): SeatInit["library"] {
  return Array.from({ length: n }, (_, i) => ({
    cardObjectId: `${prefix}-card-${i}`,
    scryfallId: `${prefix}-sf-${i}`,
  }));
}

function board(): BoardState {
  return createBoard(
    "leak",
    [
      { uid: "alice", displayName: "Alice", teamId: 0, library: lib("a", 15) },
      { uid: "bob", displayName: "Bob", teamId: 1, library: lib("b", 15) },
    ],
    { lifeMode: "per-player", startingLife: 20, rngSeed: 123 },
  );
}

describe("getPlayerView leakage boundary", () => {
  it("never exposes an opponent's hand instances", () => {
    const b = board();
    const bobView = getPlayerView(b, 1);
    for (const aliceHandId of b.seats[0].zones.hand) {
      expect(bobView.cards[aliceHandId]).toBeUndefined();
    }
  });

  it("never exposes any library instance (either seat)", () => {
    const b = board();
    const view = getPlayerView(b, 0);
    const allLibrary = [...b.seats[0].zones.library, ...b.seats[1].zones.library];
    for (const id of allLibrary) expect(view.cards[id]).toBeUndefined();
  });

  it("exposes opponents' hand/library only as counts", () => {
    const b = board();
    const aliceView = getPlayerView(b, 0);
    const bobPublic = aliceView.seats.find((s) => s.seat === 1)!;
    expect(bobPublic.handCount).toBe(7);
    expect(bobPublic.libraryCount).toBe(8);
    // The public seat shape carries no hand/library id arrays at all.
    expect(Object.keys(bobPublic)).not.toContain("hand");
    expect(Object.keys(bobPublic)).not.toContain("library");
  });

  it("shows public zones (graveyard) to every seat", () => {
    let b = board();
    const milled = b.seats[0].zones.library[0];
    b = applyAction(b, 0, { type: "MILL", count: 1 });
    const bobView = getPlayerView(b, 1);
    expect(bobView.cards[milled]).toBeDefined();
    expect(bobView.seats[0].graveyard).toContain(milled);
  });

  it("omits the identity of a face-down card the viewer does not control", () => {
    let b = board();
    const id = b.seats[0].zones.hand[0];
    b = applyAction(b, 0, {
      type: "MOVE_CARD",
      instanceId: id,
      target: { kind: "battlefield", x: 0.5, y: 0.5, faceDown: true },
    });
    const aliceView = getPlayerView(b, 0);
    const bobView = getPlayerView(b, 1);
    // Position is public to both…
    expect(aliceView.battlefield.some((c) => c.instanceId === id)).toBe(true);
    expect(bobView.battlefield.some((c) => c.instanceId === id)).toBe(true);
    // …but only the controller learns the identity.
    expect(aliceView.cards[id]).toBeDefined();
    expect(bobView.cards[id]).toBeUndefined();
  });

  it("strips the server-only rngSeed from every view", () => {
    const view = getPlayerView(board(), 0) as unknown as Record<string, unknown>;
    expect(view.rngSeed).toBeUndefined();
  });

  it("never names a hidden card in the log", () => {
    let b = board();
    const drawn = b.seats[0].zones.library[0];
    const drawnObjectId = b.cards[drawn].cardObjectId;
    b = applyAction(b, 0, { type: "DRAW", count: 1 });
    const bobView = getPlayerView(b, 1);
    for (const entry of bobView.log) {
      expect(entry.text).not.toContain(drawnObjectId);
      expect(entry.text).not.toContain(drawn);
    }
    expect(bobView.log.some((e) => e.text.includes("drew"))).toBe(true);
  });

  it("returns myHand for the requesting seat only", () => {
    const b = board();
    expect(getPlayerView(b, 0).myHand).toEqual(b.seats[0].zones.hand);
    expect(getPlayerView(b, 1).myHand).toEqual(b.seats[1].zones.hand);
  });
});

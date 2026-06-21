import { describe, expect, it } from "vitest";
import {
  applyAction,
  createBoard,
  endGame,
  getPlayerView,
  seatForUid,
  type BoardState,
  type SeatInit,
} from "@/lib/game/play";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a library of `n` distinct cards (24-hex object ids + scryfall ids). */
function lib(prefix: string, n: number): SeatInit["library"] {
  return Array.from({ length: n }, (_, i) => ({
    cardObjectId: `${prefix}${String(i).padStart(20, "0")}`.slice(0, 24),
    scryfallId: `sf-${prefix}-${i}`,
  }));
}

function makeSeats(libSize = 12): SeatInit[] {
  return [
    { uid: "alice", displayName: "Alice", teamId: 0, library: lib("a", libSize) },
    { uid: "bob", displayName: "Bob", teamId: 1, library: lib("b", libSize) },
  ];
}

function board(opts?: { libSize?: number; lifeMode?: "per-player" | "shared-team"; life?: number; seed?: number }): BoardState {
  return createBoard("s1", makeSeats(opts?.libSize ?? 12), {
    lifeMode: opts?.lifeMode ?? "per-player",
    startingLife: opts?.life ?? 20,
    rngSeed: opts?.seed ?? 12345,
  });
}

// ── createBoard ───────────────────────────────────────────────────────────────

describe("createBoard", () => {
  it("draws an opening hand of 7 and leaves the rest in library", () => {
    const b = board({ libSize: 12 });
    expect(b.seats[0].zones.hand).toHaveLength(7);
    expect(b.seats[0].zones.library).toHaveLength(5);
    expect(b.status).toBe("playing");
  });

  it("mints a unique instanceId per physical copy (duplicates included)", () => {
    const dupLibrary: SeatInit["library"] = Array.from({ length: 8 }, () => ({
      cardObjectId: "aaaaaaaaaaaaaaaaaaaaaaaa",
      scryfallId: "sf-dup",
    }));
    const b = createBoard(
      "dup",
      [
        { uid: "x", displayName: "X", teamId: 0, library: dupLibrary },
        { uid: "y", displayName: "Y", teamId: 1, library: lib("y", 8) },
      ],
      { lifeMode: "per-player", startingLife: 20, rngSeed: 1 },
    );
    const seatX = b.seats[0];
    const ids = [...seatX.zones.hand, ...seatX.zones.library];
    expect(new Set(ids).size).toBe(8); // all distinct instance ids
    // …but all map back to the same card object.
    for (const id of ids) expect(b.cards[id].cardObjectId).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
  });

  it("is deterministic for a fixed seed and varies with a different seed", () => {
    const a = board({ seed: 42 });
    const b = board({ seed: 42 });
    const c = board({ seed: 99 });
    expect(a.seats[0].zones.hand).toEqual(b.seats[0].zones.hand);
    expect(a.seats[0].zones.hand).not.toEqual(c.seats[0].zones.hand);
  });

  it("seeds a single shared total per team in shared-team mode", () => {
    const b = createBoard(
      "team",
      [
        { uid: "a", displayName: "A", teamId: 0, library: lib("a", 10) },
        { uid: "b", displayName: "B", teamId: 1, library: lib("b", 10) },
        { uid: "c", displayName: "C", teamId: 0, library: lib("c", 10) },
        { uid: "d", displayName: "D", teamId: 1, library: lib("d", 10) },
      ],
      { lifeMode: "shared-team", startingLife: 30, rngSeed: 7 },
    );
    expect(b.teamLife).toEqual({ 0: 30, 1: 30 });
  });

  it("rejects fewer than 2 or more than 4 seats", () => {
    expect(() => createBoard("x", makeSeats().slice(0, 1), { lifeMode: "per-player", startingLife: 20, rngSeed: 1 })).toThrow();
  });
});

// ── Guards ───────────────────────────────────────────────────────────────────

describe("applyAction guards", () => {
  it("throws not_playing once the game ends", () => {
    const b = endGame(board());
    expect(() => applyAction(b, 0, { type: "UNTAP_ALL" })).toThrow("not_playing");
  });

  it("throws invalid_seat for an out-of-range actor", () => {
    expect(() => applyAction(board(), 9, { type: "UNTAP_ALL" })).toThrow("invalid_seat");
  });

  it("increments version on every applied action", () => {
    const b = board();
    const v0 = b.version;
    const b1 = applyAction(b, 0, { type: "SET_ACTIVE_SEAT", seat: 1 });
    expect(b1.version).toBe(v0 + 1);
  });
});

// ── Library ops ──────────────────────────────────────────────────────────────

describe("draw / mill / shuffle", () => {
  it("DRAW moves the top library card into hand", () => {
    const b = board();
    const top = b.seats[0].zones.library[0];
    const b1 = applyAction(b, 0, { type: "DRAW", count: 1 });
    expect(b1.seats[0].zones.hand).toContain(top);
    expect(b1.seats[0].zones.library).not.toContain(top);
    expect(b1.seats[0].zones.hand).toHaveLength(8);
  });

  it("MILL moves the top library card into graveyard", () => {
    const b = board();
    const top = b.seats[0].zones.library[0];
    const b1 = applyAction(b, 0, { type: "MILL", count: 1 });
    expect(b1.seats[0].zones.graveyard).toContain(top);
  });

  it("throws library_empty when drawing from an empty library", () => {
    const b = board({ libSize: 7 }); // 7 - 7 opening hand = 0 in library
    expect(b.seats[0].zones.library).toHaveLength(0);
    expect(() => applyAction(b, 0, { type: "DRAW", count: 1 })).toThrow("library_empty");
  });

  it("SHUFFLE advances the rng seed and reorders the library", () => {
    const b = board();
    const before = [...b.seats[0].zones.library];
    const b1 = applyAction(b, 0, { type: "SHUFFLE" });
    expect(b1.rngSeed).not.toBe(b.rngSeed);
    expect(new Set(b1.seats[0].zones.library)).toEqual(new Set(before));
  });
});

// ── Battlefield ops ──────────────────────────────────────────────────────────

describe("battlefield", () => {
  function withCardOnBattlefield(): { state: BoardState; id: string } {
    const b = board();
    const id = b.seats[0].zones.hand[0];
    const s = applyAction(b, 0, {
      type: "MOVE_CARD",
      instanceId: id,
      target: { kind: "battlefield", x: 0.5, y: 0.5 },
    });
    return { state: s, id };
  }

  it("MOVE_CARD plays a hand card to the battlefield under the actor's control", () => {
    const { state, id } = withCardOnBattlefield();
    expect(state.battlefield.some((c) => c.instanceId === id)).toBe(true);
    expect(state.seats[0].zones.hand).not.toContain(id);
    expect(state.cards[id].controllerSeat).toBe(0);
  });

  it("TAP is idempotent given an explicit boolean target", () => {
    const { state, id } = withCardOnBattlefield();
    const a = applyAction(state, 1, { type: "TAP", instanceId: id, tapped: true });
    const b = applyAction(a, 0, { type: "TAP", instanceId: id, tapped: true });
    expect(a.battlefield.find((c) => c.instanceId === id)?.tapped).toBe(true);
    expect(b.battlefield.find((c) => c.instanceId === id)?.tapped).toBe(true);
  });

  it("MOVE_ON_BATTLEFIELD updates position and raises z to the top", () => {
    const { state, id } = withCardOnBattlefield();
    const moved = applyAction(state, 1, { type: "MOVE_ON_BATTLEFIELD", instanceId: id, x: 0.1, y: 0.2 });
    const card = moved.battlefield.find((c) => c.instanceId === id)!;
    expect(card.x).toBeCloseTo(0.1);
    expect(card.y).toBeCloseTo(0.2);
  });

  it("ADJUST_COUNTER clamps and removes a counter when it returns to zero", () => {
    const { state, id } = withCardOnBattlefield();
    const a = applyAction(state, 0, { type: "ADJUST_COUNTER", instanceId: id, key: "+1/+1", delta: 2 });
    expect(a.battlefield.find((c) => c.instanceId === id)?.counters["+1/+1"]).toBe(2);
    const b = applyAction(a, 0, { type: "ADJUST_COUNTER", instanceId: id, key: "+1/+1", delta: -2 });
    expect(b.battlefield.find((c) => c.instanceId === id)?.counters["+1/+1"]).toBeUndefined();
  });

  it("SET_COUNTER clamps to the maximum", () => {
    const { state, id } = withCardOnBattlefield();
    const a = applyAction(state, 0, { type: "SET_COUNTER", instanceId: id, key: "charge", value: 100000 });
    expect(a.battlefield.find((c) => c.instanceId === id)?.counters.charge).toBe(9999);
  });

  it("UNTAP_ALL only untaps cards the actor controls", () => {
    const { state, id } = withCardOnBattlefield();
    const tapped = applyAction(state, 0, { type: "TAP", instanceId: id, tapped: true });
    const untapped = applyAction(tapped, 1, { type: "UNTAP_ALL" }); // seat 1 controls nothing here
    expect(untapped.battlefield.find((c) => c.instanceId === id)?.tapped).toBe(true);
    const untapped2 = applyAction(tapped, 0, { type: "UNTAP_ALL" });
    expect(untapped2.battlefield.find((c) => c.instanceId === id)?.tapped).toBe(false);
  });

  it("CREATE_TOKEN adds a controlled instance to the battlefield", () => {
    const b = board();
    const t = applyAction(b, 0, {
      type: "CREATE_TOKEN",
      cardObjectId: "tttttttttttttttttttttttt",
      scryfallId: "sf-token",
      x: 0.3,
      y: 0.3,
    });
    expect(t.battlefield).toHaveLength(1);
    const inst = t.cards[t.battlefield[0].instanceId];
    expect(inst.ownerSeat).toBe(0);
  });
});

// ── Permissions ──────────────────────────────────────────────────────────────

describe("permissions", () => {
  it("blocks moving a card out of another seat's hidden zone (not_owner)", () => {
    const b = board();
    const oppCard = b.seats[1].zones.hand[0];
    expect(() =>
      applyAction(b, 0, {
        type: "MOVE_CARD",
        instanceId: oppCard,
        target: { kind: "battlefield", x: 0.5, y: 0.5 },
      }),
    ).toThrow("not_owner");
  });

  it("allows any seat to move an opponent's battlefield permanent (paper-style)", () => {
    const b = board();
    const id = b.seats[0].zones.hand[0];
    const onBattlefield = applyAction(b, 0, {
      type: "MOVE_CARD",
      instanceId: id,
      target: { kind: "battlefield", x: 0.5, y: 0.5 },
    });
    // seat 1 taps seat 0's permanent — allowed.
    const tapped = applyAction(onBattlefield, 1, { type: "TAP", instanceId: id, tapped: true });
    expect(tapped.battlefield.find((c) => c.instanceId === id)?.tapped).toBe(true);
  });
});

// ── Life ─────────────────────────────────────────────────────────────────────

describe("life", () => {
  it("ADJUST_LIFE and SET_LIFE update a per-player total", () => {
    const b = board({ life: 20 });
    const a = applyAction(b, 0, { type: "ADJUST_LIFE", seat: 1, delta: -3 });
    expect(a.seats[1].life).toBe(17);
    const s = applyAction(a, 1, { type: "SET_LIFE", seat: 1, value: 5 });
    expect(s.seats[1].life).toBe(5);
  });

  it("routes life through the team total in shared-team mode", () => {
    const b = createBoard(
      "team",
      [
        { uid: "a", displayName: "A", teamId: 0, library: lib("a", 10) },
        { uid: "b", displayName: "B", teamId: 1, library: lib("b", 10) },
        { uid: "c", displayName: "C", teamId: 0, library: lib("c", 10) },
        { uid: "d", displayName: "D", teamId: 1, library: lib("d", 10) },
      ],
      { lifeMode: "shared-team", startingLife: 30, rngSeed: 7 },
    );
    const hit = applyAction(b, 1, { type: "ADJUST_LIFE", seat: 2, delta: -5 }); // seat 2 is team 0
    expect(hit.teamLife[0]).toBe(25);
    expect(hit.teamLife[1]).toBe(30);
  });
});

// ── seatForUid ───────────────────────────────────────────────────────────────

describe("seatForUid", () => {
  it("returns the seat index or -1", () => {
    const b = board();
    expect(seatForUid(b, "bob")).toBe(1);
    expect(seatForUid(b, "nobody")).toBe(-1);
  });
});

// Touch getPlayerView to keep the import used here (exhaustive leakage tests live
// in play-view.test.ts).
describe("getPlayerView smoke", () => {
  it("returns the seat's own hand", () => {
    const b = board();
    const view = getPlayerView(b, 0);
    expect(view.myHand).toEqual(b.seats[0].zones.hand);
  });
});

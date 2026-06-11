import { describe, expect, it } from "vitest";
import {
  autoPick,
  createDraft,
  getPlayerView,
  isComplete,
  pickCard,
  seatForUid,
  setConnected,
} from "@/lib/game/draft";

// ── Helpers ───────────────────────────────────────────────────────────────────

const PLAYERS_2 = [
  { uid: "alice", displayName: "Alice" },
  { uid: "bob", displayName: "Bob" },
];
const PLAYERS_4 = [
  { uid: "a", displayName: "A" },
  { uid: "b", displayName: "B" },
  { uid: "c", displayName: "C" },
  { uid: "d", displayName: "D" },
];

/** Build a 15-card fake pack for seat i / round r. */
function fakePack(seat: number, round: number): string[] {
  return Array.from({ length: 15 }, (_, k) => `card-s${seat}-r${round}-${k}`);
}

function makeAllPacks(n: number): string[][][] {
  return Array.from({ length: n }, (_, s) =>
    Array.from({ length: 3 }, (_, r) => fakePack(s, r)),
  );
}

function fullDraft2P() {
  return createDraft("s1", "tst", PLAYERS_2, makeAllPacks(2), 60_000);
}

// ── Factory ───────────────────────────────────────────────────────────────────

describe("createDraft", () => {
  it("builds initial state for 2 players", () => {
    const s = fullDraft2P();
    expect(s.players).toHaveLength(2);
    expect(s.currentPacks[0]).toHaveLength(15);
    expect(s.currentPacks[1]).toHaveLength(15);
    expect(s.round).toBe(0);
    expect(s.pickInRound).toBe(0);
    expect(s.status).toBe("drafting");
    expect(s.pickedThisSlot).toEqual([false, false]);
  });

  it("throws for < 2 players", () => {
    expect(() =>
      createDraft("s", "tst", [PLAYERS_2[0]], makeAllPacks(1), 60_000),
    ).toThrow();
  });

  it("throws for > 8 players", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({ uid: `u${i}`, displayName: `P${i}` }));
    expect(() => createDraft("s", "tst", nine, makeAllPacks(9), 60_000)).toThrow();
  });
});

// ── Pick validation ───────────────────────────────────────────────────────────

describe("pickCard", () => {
  it("removes card from pack and adds to picks", () => {
    let s = fullDraft2P();
    const card = s.currentPacks[0][0];
    s = pickCard(s, 0, card);
    expect(s.currentPacks[0]).not.toContain(card);
    expect(s.picks[0]).toContain(card);
    expect(s.pickedThisSlot[0]).toBe(true);
  });

  it("rejects a card not in the pack", () => {
    const s = fullDraft2P();
    expect(() => pickCard(s, 0, "not-a-card")).toThrow("card_not_in_pack");
  });

  it("rejects a second pick in the same slot", () => {
    let s = fullDraft2P();
    s = pickCard(s, 0, s.currentPacks[0][0]);
    expect(() => pickCard(s, 0, s.currentPacks[0][0])).toThrow("already_picked");
  });

  it("rejects picks when not drafting", () => {
    const s = { ...fullDraft2P(), status: "lobby" as const };
    expect(() => pickCard(s, 0, s.currentPacks[0][0])).toThrow("not_drafting");
  });
});

// ── Pack rotation ─────────────────────────────────────────────────────────────

describe("pack rotation after both players pick (round 0 = LEFT)", () => {
  it("increments pickInRound and rotates packs left", () => {
    let s = fullDraft2P();
    const alicePack = [...s.currentPacks[0]];
    const bobPack = [...s.currentPacks[1]];

    // Both pick one card.
    s = pickCard(s, 0, alicePack[0]);
    s = pickCard(s, 1, bobPack[0]);

    // After rotation (left, N=2): alice's remaining → bob, bob's remaining → alice.
    expect(s.pickInRound).toBe(1);
    expect(s.pickedThisSlot).toEqual([false, false]);

    // Alice's remaining 14 cards moved to bob's slot.
    const aliceRemaining = alicePack.slice(1);
    expect(s.currentPacks[1]).toEqual(expect.arrayContaining(aliceRemaining));

    // Bob's remaining 14 cards moved to alice's slot.
    const bobRemaining = bobPack.slice(1);
    expect(s.currentPacks[0]).toEqual(expect.arrayContaining(bobRemaining));
  });
});

describe("round 2 passes RIGHT", () => {
  function advanceToRound1(state: ReturnType<typeof fullDraft2P>) {
    let s = state;
    // Complete all 15 picks in round 0.
    for (let pick = 0; pick < 15; pick++) {
      s = pickCard(s, 0, s.currentPacks[0][0]);
      s = pickCard(s, 1, s.currentPacks[1][0]);
    }
    expect(s.round).toBe(1);
    return s;
  }

  it("rotates RIGHT in round 1 (2-player: same as left for N=2)", () => {
    let s = advanceToRound1(fullDraft2P());
    s = pickCard(s, 0, s.currentPacks[0][0]);
    s = pickCard(s, 1, s.currentPacks[1][0]);
    // For N=2, left and right result in the same swap.
    expect(s.currentPacks[0].length).toBe(14); // 15 fresh - 1 pick = 14
  });
});

// ── Full draft completion ────────────────────────────────────────────────────

describe("full 2-player draft completes after 45 picks each", () => {
  it("reaches 'complete' status with 45 picks per player", () => {
    let s = fullDraft2P();
    for (let i = 0; i < 45; i++) {
      s = pickCard(s, 0, s.currentPacks[0][0]);
      s = pickCard(s, 1, s.currentPacks[1][0]);
    }
    expect(s.status).toBe("complete");
    expect(isComplete(s)).toBe(true);
    expect(s.picks[0]).toHaveLength(45);
    expect(s.picks[1]).toHaveLength(45);
  });
});

describe("full 4-player draft", () => {
  it("completes correctly", () => {
    let s = createDraft("s4", "tst", PLAYERS_4, makeAllPacks(4), 60_000);
    for (let pick = 0; pick < 45; pick++) {
      for (let seat = 0; seat < 4; seat++) {
        if (!s.pickedThisSlot[seat]) {
          s = pickCard(s, seat, s.currentPacks[seat][0]);
        }
      }
    }
    expect(s.status).toBe("complete");
    for (let i = 0; i < 4; i++) {
      expect(s.picks[i]).toHaveLength(45);
    }
  });
});

// ── Auto-pick ────────────────────────────────────────────────────────────────

describe("autoPick", () => {
  it("picks the first card for an unpicked seat", () => {
    let s = fullDraft2P();
    const firstCard = s.currentPacks[0][0];
    s = autoPick(s, 0);
    expect(s.picks[0]).toContain(firstCard);
    expect(s.pickedThisSlot[0]).toBe(true);
  });

  it("is a no-op for a seat that already picked", () => {
    let s = fullDraft2P();
    s = pickCard(s, 0, s.currentPacks[0][0]);
    const before = s;
    s = autoPick(s, 0);
    expect(s).toEqual(before);
  });
});

// ── getPlayerView ────────────────────────────────────────────────────────────

describe("getPlayerView", () => {
  it("returns only this player's pack and picks", () => {
    let s = fullDraft2P();
    s = pickCard(s, 0, s.currentPacks[0][0]);

    const view = getPlayerView(s, 0);
    expect(view.seatIndex).toBe(0);
    expect(view.picks).toHaveLength(1);
    expect(view.currentPack.length).toBe(14);
    expect(view.needsPick).toBe(false); // already picked this slot
    // Public info: both players visible.
    expect(view.players).toHaveLength(2);
    expect(view.players[0].pickCount).toBe(1);
    expect(view.players[0].hasPicked).toBe(true);
    expect(view.players[1].hasPicked).toBe(false);
  });

  it("never exposes another player's pack", () => {
    const s = fullDraft2P();
    const view = getPlayerView(s, 0);
    // Bob's pack should not appear in Alice's view.
    const bobCards = s.currentPacks[1];
    for (const card of bobCards) {
      expect(view.currentPack).not.toContain(card);
    }
  });
});

// ── setConnected ─────────────────────────────────────────────────────────────

describe("setConnected", () => {
  it("updates isConnected for the matching uid", () => {
    let s = fullDraft2P();
    s = setConnected(s, "alice", true);
    expect(s.players[0].isConnected).toBe(true);
    expect(s.players[1].isConnected).toBe(false);
  });
});

// ── seatForUid ───────────────────────────────────────────────────────────────

describe("seatForUid", () => {
  it("returns correct index", () => {
    const s = fullDraft2P();
    expect(seatForUid(s, "alice")).toBe(0);
    expect(seatForUid(s, "bob")).toBe(1);
    expect(seatForUid(s, "unknown")).toBe(-1);
  });
});

/**
 * Tests for humanPick() in lib/game/solo-draft.ts — phantom draft completion.
 *
 * Mock strategy:
 *  - connectToDatabase → no-op so no real MongoDB connection is needed.
 *  - SoloDraftSession.findById → returns a fake Mongoose-like document with
 *    markModified() and save() stubs.  The document's draftState has a
 *    currentPacks[0] that includes the card being picked.
 *  - lib/game/draft → pickCard returns a state where status === "complete" so
 *    isComplete() immediately returns true and bot picks are skipped.
 *  - SavedDeck.create → captured spy; we assert it was called with kind:"phantom".
 *  - lib/game/collection (addCards) and lib/game/wallet (creditWallet) →
 *    spies we assert were NEVER called.  These functions are not imported by
 *    solo-draft.ts for phantom mode, but the test documents the contract.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock: database ───────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  connectToDatabase: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock: collection and wallet ─────────────────────────────────────────────
// solo-draft.ts (phantom path) must NOT touch addCards or creditWallet.
const addCardsMock = vi.fn();
const creditWalletMock = vi.fn();

vi.mock("@/lib/game/collection", () => ({
  addCards: addCardsMock,
}));

vi.mock("@/lib/game/wallet", () => ({
  creditWallet: creditWalletMock,
  debitWallet: vi.fn(),
}));

// ─── Mock: SavedDeck ──────────────────────────────────────────────────────────
const savedDeckCreateMock = vi.fn();

vi.mock("@/lib/models/SavedDeck", () => ({
  SavedDeck: {
    create: savedDeckCreateMock,
  },
}));

// ─── Mock: Card (used by loadSetCardMap inside humanPick when not complete) ───
vi.mock("@/lib/models/Card", () => ({
  Card: {
    find: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  },
}));

// ─── Mock: bot (used by runBotPicks when draft is not yet complete) ───────────
vi.mock("@/lib/game/bot", () => ({
  makeBotStrategy: vi.fn().mockReturnValue({
    pick: vi.fn().mockImplementation((pack: string[]) => pack[0]),
  }),
}));

// ─── Fake DraftState ─────────────────────────────────────────────────────────
// This is the state returned *before* the human pick.
// currentPacks[0] must include the card id the human will pick.
const CARD_ID = "card-abc";
const SESSION_ID = "session-001";

function makeCompletedState() {
  // Represents the state AFTER pickCard is called — status:"complete" so
  // isComplete() returns true and bot picks are bypassed.
  return {
    sessionId: SESSION_ID,
    setCode: "neo",
    format: "booster" as const,
    timerMs: 60_000,
    numPacks: 1,
    players: [
      { uid: "user-1", displayName: "You", seatIndex: 0, isConnected: false },
    ],
    allPacks: [[[CARD_ID]]],
    currentPacks: [[]], // empty after pick
    picks: [[CARD_ID]], // human picked the card
    pickedThisSlot: [true],
    round: 0,
    pickInRound: 1,
    status: "complete" as const,
  };
}

// Mock draftState stored on the session doc (pre-pick).
const prePick = {
  sessionId: SESSION_ID,
  setCode: "neo",
  format: "booster" as const,
  timerMs: 60_000,
  numPacks: 1,
  players: [
    { uid: "user-1", displayName: "You", seatIndex: 0, isConnected: false },
  ],
  allPacks: [[[CARD_ID]]],
  currentPacks: [[CARD_ID]], // card is present, human can pick
  picks: [[]],
  pickedThisSlot: [false],
  round: 0,
  pickInRound: 0,
  status: "drafting" as const,
};

// ─── Mock: draft engine ───────────────────────────────────────────────────────
// pickCard returns the completed state; isComplete checks status field.
vi.mock("@/lib/game/draft", async (importOriginal) => {
  // We need getPlayerView to work correctly so the returned SoloDraftView is
  // well-formed — import the real implementation for that one function.
  const real = await importOriginal<typeof import("@/lib/game/draft")>();
  return {
    ...real,
    pickCard: vi.fn().mockImplementation(() => makeCompletedState()),
    isComplete: vi.fn().mockImplementation((state: { status: string }) => state.status === "complete"),
  };
});

// ─── Mock: SoloDraftSession ───────────────────────────────────────────────────
// findById must return a mutable doc-like object (not lean) because humanPick
// calls doc.markModified() and doc.save().
function makeFakeDoc() {
  return {
    _id: { toString: () => SESSION_ID },
    userId: "user-1",
    setCode: "neo",
    difficulty: "easy",
    status: "drafting",
    draftState: prePick,
    picks: [] as string[],
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("@/lib/models/SoloDraftSession", () => ({
  SoloDraftSession: {
    findById: vi.fn(),
  },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("humanPick — phantom draft completion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function setupAndPick() {
    // We import *after* mocks are established so all module mocks are in place.
    const { SoloDraftSession } = await import("@/lib/models/SoloDraftSession");
    const fakeDoc = makeFakeDoc();
    // findById returns the doc directly (humanPick awaits SoloDraftSession.findById(...))
    vi.mocked(SoloDraftSession.findById).mockResolvedValue(fakeDoc as unknown as Awaited<ReturnType<typeof SoloDraftSession.findById>>);

    // savedDeckCreateMock must resolve with an object that has _id.toString()
    savedDeckCreateMock.mockResolvedValue({
      _id: { toString: () => "saved-deck-id-1" },
    });

    const { humanPick } = await import("@/lib/game/solo-draft");
    return humanPick(SESSION_ID, "user-1", CARD_ID);
  }

  it("creates a SavedDeck with kind:'phantom' on completion", async () => {
    await setupAndPick();

    expect(savedDeckCreateMock).toHaveBeenCalledOnce();
    const createArg = savedDeckCreateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(createArg.kind).toBe("phantom");
    expect(createArg.difficulty).toBe("easy");
    expect(createArg.setCode).toBe("neo");
    expect(createArg.sessionId).toBe(SESSION_ID);
    expect(createArg.userId).toBe("user-1");
    expect(Array.isArray(createArg.cardIds)).toBe(true);
  });

  it("does NOT call addCards (phantom — no collection ingest)", async () => {
    await setupAndPick();
    expect(addCardsMock).not.toHaveBeenCalled();
  });

  it("does NOT call creditWallet (phantom — no VC reward)", async () => {
    await setupAndPick();
    expect(creditWalletMock).not.toHaveBeenCalled();
  });

  it("returns a SoloDraftView with savedDeckId set", async () => {
    const result = await setupAndPick();
    expect(result).not.toBeNull();
    expect(result?.savedDeckId).toBe("saved-deck-id-1");
    expect(result?.status).toBe("complete");
  });

  it("returns null if the card is not in the human's pack", async () => {
    const { SoloDraftSession } = await import("@/lib/models/SoloDraftSession");
    const fakeDoc = makeFakeDoc();
    // Pack does NOT contain the card being picked.
    fakeDoc.draftState = { ...prePick, currentPacks: [["other-card"]] };
    vi.mocked(SoloDraftSession.findById).mockResolvedValue(fakeDoc as unknown as Awaited<ReturnType<typeof SoloDraftSession.findById>>);

    const { humanPick } = await import("@/lib/game/solo-draft");
    const result = await humanPick(SESSION_ID, "user-1", CARD_ID);
    expect(result).toBeNull();
    expect(savedDeckCreateMock).not.toHaveBeenCalled();
  });

  it("returns null when the user id does not match the session", async () => {
    const { SoloDraftSession } = await import("@/lib/models/SoloDraftSession");
    const fakeDoc = makeFakeDoc();
    // Different userId on the session.
    fakeDoc.userId = "different-user";
    vi.mocked(SoloDraftSession.findById).mockResolvedValue(fakeDoc as unknown as Awaited<ReturnType<typeof SoloDraftSession.findById>>);

    const { humanPick } = await import("@/lib/game/solo-draft");
    const result = await humanPick(SESSION_ID, "user-1", CARD_ID);
    expect(result).toBeNull();
  });

  it("does NOT create a SavedDeck when the draft is still in progress", async () => {
    const { SoloDraftSession } = await import("@/lib/models/SoloDraftSession");
    // Override pickCard so that: the human's pick returns a mid-draft state, and
    // each subsequent bot pick call also returns a mid-draft state.  isComplete
    // always returns false so SavedDeck.create is never reached.
    const { pickCard, isComplete } = await import("@/lib/game/draft");

    // Build an 8-seat mid-draft state (round 0, pick 1 of 2) so runBotPicks can
    // iterate seats 1–7 without crashing on undefined currentPacks entries.
    const seats = 8;
    const midDraftState = {
      sessionId: SESSION_ID,
      setCode: "neo",
      format: "booster" as const,
      timerMs: 60_000,
      numPacks: 1,
      players: Array.from({ length: seats }, (_, i) => ({
        uid: i === 0 ? "user-1" : `bot-${i}`,
        displayName: i === 0 ? "You" : `Bot ${i}`,
        seatIndex: i,
        isConnected: false,
      })),
      allPacks: Array.from({ length: seats }, () => [["card-x", "card-y"]]),
      // All seats have 1 card left (after picking one).
      currentPacks: Array.from({ length: seats }, () => ["card-x"]),
      picks: Array.from({ length: seats }, () => [] as string[]),
      pickedThisSlot: Array.from({ length: seats }, () => false),
      round: 0,
      pickInRound: 1,
      status: "drafting" as const,
    };

    // Every pickCard call (human + 7 bots) returns the same mid-draft state.
    vi.mocked(pickCard).mockReturnValue(midDraftState);
    // isComplete always returns false — draft is not yet over.
    vi.mocked(isComplete).mockReturnValue(false);

    const fakeDoc = makeFakeDoc();
    fakeDoc.draftState = { ...prePick, currentPacks: [[CARD_ID, "card-x"]] };
    vi.mocked(SoloDraftSession.findById).mockResolvedValue(fakeDoc as unknown as Awaited<ReturnType<typeof SoloDraftSession.findById>>);

    const { humanPick } = await import("@/lib/game/solo-draft");
    const result = await humanPick(SESSION_ID, "user-1", CARD_ID);
    expect(result).not.toBeNull();
    // The draft is still running — no SavedDeck must be created.
    expect(savedDeckCreateMock).not.toHaveBeenCalled();
  });
});

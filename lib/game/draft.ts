/**
 * Pure draft engine — zero I/O. All functions are deterministic given the
 * same state, which makes them trivially unit-testable. The Socket.io server
 * in server/draft/ is a thin stateful adapter on top of these functions.
 *
 * Booster draft rules:
 *  - 2–8 players seated in a circle.
 *  - numPacks rounds × 15 cards = numPacks×15 picks per player (1–5 rounds).
 *  - Even-indexed rounds (0, 2, 4): pass LEFT  (seat i → seat (i+1) % N).
 *  - Odd-indexed rounds  (1, 3)   : pass RIGHT (seat i → seat (i-1+N) % N).
 *  - All players pick simultaneously; packs rotate after every player picks.
 *  - Auto-pick: if a player's timer expires, pick the first card in their pack.
 */

export type DraftStatus = "lobby" | "drafting" | "complete";

export interface DraftPlayer {
  uid: string;
  displayName: string;
  seatIndex: number;
  isConnected: boolean;
}

export interface DraftState {
  sessionId: string;
  setCode: string;
  format: "booster";
  timerMs: number;

  /** Number of booster rounds per player (1–5). Default 3. */
  numPacks: number;

  players: DraftPlayer[];

  /** allPacks[seatIndex][round] = original 15 card-id strings for that seat/round. */
  allPacks: string[][][];

  /** currentPacks[seatIndex] = cards currently in front of that seat (to pick from). */
  currentPacks: string[][];

  /** picks[seatIndex] = cards picked by that seat, in pick order. */
  picks: string[][];

  /** Whether seat i has already picked in the current slot. */
  pickedThisSlot: boolean[];

  /** 0-indexed round (0 … numPacks-1). */
  round: number;

  /** 0-indexed pick within the current round (0..14). */
  pickInRound: number;

  status: DraftStatus;
}

/** Per-player view — the server sends THIS, never the full DraftState. */
export interface PlayerView {
  seatIndex: number;
  currentPack: string[];
  picks: string[];
  round: number;
  pickInRound: number;
  numPacks: number;
  status: DraftStatus;
  needsPick: boolean;
  players: Array<{
    uid: string;
    displayName: string;
    seatIndex: number;
    isConnected: boolean;
    pickCount: number;
    hasPicked: boolean;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pass direction: +1 = left (even rounds 0,2,4), −1 = right (odd rounds 1,3). */
function passDir(round: number): 1 | -1 {
  return round % 2 === 0 ? 1 : -1;
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

const PACK_SIZE = 15;

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createDraft(
  sessionId: string,
  setCode: string,
  players: { uid: string; displayName: string }[],
  allPacks: string[][][],
  timerMs: number,
  numPacks = 3,
): DraftState {
  const n = players.length;
  if (n < 2 || n > 8) throw new Error("draft requires 2–8 players");
  if (numPacks < 1 || numPacks > 5) throw new Error("numPacks must be 1–5");
  if (allPacks.length !== n || allPacks.some((p) => p.length !== numPacks))
    throw new Error(`allPacks must be [N][${numPacks}][${PACK_SIZE}]`);

  return {
    sessionId,
    setCode,
    format: "booster",
    timerMs,
    numPacks,
    players: players.map((p, i) => ({
      uid: p.uid,
      displayName: p.displayName,
      seatIndex: i,
      isConnected: false,
    })),
    allPacks,
    currentPacks: allPacks.map((playerPacks) => [...playerPacks[0]]),
    picks: Array.from({ length: n }, () => []),
    pickedThisSlot: Array.from({ length: n }, () => false),
    round: 0,
    pickInRound: 0,
    status: "drafting",
  };
}

// ─── Mutations (return new state, never mutate in place) ───────────────────────

/** Validate and apply a card pick. Returns the new state. */
export function pickCard(
  state: DraftState,
  seatIndex: number,
  cardId: string,
): DraftState {
  if (state.status !== "drafting") throw new Error("not_drafting");
  if (seatIndex < 0 || seatIndex >= state.players.length)
    throw new Error("invalid_seat");
  if (state.pickedThisSlot[seatIndex]) throw new Error("already_picked");
  if (!state.currentPacks[seatIndex].includes(cardId))
    throw new Error("card_not_in_pack");

  const newCurrentPacks = state.currentPacks.map((pack, i) =>
    i === seatIndex ? pack.filter((c) => c !== cardId) : [...pack],
  );
  const newPicks = state.picks.map((p, i) =>
    i === seatIndex ? [...p, cardId] : [...p],
  );
  const newPickedThisSlot = state.pickedThisSlot.map((v, i) =>
    i === seatIndex ? true : v,
  );

  const next: DraftState = {
    ...state,
    currentPacks: newCurrentPacks,
    picks: newPicks,
    pickedThisSlot: newPickedThisSlot,
  };

  return newPickedThisSlot.every(Boolean) ? _advanceSlot(next) : next;
}

/** Auto-pick the first card in a seat's pack (timer expiry). */
export function autoPick(state: DraftState, seatIndex: number): DraftState {
  if (state.pickedThisSlot[seatIndex]) return state;
  const card = state.currentPacks[seatIndex][0];
  if (!card) return state;
  return pickCard(state, seatIndex, card);
}

/** Mark a player as connected / disconnected (does not affect pick logic). */
export function setConnected(
  state: DraftState,
  uid: string,
  connected: boolean,
): DraftState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.uid === uid ? { ...p, isConnected: connected } : p,
    ),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Returns the view a single seat is allowed to see. */
export function getPlayerView(
  state: DraftState,
  seatIndex: number,
): PlayerView {
  return {
    seatIndex,
    currentPack: [...state.currentPacks[seatIndex]],
    picks: [...state.picks[seatIndex]],
    round: state.round,
    pickInRound: state.pickInRound,
    numPacks: state.numPacks ?? 3,
    status: state.status,
    needsPick: !state.pickedThisSlot[seatIndex],
    players: state.players.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      seatIndex: p.seatIndex,
      isConnected: p.isConnected,
      pickCount: state.picks[p.seatIndex].length,
      hasPicked: state.pickedThisSlot[p.seatIndex],
    })),
  };
}

export function isComplete(state: DraftState): boolean {
  return state.status === "complete";
}

export function seatForUid(state: DraftState, uid: string): number {
  return state.players.findIndex((p) => p.uid === uid);
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _advanceSlot(state: DraftState): DraftState {
  const n = state.players.length;
  const newPickInRound = state.pickInRound + 1;
  const newPickedThisSlot = Array.from({ length: n }, () => false);
  const numPacks = state.numPacks ?? 3;

  if (newPickInRound === PACK_SIZE) {
    // Round complete.
    const newRound = state.round + 1;
    if (newRound === numPacks) {
      return { ...state, pickInRound: PACK_SIZE, pickedThisSlot: newPickedThisSlot, status: "complete" };
    }
    // Open the next round's fresh packs.
    const freshPacks = state.allPacks.map((playerPacks) => [...playerPacks[newRound]]);
    return {
      ...state,
      currentPacks: freshPacks,
      pickedThisSlot: newPickedThisSlot,
      round: newRound,
      pickInRound: 0,
    };
  }

  // Rotate remaining packs in the current round's direction.
  const dir = passDir(state.round);
  const rotated = new Array<string[]>(n);
  for (let i = 0; i < n; i++) {
    rotated[wrap(i + dir, n)] = [...state.currentPacks[i]];
  }

  return {
    ...state,
    currentPacks: rotated,
    pickedThisSlot: newPickedThisSlot,
    pickInRound: newPickInRound,
  };
}

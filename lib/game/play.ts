/**
 * Pure virtual-tabletop engine — zero I/O. Deterministic given the same state
 * and action, which makes it trivially unit-testable. The Socket.io server in
 * server/play/ is a thin stateful adapter on top of these functions.
 *
 * The software enforces NO Magic rules: no stack, no triggers, no
 * state-based actions. Players move cards by agreement, exactly like sitting
 * across a physical table. The engine only:
 *   - keeps an authoritative, leakage-safe board,
 *   - applies explicit, idempotent actions,
 *   - and computes a per-seat view that never leaks hidden information.
 *
 * Every physical copy of a card gets a unique `instanceId` at board build so
 * duplicates (a deck's 4-of) are individually addressable. Zones store
 * `instanceId[]`, never card ids — moving a card is an instance-id splice
 * between ordered arrays.
 */

import { type Phase, FIRST_PHASE } from "./phases";

// ─── Types ─────────────────────────────────────────────────────────────────

export type PlayStatus = "lobby" | "playing" | "ended";
export type LifeMode = "per-player" | "shared-team";

export type Zone = "hand" | "library" | "graveyard" | "exile" | "command";
export const ZONES: readonly Zone[] = ["hand", "library", "graveyard", "exile", "command"];

export type BattlefieldZone = "creatures" | "other" | "lands";
export const BATTLEFIELD_ZONES: readonly BattlefieldZone[] = ["creatures", "other", "lands"];

/** Hidden zones are private to their owner; public zones are visible to all. */
const HIDDEN_ZONES: readonly Zone[] = ["hand", "library"];

export interface CardInstance {
  instanceId: string;
  cardObjectId: string;
  scryfallId: string;
  ownerSeat: number;
  controllerSeat: number;
}

export interface BattlefieldCard {
  instanceId: string;
  x: number; // deprecated in Phase 1+ but kept for backwards compat
  y: number; // deprecated in Phase 1+ but kept for backwards compat
  z: number; // deprecated in Phase 1+ but kept for backwards compat
  zone: BattlefieldZone; // NEW: which row (creatures/other/lands)
  order: number; // NEW: sort order within zone
  tapped: boolean;
  faceDown: boolean;
  /** DFC / transform toggle — back face shown when true. */
  flipped: boolean;
  /** Upside down — shows cardback.webp rotated 180°; distinct from faceDown. */
  upsideDown?: boolean;
  counters: Record<string, number>;
}

export interface PlayerZones {
  hand: string[];
  library: string[];
  graveyard: string[];
  exile: string[];
  command: string[];
}

export interface SeatState {
  seat: number;
  uid: string;
  displayName: string;
  teamId: number;
  life: number;
  zones: PlayerZones;
  connected: boolean;
}

export interface LogEntry {
  /** Equals the board version at which the entry was appended (ordering key). */
  seq: number;
  seat: number;
  /** Opponent-safe text — never names a hidden card. */
  text: string;
}

export interface BoardState {
  sessionId: string;
  status: PlayStatus;
  lifeMode: LifeMode;
  /** teamId → shared life (only meaningful when lifeMode === "shared-team"). */
  teamLife: Record<number, number>;
  seats: SeatState[];
  /** Every instance currently in the game, keyed by instanceId. */
  cards: Record<string, CardInstance>;
  /** Shared free 2D area. */
  battlefield: BattlefieldCard[];
  /** Soft turn marker — no enforcement. */
  activeSeat: number | null;
  /** Advisory turn phase, shared by all seats — no enforcement. */
  phase: Phase;
  /** Ring buffer of opponent-safe log lines. */
  log: LogEntry[];
  /** Server-only PRNG state — stripped from every view. */
  rngSeed: number;
  /** Increments on every applied action (used for client reconciliation). */
  version: number;
}

/** A position to drop a card into a zone or onto the battlefield. */
export type MoveTarget =
  | { kind: "zone"; zone: Zone; toSeat: number; position: "top" | "bottom" }
  | { kind: "battlefield"; x?: number; y?: number; faceDown?: boolean; zone?: BattlefieldZone };

export type BoardAction =
  | { type: "MOVE_ON_BATTLEFIELD"; instanceId: string; x: number; y: number }
  | { type: "REORDER_ZONE"; zone: BattlefieldZone; newOrder: string[] }
  | { type: "SET_ZONE"; instanceId: string; zone: BattlefieldZone }
  | { type: "TAP"; instanceId: string; tapped: boolean }
  | { type: "FLIP"; instanceId: string; faceDown: boolean }
  | { type: "FLIP_UPSIDE_DOWN"; instanceId: string; upsideDown: boolean }
  | { type: "TRANSFORM"; instanceId: string; flipped: boolean }
  | { type: "SET_COUNTER"; instanceId: string; key: string; value: number }
  | { type: "ADJUST_COUNTER"; instanceId: string; key: string; delta: number }
  | { type: "MOVE_CARD"; instanceId: string; target: MoveTarget }
  | { type: "DRAW"; count: number }
  | { type: "MILL"; count: number }
  | { type: "SHUFFLE" }
  | { type: "SCRY_REORDER"; order: string[] }
  | { type: "REVEAL"; instanceId: string }
  | { type: "CREATE_TOKEN"; cardObjectId: string; scryfallId: string; x: number; y: number }
  | { type: "SET_LIFE"; seat: number; value: number }
  | { type: "ADJUST_LIFE"; seat: number; delta: number }
  | { type: "SET_ACTIVE_SEAT"; seat: number | null }
  | { type: "SET_PHASE"; phase: Phase }
  | { type: "PASS_TURN" }
  | { type: "UNTAP_ALL" }
  | { type: "MULLIGAN" };

/** Typed errors thrown by applyAction; the adapter maps these to ack errors. */
export type PlayError =
  | "not_playing"
  | "invalid_seat"
  | "invalid_instance"
  | "not_owner"
  | "library_empty"
  | "invalid_action"
  | "invalid_counter";

// ─── View types (what a seat is allowed to see) ──────────────────────────────

export interface ViewCardInstance {
  instanceId: string;
  cardObjectId: string;
  scryfallId: string;
  ownerSeat: number;
  controllerSeat: number;
}

export interface PublicSeatView {
  seat: number;
  uid: string;
  displayName: string;
  teamId: number;
  life: number;
  connected: boolean;
  handCount: number;
  libraryCount: number;
  /** Public zones — instance ids visible to everyone. */
  graveyard: string[];
  exile: string[];
  command: string[];
}

export interface PlayerBoardView {
  sessionId: string;
  status: PlayStatus;
  lifeMode: LifeMode;
  teamLife: Record<number, number>;
  activeSeat: number | null;
  phase: Phase;
  version: number;
  mySeat: number;
  seats: PublicSeatView[];
  battlefield: BattlefieldCard[];
  /** Only identities this seat is allowed to know. */
  cards: Record<string, ViewCardInstance>;
  /** Instance ids in this seat's own hand (ordered). */
  myHand: string[];
  log: LogEntry[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OPENING_HAND = 7;
const LOG_LIMIT = 120;
const MAX_COUNTER = 9999;
const MIN_COUNTER = -9999;

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

interface Rng {
  next: () => number;
  state: () => number;
}

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state() {
      return s >>> 0;
    },
  };
}

/** Fisher–Yates using the provided Rng (mutates a copy, returns it). */
function shuffleInPlace<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function seatForUid(state: BoardState, uid: string): number {
  return state.seats.findIndex((s) => s.uid === uid);
}

function fail(error: PlayError): never {
  throw new Error(error);
}

function requireInstance(state: BoardState, instanceId: string): CardInstance {
  const inst = state.cards[instanceId];
  if (!inst) fail("invalid_instance");
  return inst;
}

/** Where is this instance right now? Returns its zone or "battlefield". */
function locate(
  state: BoardState,
  instanceId: string,
): { kind: "zone"; seat: number; zone: Zone } | { kind: "battlefield" } | null {
  if (state.battlefield.some((b) => b.instanceId === instanceId)) {
    return { kind: "battlefield" };
  }
  for (const seat of state.seats) {
    for (const zone of ZONES) {
      if (seat.zones[zone].includes(instanceId)) {
        return { kind: "zone", seat: seat.seat, zone };
      }
    }
  }
  return null;
}

function appendLog(state: BoardState, seat: number, text: string): LogEntry[] {
  const next: LogEntry[] = [...state.log, { seq: state.version + 1, seat, text }];
  return next.length > LOG_LIMIT ? next.slice(next.length - LOG_LIMIT) : next;
}

function displayName(state: BoardState, seat: number): string {
  return state.seats[seat]?.displayName || `Seat ${seat + 1}`;
}

function clampCounter(v: number): number {
  return Math.max(MIN_COUNTER, Math.min(MAX_COUNTER, Math.round(v)));
}

/** Shallow-clone the seats array with one seat replaced. */
function withSeat(state: BoardState, seat: number, next: SeatState): SeatState[] {
  return state.seats.map((s) => (s.seat === seat ? next : s));
}

/** Remove an instance from wherever it lives (zone or battlefield). */
function removeFromCurrent(
  state: BoardState,
  instanceId: string,
): { seats: SeatState[]; battlefield: BattlefieldCard[]; removed: BattlefieldCard | null } {
  let removed: BattlefieldCard | null = null;
  const battlefield = state.battlefield.filter((b) => {
    if (b.instanceId === instanceId) {
      removed = b;
      return false;
    }
    return true;
  });
  const seats = state.seats.map((s) => {
    let changed = false;
    const zones: PlayerZones = { ...s.zones };
    for (const zone of ZONES) {
      if (zones[zone].includes(instanceId)) {
        zones[zone] = zones[zone].filter((id) => id !== instanceId);
        changed = true;
      }
    }
    return changed ? { ...s, zones } : s;
  });
  return { seats, battlefield, removed };
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export interface SeatInit {
  uid: string;
  displayName: string;
  teamId: number;
  /** Ordered starting library (already expanded by quantity). */
  library: { cardObjectId: string; scryfallId: string }[];
}

export interface CreateBoardOpts {
  lifeMode: LifeMode;
  startingLife: number;
  rngSeed: number;
}

/**
 * Build the initial board: mint a CardInstance per library entry, seeded-shuffle
 * each library, draw an opening hand of 7. The board is left in "playing".
 */
export function createBoard(
  sessionId: string,
  seats: SeatInit[],
  opts: CreateBoardOpts,
): BoardState {
  if (seats.length < 2 || seats.length > 4) {
    throw new Error("play requires 2–4 seats");
  }

  const rng = makeRng(opts.rngSeed);
  const cards: Record<string, CardInstance> = {};
  const seatStates: SeatState[] = [];
  const teamLife: Record<number, number> = {};

  seats.forEach((init, seat) => {
    const libraryIds: string[] = init.library.map((card, i) => {
      const instanceId = `${seat}-${i}`;
      cards[instanceId] = {
        instanceId,
        cardObjectId: card.cardObjectId,
        scryfallId: card.scryfallId,
        ownerSeat: seat,
        controllerSeat: seat,
      };
      return instanceId;
    });

    shuffleInPlace(libraryIds, rng);
    const hand = libraryIds.slice(0, OPENING_HAND);
    const library = libraryIds.slice(OPENING_HAND);

    seatStates.push({
      seat,
      uid: init.uid,
      displayName: init.displayName,
      teamId: init.teamId,
      life: opts.startingLife,
      zones: { hand, library, graveyard: [], exile: [], command: [] },
      connected: false,
    });

    if (opts.lifeMode === "shared-team" && teamLife[init.teamId] === undefined) {
      teamLife[init.teamId] = opts.startingLife;
    }
  });

  return {
    sessionId,
    status: "playing",
    lifeMode: opts.lifeMode,
    teamLife,
    seats: seatStates,
    cards,
    battlefield: [],
    activeSeat: 0,
    phase: FIRST_PHASE,
    log: [{ seq: 1, seat: 0, text: "Game started." }],
    rngSeed: rng.state(),
    version: 1,
  };
}

// ─── Connection (does not affect gameplay) ───────────────────────────────────

export function setConnected(state: BoardState, uid: string, connected: boolean): BoardState {
  return {
    ...state,
    seats: state.seats.map((s) => (s.uid === uid ? { ...s, connected } : s)),
  };
}

// ─── Action dispatch ──────────────────────────────────────────────────────────

/**
 * Validate + apply an action. `actorSeat` is injected by the adapter from
 * seatForUid — NEVER read from the payload, so a client cannot act as another
 * seat. Returns a new state with version incremented; throws a PlayError string
 * on invalid input.
 */
export function applyAction(
  state: BoardState,
  actorSeat: number,
  action: BoardAction,
): BoardState {
  if (state.status !== "playing") fail("not_playing");
  if (actorSeat < 0 || actorSeat >= state.seats.length) fail("invalid_seat");

  const next = dispatch(state, actorSeat, action);
  return { ...next, version: next.version + 1 };
}

function dispatch(state: BoardState, actor: number, action: BoardAction): BoardState {
  switch (action.type) {
    case "MOVE_ON_BATTLEFIELD":
      return moveOnBattlefield(state, action);
    case "REORDER_ZONE":
      return reorderZone(state, actor, action.zone, action.newOrder);
    case "SET_ZONE":
      return setZone(state, actor, action.instanceId, action.zone);
    case "TAP":
      return setBattlefieldFlag(state, action.instanceId, "tapped", action.tapped);
    case "FLIP":
      return setBattlefieldFlag(state, action.instanceId, "faceDown", action.faceDown);
    case "FLIP_UPSIDE_DOWN":
      return setBattlefieldFlag(state, action.instanceId, "upsideDown", action.upsideDown);
    case "TRANSFORM":
      return setBattlefieldFlag(state, action.instanceId, "flipped", action.flipped);
    case "SET_COUNTER":
      return setCounter(state, action.instanceId, action.key, action.value);
    case "ADJUST_COUNTER":
      return adjustCounter(state, action.instanceId, action.key, action.delta);
    case "MOVE_CARD":
      return moveCard(state, actor, action.instanceId, action.target);
    case "DRAW":
      return drawOrMill(state, actor, action.count, "hand", "drew");
    case "MILL":
      return drawOrMill(state, actor, action.count, "graveyard", "milled");
    case "SHUFFLE":
      return shuffleLibrary(state, actor);
    case "SCRY_REORDER":
      return scryReorder(state, actor, action.order);
    case "REVEAL":
      return reveal(state, actor, action.instanceId);
    case "CREATE_TOKEN":
      return createToken(state, actor, action);
    case "SET_LIFE":
      return setLife(state, actor, action.seat, action.value, false);
    case "ADJUST_LIFE":
      return setLife(state, actor, action.seat, action.delta, true);
    case "SET_ACTIVE_SEAT":
      return setActiveSeat(state, actor, action.seat);
    case "SET_PHASE":
      return setPhase(state, actor, action.phase);
    case "PASS_TURN":
      return passTurn(state, actor);
    case "UNTAP_ALL":
      return untapAll(state, actor);
    case "MULLIGAN":
      return mulligan(state, actor);
    default:
      return fail("invalid_action");
  }
}

// ─── Battlefield ops (any seat may manipulate; paper-style) ──────────────────

function bfCard(state: BoardState, instanceId: string): BattlefieldCard {
  const card = state.battlefield.find((b) => b.instanceId === instanceId);
  if (!card) fail("invalid_instance");
  return card;
}

function moveOnBattlefield(
  state: BoardState,
  action: { instanceId: string; x: number; y: number },
): BoardState {
  bfCard(state, action.instanceId);
  const topZ = state.battlefield.reduce((m, b) => Math.max(m, b.z), 0) + 1;
  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.instanceId === action.instanceId ? { ...b, x: action.x, y: action.y, z: topZ } : b,
    ),
  };
}

function reorderZone(
  state: BoardState,
  actor: number,
  zone: BattlefieldZone,
  newOrder: string[],
): BoardState {
  // Verify all cards in newOrder are on battlefield in this zone and controlled by actor
  const cardsInZone = state.battlefield.filter((b) => b.zone === zone);
  const actorControlled = cardsInZone.filter((b) => state.cards[b.instanceId]?.controllerSeat === actor);

  for (const id of newOrder) {
    const card = actorControlled.find((c) => c.instanceId === id);
    if (!card) fail("invalid_instance");
  }

  // Reassign order sequentially
  const orderMap = new Map<string, number>();
  newOrder.forEach((id, idx) => orderMap.set(id, idx));

  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.zone === zone && orderMap.has(b.instanceId)
        ? { ...b, order: orderMap.get(b.instanceId)! }
        : b,
    ),
  };
}

function setZone(
  state: BoardState,
  actor: number,
  instanceId: string,
  zone: BattlefieldZone,
): BoardState {
  bfCard(state, instanceId);
  const inst = state.cards[instanceId];
  if (!inst || inst.controllerSeat !== actor) fail("not_owner");

  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.instanceId === instanceId ? { ...b, zone } : b,
    ),
  };
}

function setBattlefieldFlag(
  state: BoardState,
  instanceId: string,
  flag: "tapped" | "faceDown" | "flipped" | "upsideDown",
  value: boolean,
): BoardState {
  bfCard(state, instanceId);
  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.instanceId === instanceId ? { ...b, [flag]: value } : b,
    ),
  };
}

function setCounter(
  state: BoardState,
  instanceId: string,
  key: string,
  value: number,
): BoardState {
  if (!key) fail("invalid_counter");
  bfCard(state, instanceId);
  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.instanceId === instanceId
        ? { ...b, counters: { ...b.counters, [key]: clampCounter(value) } }
        : b,
    ),
  };
}

function adjustCounter(
  state: BoardState,
  instanceId: string,
  key: string,
  delta: number,
): BoardState {
  if (!key) fail("invalid_counter");
  const card = bfCard(state, instanceId);
  const nextValue = clampCounter((card.counters[key] ?? 0) + delta);
  const counters = { ...card.counters };
  if (nextValue === 0) delete counters[key];
  else counters[key] = nextValue;
  return {
    ...state,
    battlefield: state.battlefield.map((b) =>
      b.instanceId === instanceId ? { ...b, counters } : b,
    ),
  };
}

function untapAll(state: BoardState, actor: number): BoardState {
  const battlefield = state.battlefield.map((b) =>
    state.cards[b.instanceId]?.controllerSeat === actor && b.tapped
      ? { ...b, tapped: false }
      : b,
  );
  return { ...state, battlefield, log: appendLog(state, actor, `${displayName(state, actor)} untapped all.`) };
}

// ─── Moving cards between zones / battlefield ────────────────────────────────

function moveCard(
  state: BoardState,
  actor: number,
  instanceId: string,
  target: MoveTarget,
): BoardState {
  const inst = requireInstance(state, instanceId);
  const from = locate(state, instanceId);
  if (!from) fail("invalid_instance");

  // Owner-only when the card leaves a hidden zone it doesn't belong to the actor.
  if (
    from.kind === "zone" &&
    HIDDEN_ZONES.includes(from.zone) &&
    from.seat !== actor
  ) {
    fail("not_owner");
  }

  const cleared = removeFromCurrent(state, instanceId);
  let seats = cleared.seats;
  let battlefield = cleared.battlefield;
  let cards = state.cards;

  if (target.kind === "battlefield") {
    const topZ = battlefield.reduce((m, b) => Math.max(m, b.z), 0) + 1;
    const targetZone = target.zone ?? "other";
    const cardsInZone = battlefield.filter((b) => b.zone === targetZone).length;
    battlefield = [
      ...battlefield,
      {
        instanceId,
        x: target.x ?? 0,
        y: target.y ?? 0,
        z: topZ,
        zone: targetZone,
        order: cardsInZone,
        tapped: false,
        faceDown: target.faceDown ?? false,
        flipped: false,
        counters: {},
      },
    ];
    // Controller follows the card onto the battlefield under the actor's control.
    if (inst.controllerSeat !== actor) {
      cards = { ...cards, [instanceId]: { ...inst, controllerSeat: actor } };
    }
  } else {
    const seatState = seats.find((s) => s.seat === target.toSeat);
    if (!seatState) fail("invalid_seat");
    const zoneArr = seatState.zones[target.zone];
    const nextZone =
      target.position === "top" ? [instanceId, ...zoneArr] : [...zoneArr, instanceId];
    seats = seats.map((s) =>
      s.seat === target.toSeat
        ? { ...s, zones: { ...s.zones, [target.zone]: nextZone } }
        : s,
    );
    // A card returning to a non-battlefield zone reverts to its owner's control.
    if (inst.controllerSeat !== inst.ownerSeat) {
      cards = { ...cards, [instanceId]: { ...inst, controllerSeat: inst.ownerSeat } };
    }
  }

  const dest =
    target.kind === "battlefield"
      ? "the battlefield"
      : `${displayName(state, target.toSeat)}'s ${target.zone}`;
  return {
    ...state,
    seats,
    battlefield,
    cards,
    log: appendLog(state, actor, `${displayName(state, actor)} moved a card to ${dest}.`),
  };
}

// ─── Library ops (owner-only) ────────────────────────────────────────────────

function drawOrMill(
  state: BoardState,
  actor: number,
  count: number,
  to: "hand" | "graveyard",
  verb: string,
): BoardState {
  const seat = state.seats[actor];
  const n = Math.max(1, Math.min(count, seat.zones.library.length));
  if (seat.zones.library.length === 0) fail("library_empty");

  const moved = seat.zones.library.slice(0, n);
  const library = seat.zones.library.slice(n);
  const dest = [...seat.zones[to], ...moved];
  const nextSeat: SeatState = {
    ...seat,
    zones: { ...seat.zones, library, [to]: dest },
  };

  const plural = n === 1 ? "a card" : `${n} cards`;
  return {
    ...state,
    seats: withSeat(state, actor, nextSeat),
    log: appendLog(state, actor, `${displayName(state, actor)} ${verb} ${plural}.`),
  };
}

function shuffleLibrary(state: BoardState, actor: number): BoardState {
  const seat = state.seats[actor];
  const rng = makeRng(state.rngSeed);
  const library = shuffleInPlace([...seat.zones.library], rng);
  const nextSeat: SeatState = { ...seat, zones: { ...seat.zones, library } };
  return {
    ...state,
    seats: withSeat(state, actor, nextSeat),
    rngSeed: rng.state(),
    log: appendLog(state, actor, `${displayName(state, actor)} shuffled their library.`),
  };
}

function scryReorder(state: BoardState, actor: number, order: string[]): BoardState {
  const seat = state.seats[actor];
  const lib = seat.zones.library;
  // `order` must be a permutation of the top order.length cards.
  const top = lib.slice(0, order.length);
  const sortedA = [...top].sort();
  const sortedB = [...order].sort();
  if (sortedA.length !== sortedB.length || sortedA.some((id, i) => id !== sortedB[i])) {
    fail("invalid_action");
  }
  const library = [...order, ...lib.slice(order.length)];
  const nextSeat: SeatState = { ...seat, zones: { ...seat.zones, library } };
  return {
    ...state,
    seats: withSeat(state, actor, nextSeat),
    log: appendLog(state, actor, `${displayName(state, actor)} reordered the top of their library.`),
  };
}

function mulligan(state: BoardState, actor: number): BoardState {
  const seat = state.seats[actor];
  const all = [...seat.zones.hand, ...seat.zones.library];
  const rng = makeRng(state.rngSeed);
  shuffleInPlace(all, rng);
  const hand = all.slice(0, Math.min(OPENING_HAND, all.length));
  const library = all.slice(hand.length);
  const nextSeat: SeatState = { ...seat, zones: { ...seat.zones, hand, library } };
  return {
    ...state,
    seats: withSeat(state, actor, nextSeat),
    rngSeed: rng.state(),
    log: appendLog(state, actor, `${displayName(state, actor)} took a mulligan.`),
  };
}

// REVEAL changes no hidden state — the adapter performs the ephemeral per-socket
// emit of the actual identity. Here we only log an opponent-safe line.
function reveal(state: BoardState, actor: number, instanceId: string): BoardState {
  requireInstance(state, instanceId);
  return {
    ...state,
    log: appendLog(state, actor, `${displayName(state, actor)} revealed a card.`),
  };
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

function createToken(
  state: BoardState,
  actor: number,
  action: { cardObjectId: string; scryfallId: string; x: number; y: number },
): BoardState {
  const instanceId = `tok-${state.version + 1}-${actor}`;
  const inst: CardInstance = {
    instanceId,
    cardObjectId: action.cardObjectId,
    scryfallId: action.scryfallId,
    ownerSeat: actor,
    controllerSeat: actor,
  };
  const topZ = state.battlefield.reduce((m, b) => Math.max(m, b.z), 0) + 1;
  const cardsInZone = state.battlefield.filter((b) => b.zone === "other").length;
  return {
    ...state,
    cards: { ...state.cards, [instanceId]: inst },
    battlefield: [
      ...state.battlefield,
      {
        instanceId,
        x: action.x,
        y: action.y,
        z: topZ,
        zone: "other",
        order: cardsInZone,
        tapped: false,
        faceDown: false,
        flipped: false,
        counters: {},
      },
    ],
    log: appendLog(state, actor, `${displayName(state, actor)} created a token.`),
  };
}

// ─── Life ──────────────────────────────────────────────────────────────────────

function setLife(
  state: BoardState,
  actor: number,
  targetSeat: number,
  amount: number,
  relative: boolean,
): BoardState {
  const seat = state.seats[targetSeat];
  if (!seat) fail("invalid_seat");

  if (state.lifeMode === "shared-team") {
    const current = state.teamLife[seat.teamId] ?? 0;
    const value = relative ? current + amount : amount;
    return {
      ...state,
      teamLife: { ...state.teamLife, [seat.teamId]: value },
      log: appendLog(
        state,
        actor,
        `${displayName(state, actor)} set team ${seat.teamId} life to ${value}.`,
      ),
    };
  }

  const value = relative ? seat.life + amount : amount;
  return {
    ...state,
    seats: withSeat(state, targetSeat, { ...seat, life: value }),
    log: appendLog(
      state,
      actor,
      `${displayName(state, actor)} set ${displayName(state, targetSeat)}'s life to ${value}.`,
    ),
  };
}

function setActiveSeat(state: BoardState, actor: number, seat: number | null): BoardState {
  if (seat !== null && (seat < 0 || seat >= state.seats.length)) fail("invalid_seat");
  return {
    ...state,
    activeSeat: seat,
    log: appendLog(
      state,
      actor,
      seat === null
        ? `${displayName(state, actor)} cleared the active seat.`
        : `It is now ${displayName(state, seat)}'s turn.`,
    ),
  };
}

function setPhase(state: BoardState, actor: number, phase: Phase): BoardState {
  return {
    ...state,
    phase,
    log: appendLog(state, actor, `${displayName(state, actor)} moved to ${phase}.`),
  };
}

/**
 * Advance the turn: hand priority to the next seat, reset to the first phase,
 * and untap the new active seat's permanents (paper convention). Advisory only.
 */
function passTurn(state: BoardState, actor: number): BoardState {
  const current = state.activeSeat ?? actor;
  const nextSeat = (current + 1) % state.seats.length;
  const battlefield = state.battlefield.map((b) =>
    state.cards[b.instanceId]?.controllerSeat === nextSeat && b.tapped
      ? { ...b, tapped: false }
      : b,
  );
  return {
    ...state,
    activeSeat: nextSeat,
    phase: FIRST_PHASE,
    battlefield,
    log: appendLog(state, actor, `It is now ${displayName(state, nextSeat)}'s turn.`),
  };
}

export function endGame(state: BoardState): BoardState {
  return { ...state, status: "ended" };
}

export function isEnded(state: BoardState): boolean {
  return state.status === "ended";
}

// ─── Leakage boundary: per-seat view ─────────────────────────────────────────

/**
 * Returns the view a single seat is allowed to see. This is the security
 * boundary: a seat never receives another seat's hand/library identities, and
 * face-down battlefield cards it does not control are present positionally but
 * have their identity OMITTED from the `cards` map (absence, not redaction).
 * `rngSeed` and other hidden state never appear.
 */
export function getPlayerView(state: BoardState, seat: number): PlayerBoardView {
  const visible: Record<string, ViewCardInstance> = {};

  const reveal = (instanceId: string) => {
    const inst = state.cards[instanceId];
    if (!inst) return;
    visible[instanceId] = {
      instanceId: inst.instanceId,
      cardObjectId: inst.cardObjectId,
      scryfallId: inst.scryfallId,
      ownerSeat: inst.ownerSeat,
      controllerSeat: inst.controllerSeat,
    };
  };

  // Public zones of every seat are fully visible; the viewer's own hand too.
  for (const s of state.seats) {
    for (const id of s.zones.graveyard) reveal(id);
    for (const id of s.zones.exile) reveal(id);
    for (const id of s.zones.command) reveal(id);
    if (s.seat === seat) {
      for (const id of s.zones.hand) reveal(id);
    }
  }

  // Battlefield: positions visible to all. Face-up cards reveal identity.
  // Face-down cards reveal identity only to the owner or controller.
  for (const b of state.battlefield) {
    const inst = state.cards[b.instanceId];
    if (!inst) continue;
    const canSee = !b.faceDown || inst.ownerSeat === seat || inst.controllerSeat === seat;
    if (canSee) reveal(b.instanceId);
  }

  const seats: PublicSeatView[] = state.seats.map((s) => ({
    seat: s.seat,
    uid: s.uid,
    displayName: s.displayName,
    teamId: s.teamId,
    life: s.life,
    connected: s.connected,
    handCount: s.zones.hand.length,
    libraryCount: s.zones.library.length,
    graveyard: [...s.zones.graveyard],
    exile: [...s.zones.exile],
    command: [...s.zones.command],
  }));

  return {
    sessionId: state.sessionId,
    status: state.status,
    lifeMode: state.lifeMode,
    teamLife: { ...state.teamLife },
    activeSeat: state.activeSeat,
    phase: state.phase ?? FIRST_PHASE,
    version: state.version,
    mySeat: seat,
    seats,
    battlefield: state.battlefield.map((b) => ({ ...b, counters: { ...b.counters } })),
    cards: visible,
    myHand: seat >= 0 && state.seats[seat] ? [...state.seats[seat].zones.hand] : [],
    log: [...state.log],
  };
}

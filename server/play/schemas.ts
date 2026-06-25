/**
 * Zod schemas for every `play:*` / `playlobby:*` payload. The play suite
 * validates all socket input before it touches state — a CLAUDE.md hard rule.
 * (The older draft suite validates manually; the play suite does it properly.)
 */

import { z } from "zod";
import type { BoardAction } from "@/lib/game/play";
import { PHASES } from "@/lib/game/phases";

const coord = z.number().finite();
const instanceId = z.string().min(1).max(64);
const battlefieldZone = z.enum(["creatures", "other", "lands"]);

const moveTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("zone"),
    zone: z.enum(["hand", "library", "graveyard", "exile", "command"]),
    toSeat: z.number().int().min(0).max(3),
    position: z.enum(["top", "bottom"]),
  }),
  z.object({
    kind: z.literal("battlefield"),
    // x/y are legacy free-positioning coords — optional now that cards route to
    // a zone row. `zone` is what the engine actually uses on enter.
    x: coord.optional(),
    y: coord.optional(),
    faceDown: z.boolean().optional(),
    zone: battlefieldZone.optional(),
  }),
]);

/** Discriminated union mirroring BoardAction in lib/game/play.ts. */
export const boardActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("MOVE_ON_BATTLEFIELD"),
    instanceId,
    x: coord,
    y: coord,
  }),
  z.object({
    type: z.literal("REORDER_ZONE"),
    zone: battlefieldZone,
    newOrder: z.array(instanceId).max(200),
  }),
  z.object({ type: z.literal("SET_ZONE"), instanceId, zone: battlefieldZone }),
  z.object({ type: z.literal("TAP"), instanceId, tapped: z.boolean() }),
  z.object({ type: z.literal("FLIP"), instanceId, faceDown: z.boolean() }),
  z.object({
    type: z.literal("FLIP_UPSIDE_DOWN"),
    instanceId,
    upsideDown: z.boolean(),
  }),
  z.object({ type: z.literal("TRANSFORM"), instanceId, flipped: z.boolean() }),
  z.object({
    type: z.literal("SET_COUNTER"),
    instanceId,
    key: z.string().min(1).max(24),
    value: z.number().int(),
  }),
  z.object({
    type: z.literal("ADJUST_COUNTER"),
    instanceId,
    key: z.string().min(1).max(24),
    delta: z.number().int(),
  }),
  z.object({
    type: z.literal("MOVE_CARD"),
    instanceId,
    target: moveTargetSchema,
  }),
  z.object({ type: z.literal("DRAW"), count: z.number().int().min(1).max(50) }),
  z.object({ type: z.literal("MILL"), count: z.number().int().min(1).max(50) }),
  z.object({ type: z.literal("SHUFFLE") }),
  z.object({
    type: z.literal("SCRY_REORDER"),
    order: z.array(instanceId).min(1).max(50),
  }),
  z.object({ type: z.literal("REVEAL"), instanceId }),
  z.object({
    type: z.literal("CREATE_TOKEN"),
    cardObjectId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    scryfallId: z.string().min(1).max(64),
    x: coord,
    y: coord,
  }),
  z.object({
    type: z.literal("SET_LIFE"),
    seat: z.number().int().min(0).max(3),
    value: z.number().int().min(-999).max(999),
  }),
  z.object({
    type: z.literal("ADJUST_LIFE"),
    seat: z.number().int().min(0).max(3),
    delta: z.number().int().min(-999).max(999),
  }),
  z.object({
    type: z.literal("SET_ACTIVE_SEAT"),
    seat: z.number().int().min(0).max(3).nullable(),
  }),
  z.object({ type: z.literal("SET_PHASE"), phase: z.enum(PHASES) }),
  z.object({ type: z.literal("PASS_TURN") }),
  z.object({ type: z.literal("UNTAP_ALL") }),
  z.object({ type: z.literal("MULLIGAN") }),
]);

// Compile-time guarantee the schema output is assignable to BoardAction.
const _actionCheck: BoardAction = {} as z.infer<typeof boardActionSchema>;
void _actionCheck;

const sessionId = z.string().min(1).max(64);

export const createSchema = z.object({
  formatLabel: z.string().max(40).default("Casual"),
  playerCount: z.number().int().min(2).max(4),
  lifeMode: z.enum(["per-player", "shared-team"]),
  startingLife: z.number().int().min(1).max(999),
});

export const joinSchema = z.object({ shortCode: z.string().min(1).max(12) });

export const readySchema = z.object({ sessionId, ready: z.boolean() });

export const setDeckSchema = z.object({
  sessionId,
  source: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("deck"),
      deckId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    }),
    z.object({
      kind: z.literal("decklist"),
      text: z.string().min(1).max(20_000),
    }),
  ]),
});

export const sessionOnlySchema = z.object({ sessionId });

/** No input — lists the caller's games + friends' open tables. */
export const listSchema = z.object({}).strip();

/** Ephemeral targeting arrow — broadcast only, never mutates the board. */
export const arrowSchema = z.object({
  sessionId,
  source: instanceId,
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("seat"), seat: z.number().int().min(0).max(3) }),
    z.object({ kind: z.literal("card"), instanceId }),
  ]),
});

export const inviteSchema = z.object({
  sessionId,
  friendUid: z.string().min(1).max(128),
});

export const actionSchema = z.object({ sessionId, action: boardActionSchema });

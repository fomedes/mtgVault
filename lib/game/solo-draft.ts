/**
 * Solo draft service — orchestrates the draft engine + bots over REST.
 * Phantom: no collection ingest, no VC changes (P7-04).
 *
 * Human is always seat 0. Bots occupy seats 1–7.
 * After the human picks (via API), all 7 bots pick server-side
 * from the same set card map, then the slot advances and the new
 * pack view is returned to the client.
 */

import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { SoloDraftSession } from "@/lib/models/SoloDraftSession";
import { generateBooster } from "@/lib/game/booster";
import {
  createDraft,
  pickCard,
  getPlayerView,
  isComplete,
  type DraftState,
} from "@/lib/game/draft";
import {
  makeBotStrategy,
  type BotCardInfo,
  type BotDifficulty,
} from "@/lib/game/bot";

const HUMAN_SEAT = 0;
const BOT_COUNT = 7;
const BOT_SEATS = Array.from({ length: BOT_COUNT }, (_, i) => i + 1);

// ─── Card map ─────────────────────────────────────────────────────────────────

async function loadSetCardMap(setCode: string): Promise<Map<string, BotCardInfo>> {
  const cards = await Card.find(
    { set: setCode.toLowerCase() },
    { _id: 1, colors: 1, colorIdentity: 1, cmc: 1, rarity: 1, typeLine: 1 },
  ).lean();

  const map = new Map<string, BotCardInfo>();
  for (const c of cards) {
    map.set(String(c._id), {
      id: String(c._id),
      colors: c.colors ?? [],
      colorIdentity: c.colorIdentity ?? [],
      cmc: c.cmc ?? 0,
      rarity: c.rarity as BotCardInfo["rarity"],
      typeLine: c.typeLine ?? "",
    });
  }
  return map;
}

// ─── Bot runner ───────────────────────────────────────────────────────────────

function runBotPicks(
  state: DraftState,
  difficulty: BotDifficulty,
  cardMap: Map<string, BotCardInfo>,
): DraftState {
  const bot = makeBotStrategy(difficulty);
  let current = state;

  for (const seat of BOT_SEATS) {
    if (current.pickedThisSlot[seat]) continue;
    const pack = current.currentPacks[seat];
    if (pack.length === 0) continue;

    const chosen = bot.pick(pack, current.picks[seat], cardMap);
    current = pickCard(current, seat, chosen);
  }

  return current;
}

// ─── Public view ──────────────────────────────────────────────────────────────

export interface SoloDraftView {
  sessionId: string;
  setCode: string;
  difficulty: BotDifficulty;
  numPacks: number;
  status: "drafting" | "complete";
  currentPack: string[];
  picks: string[];
  round: number;
  pickInRound: number;
  needsPick: boolean;
}

export interface SoloDraftSummary {
  sessionId: string;
  setCode: string;
  difficulty: BotDifficulty;
  status: "drafting" | "complete";
  pickCount: number;
  createdAt: Date;
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createSoloDraft(
  userId: string,
  setCode: string,
  difficulty: BotDifficulty,
  numPacks = 3,
): Promise<SoloDraftView> {
  await connectToDatabase();

  const clampedNumPacks = Math.min(5, Math.max(1, numPacks));

  const players = [
    { uid: userId, displayName: "You" },
    ...Array.from({ length: BOT_COUNT }, (_, i) => ({
      uid: `bot-${i + 1}`,
      displayName: `Bot ${i + 1}`,
    })),
  ];

  // Generate 8 × numPacks boosters (one per seat per round).
  const allPacks: string[][][] = [];
  for (let seat = 0; seat < 8; seat++) {
    const seatPacks: string[][] = [];
    for (let round = 0; round < clampedNumPacks; round++) {
      const booster = await generateBooster(setCode);
      seatPacks.push(booster.cardIds.map(String));
    }
    allPacks.push(seatPacks);
  }

  const sessionId = `solo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const state = createDraft(sessionId, setCode, players, allPacks, 60_000, clampedNumPacks);

  const doc = await SoloDraftSession.create({
    userId,
    setCode,
    difficulty,
    status: "drafting",
    draftState: state,
    picks: [],
  });

  const view = getPlayerView(state, HUMAN_SEAT);
  return toSoloDraftView(doc._id.toString(), doc.setCode, difficulty, "drafting", view);
}

export async function getSoloDraftView(
  sessionId: string,
  userId: string,
): Promise<SoloDraftView | null> {
  await connectToDatabase();

  const doc = await SoloDraftSession.findById(sessionId).lean();
  if (!doc || doc.userId !== userId) return null;

  const state = doc.draftState as DraftState;
  const view = getPlayerView(state, HUMAN_SEAT);

  return toSoloDraftView(
    sessionId,
    doc.setCode,
    doc.difficulty as BotDifficulty,
    doc.status as "drafting" | "complete",
    view,
  );
}

export async function humanPick(
  sessionId: string,
  userId: string,
  cardId: string,
): Promise<SoloDraftView | null> {
  await connectToDatabase();

  const doc = await SoloDraftSession.findById(sessionId);
  if (!doc || doc.userId !== userId || doc.status !== "drafting") return null;

  let state = doc.draftState as DraftState;
  if (!state.currentPacks[HUMAN_SEAT].includes(cardId)) return null;

  // Human pick.
  state = pickCard(state, HUMAN_SEAT, cardId);

  // Bot picks — all bots pick synchronously server-side.
  if (!isComplete(state)) {
    const cardMap = await loadSetCardMap(doc.setCode);
    state = runBotPicks(state, doc.difficulty as BotDifficulty, cardMap);
  }

  const complete = isComplete(state);
  doc.draftState = state;
  // Mongoose Mixed fields require markModified to ensure the change is
  // detected and persisted — a plain assignment is not always tracked.
  doc.markModified("draftState");
  doc.status = complete ? "complete" : "drafting";
  if (complete) {
    doc.picks = state.picks[HUMAN_SEAT];
  }
  await doc.save();

  const view = getPlayerView(state, HUMAN_SEAT);
  return toSoloDraftView(
    sessionId,
    doc.setCode,
    doc.difficulty as BotDifficulty,
    doc.status as "drafting" | "complete",
    view,
  );
}

export async function listSoloDrafts(userId: string): Promise<SoloDraftSummary[]> {
  await connectToDatabase();

  const docs = await SoloDraftSession.find(
    { userId },
    { setCode: 1, difficulty: 1, status: 1, picks: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return docs.map((d) => ({
    sessionId: d._id.toString(),
    setCode: d.setCode,
    difficulty: d.difficulty as BotDifficulty,
    status: d.status as "drafting" | "complete",
    pickCount: Array.isArray(d.picks) ? (d.picks as string[]).length : 0,
    createdAt: d.createdAt as Date,
  }));
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function toSoloDraftView(
  sessionId: string,
  setCode: string,
  difficulty: BotDifficulty,
  status: "drafting" | "complete",
  view: ReturnType<typeof getPlayerView>,
): SoloDraftView {
  return {
    sessionId,
    setCode,
    difficulty,
    numPacks: view.numPacks,
    status,
    currentPack: view.currentPack,
    picks: view.picks,
    round: view.round,
    pickInRound: view.pickInRound,
    needsPick: view.needsPick,
  };
}

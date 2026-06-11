import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { GAME_CONFIG } from "@/lib/game/config";

export interface BoosterResult {
  cardIds: Types.ObjectId[];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomN<T>(arr: T[], n: number): T[] {
  if (arr.length === 0) return [];
  const result: T[] = [];
  for (let i = 0; i < n; i++) {
    result.push(arr[Math.floor(Math.random() * arr.length)]);
  }
  return result;
}

/**
 * Generates one 15-card draft booster from the cached card pool for `setCode`.
 * Slots: 10 C / 3 U / 1 R-or-M (1:8 mythic rate) / 1 basic land (extra common fallback).
 * Pure random with replacement — duplicate cards are possible, matching real booster behaviour.
 * Zero Scryfall calls; uses only the MongoDB card cache.
 */
export async function generateBooster(setCode: string): Promise<BoosterResult> {
  await connectToDatabase();

  const pool = await Card.find(
    { set: setCode.toLowerCase(), inBooster: true },
    { _id: 1, rarity: 1, typeLine: 1 },
  ).lean();

  if (pool.length === 0) {
    throw new Error(`No booster-eligible cards found for set "${setCode}"`);
  }

  const commons = pool.filter((c) => c.rarity === "common" && !c.typeLine.includes("Basic Land"));
  const uncommons = pool.filter((c) => c.rarity === "uncommon");
  const rares = pool.filter((c) => c.rarity === "rare");
  const mythics = pool.filter((c) => c.rarity === "mythic");
  const basics = pool.filter((c) => c.typeLine.includes("Basic Land"));

  const picks: Types.ObjectId[] = [];

  // Commons
  const commonPool = commons.length > 0 ? commons : pool;
  picks.push(...pickRandomN(commonPool, GAME_CONFIG.BOOSTER_COMMONS).map((c) => c._id as Types.ObjectId));

  // Uncommons
  const uncommonPool = uncommons.length > 0 ? uncommons : commonPool;
  picks.push(...pickRandomN(uncommonPool, GAME_CONFIG.BOOSTER_UNCOMMONS).map((c) => c._id as Types.ObjectId));

  // Rare / mythic slot
  const useMythic =
    mythics.length > 0 && Math.random() < GAME_CONFIG.MYTHIC_RATE;
  const rarePool = useMythic ? mythics : rares.length > 0 ? rares : (mythics.length > 0 ? mythics : uncommonPool);
  picks.push(pickRandom(rarePool)._id as Types.ObjectId);

  // Basic land slot (extra common if set has no basics)
  const landPool = basics.length > 0 ? basics : commonPool;
  picks.push(pickRandom(landPool)._id as Types.ObjectId);

  return { cardIds: picks };
}

/** Generates `count` boosters for the same set and returns all card IDs together. */
export async function generateBoosters(
  setCode: string,
  count: number,
): Promise<BoosterResult> {
  const results = await Promise.all(
    Array.from({ length: count }, () => generateBooster(setCode)),
  );
  return { cardIds: results.flatMap((r) => r.cardIds) };
}

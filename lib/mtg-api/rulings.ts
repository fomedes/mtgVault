import { connectToDatabase } from "@/lib/db";
import { scryfall, type ScryfallClient } from "@/lib/mtg-api/client";
import { Ruling } from "@/lib/models/Ruling";

export const RULING_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface GetRulingsOptions {
  client?: ScryfallClient;
  now?: () => Date;
}

export interface RulingEntry {
  source: string;
  publishedAt: string;
  comment: string;
}

/**
 * On-demand rulings with a 30 d cache (P1-05). Keyed by oracleId so all
 * prints share one entry; fetched via the print's Scryfall card id.
 */
export async function getRulingsForCard(
  card: { scryfallId: string; oracleId: string },
  options: GetRulingsOptions = {},
): Promise<RulingEntry[]> {
  const { client = scryfall, now = () => new Date() } = options;
  const key = card.oracleId || card.scryfallId;

  await connectToDatabase();
  const cached = await Ruling.findOne({ oracleId: key }).lean();
  if (cached && now().getTime() - cached.cachedAt.getTime() < RULING_TTL_MS) {
    return cached.rulings;
  }

  const fetched = await client.getRulings(card.scryfallId);
  const rulings = fetched.map((ruling) => ({
    source: ruling.source,
    publishedAt: ruling.published_at,
    comment: ruling.comment,
  }));
  await Ruling.updateOne(
    { oracleId: key },
    { $set: { rulings, cachedAt: now() } },
    { upsert: true },
  );
  return rulings;
}

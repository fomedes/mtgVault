import { connectToDatabase } from "@/lib/db";
import { scryfall, type ScryfallClient } from "@/lib/mtg-api/client";
import { toCardDocument, toSetDocument } from "@/lib/mtg-api/transform";
import { Card } from "@/lib/models/Card";
import { CardSet } from "@/lib/models/CardSet";
import { getBlockEntry } from "@/lib/blocks";

export const SET_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const CARD_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SyncSetOptions {
  force?: boolean;
  client?: ScryfallClient;
  log?: (message: string) => void;
  now?: () => Date;
}

export interface SyncSetResult {
  code: string;
  setRefreshed: boolean;
  cardsRefreshed: boolean;
  cardsUpserted: number;
  scryfallRequests: number;
}

function ageLabel(date: Date | null | undefined, now: Date): string {
  if (!date) return "never synced";
  const days = (now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000);
  return `age ${days.toFixed(1)} d`;
}

/**
 * Cache-first sync of one set (P1-04): refreshes `/sets/:code` metadata when
 * older than 7 d and the full card list (paginated `unique:prints` search)
 * when older than 30 d. Warm paths make zero Scryfall requests.
 */
export async function syncSet(
  code: string,
  options: SyncSetOptions = {},
): Promise<SyncSetResult> {
  const {
    force = false,
    client = scryfall,
    log = console.log,
    now = () => new Date(),
  } = options;
  const setCode = code.trim().toLowerCase();
  const startedAt = now();
  const requestsBefore = client.requestCount();

  await connectToDatabase();
  const existing = await CardSet.findOne({ code: setCode }).lean();

  const setFresh =
    !!existing?.cachedAt &&
    startedAt.getTime() - existing.cachedAt.getTime() < SET_TTL_MS;
  const cardsFresh =
    !!existing?.cardsSyncedAt &&
    startedAt.getTime() - existing.cardsSyncedAt.getTime() < CARD_TTL_MS;

  let setRefreshed = false;
  if (setFresh && !force) {
    log(
      `[sync:${setCode}] set metadata cache hit (${ageLabel(existing?.cachedAt, startedAt)})`,
    );
  } else {
    log(
      `[sync:${setCode}] set metadata cache miss (${ageLabel(existing?.cachedAt, startedAt)}) — fetching`,
    );
    const scrySet = await client.getSet(setCode);
    const blockEntry = getBlockEntry(setCode);
    const blockFields = blockEntry
      ? { block: blockEntry.id, blockName: blockEntry.name, blockOrder: blockEntry.order, setOrderInBlock: blockEntry.setOrder }
      : {};
    await CardSet.updateOne(
      { code: setCode },
      {
        $set: { ...toSetDocument(scrySet, now()), ...blockFields },
        $setOnInsert: { enabled: false },
      },
      { upsert: true },
    );
    setRefreshed = true;
  }

  let cardsRefreshed = false;
  let cardsUpserted = 0;
  if (cardsFresh && !force) {
    log(
      `[sync:${setCode}] cards cache hit (${ageLabel(existing?.cardsSyncedAt, startedAt)})`,
    );
  } else {
    log(
      `[sync:${setCode}] cards cache miss (${ageLabel(existing?.cardsSyncedAt, startedAt)}) — fetching prints`,
    );
    for await (const page of client.searchPrintsBySet(setCode)) {
      if (page.length === 0) continue;
      const cachedAt = now();
      const operations = page.map((card) => ({
        updateOne: {
          filter: { scryfallId: card.id },
          update: { $set: toCardDocument(card, cachedAt) },
          upsert: true,
        },
      }));
      // Cast: mongoose's bulk $set type insists on hydrated DocumentArrays
      // for cardFaces; the plain objects we pass are what the driver expects.
      await Card.bulkWrite(operations as Parameters<typeof Card.bulkWrite>[0]);
      cardsUpserted += page.length;
    }
    await CardSet.updateOne(
      { code: setCode },
      { $set: { cardsSyncedAt: now() } },
    );
    cardsRefreshed = true;
  }

  const scryfallRequests = client.requestCount() - requestsBefore;
  log(
    `[sync:${setCode}] done — ${cardsUpserted} cards upserted, ${scryfallRequests} Scryfall request(s)`,
  );
  return {
    code: setCode,
    setRefreshed,
    cardsRefreshed,
    cardsUpserted,
    scryfallRequests,
  };
}

import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { UserCollection } from "@/lib/models/UserCollection";

export type ObtainedVia = "admin" | "draft" | "shop";

/**
 * Single entry point for adding cards to a user's collection.
 * Duplicate entries in `cardIds` add multiple copies (e.g. 3x the same ID = +3 qty).
 * All phases that award cards (admin grant, shop, draft) go through here.
 */
export async function addCards(
  userId: string,
  cardIds: Types.ObjectId[],
  source: ObtainedVia,
): Promise<void> {
  if (cardIds.length === 0) return;
  await connectToDatabase();
  const now = new Date();

  // Count occurrences so duplicate IDs in the input accumulate quantity.
  const countMap = new Map<string, number>();
  for (const id of cardIds) {
    const key = id.toString();
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  // Ensure the collection document exists before card-level ops.
  await UserCollection.updateOne(
    { userId },
    { $setOnInsert: { userId, cards: [] } },
    { upsert: true },
  );

  for (const [cardIdStr, qty] of countMap) {
    const cardId = new Types.ObjectId(cardIdStr);

    // Increment quantity if the card is already in the collection.
    const result = await UserCollection.updateOne(
      { userId, "cards.cardId": cardId },
      {
        $inc: { "cards.$.quantity": qty },
        $set: { "cards.$.lastObtainedAt": now },
        $addToSet: { "cards.$.obtainedVia": source },
      },
    );

    if (result.matchedCount === 0) {
      await UserCollection.updateOne(
        { userId },
        {
          $push: {
            cards: {
              cardId,
              quantity: qty,
              obtainedVia: [source],
              firstObtainedAt: now,
              lastObtainedAt: now,
            },
          },
        },
      );
    }
  }
}

/** Returns lightweight stats for the dashboard — no card detail. */
export async function getCollectionStats(
  userId: string,
): Promise<{ uniqueCards: number; totalCards: number }> {
  await connectToDatabase();
  const doc = await UserCollection.findOne({ userId }, { cards: 1 }).lean();
  if (!doc) return { uniqueCards: 0, totalCards: 0 };
  const uniqueCards = doc.cards.length;
  const totalCards = doc.cards.reduce((sum, e) => sum + e.quantity, 0);
  return { uniqueCards, totalCards };
}

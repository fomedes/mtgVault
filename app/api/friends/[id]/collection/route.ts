import { NextRequest, NextResponse } from "next/server";
import { toCollectionEntryDto } from "@/lib/api/collection-dto";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";

/**
 * GET /api/friends/[id]/collection
 * Returns the friend's collection in read-only mode.
 * Requires an accepted Friendship between the caller and [id].
 * [id] is the friend's UID (not a friendship ID).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("friends:collection", {
    limit: 30,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  const { id: friendUid } = await params;
  await connectToDatabase();

  // Verify accepted friendship between caller and friendUid.
  const pair = canonicalPair(guard.user.uid, friendUid);
  const friendship = await Friendship.findOne({
    ...pair,
    status: "accepted",
  }).lean();

  if (!friendship) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const collection = await UserCollection.findOne(
    { userId: friendUid },
    { cards: 1 },
  ).lean();

  if (!collection || collection.cards.length === 0) {
    return NextResponse.json({ entries: [], uniqueCards: 0, totalCards: 0 });
  }

  const cardIds = collection.cards.map((e) => e.cardId);
  const cards = await Card.find({ _id: { $in: cardIds } }).lean();
  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const entries = collection.cards
    .map((entry) => {
      const card = cardMap.get(entry.cardId.toString());
      if (!card) return null;
      return toCollectionEntryDto(entry, card);
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const totalCards = entries.reduce((sum, e) => sum + e.quantity, 0);

  return NextResponse.json({
    entries,
    uniqueCards: entries.length,
    totalCards,
  });
}

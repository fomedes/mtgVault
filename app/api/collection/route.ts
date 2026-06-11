import { NextResponse } from "next/server";
import { toCollectionEntryDto } from "@/lib/api/collection-dto";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";

export async function GET() {
  const guard = await guardApiRequest("collection");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const collection = await UserCollection.findOne(
    { userId: guard.user.uid },
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

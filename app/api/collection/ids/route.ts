import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";

/** Returns the Scryfall IDs of every card the user owns, for owned-badge display. */
export async function GET() {
  const guard = await guardApiRequest("collection-ids");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const collection = await UserCollection.findOne(
    { userId: guard.user.uid },
    { "cards.cardId": 1 },
  ).lean();

  if (!collection || collection.cards.length === 0) {
    return NextResponse.json({ scryfallIds: [] });
  }

  const cardObjectIds = collection.cards.map((e) => e.cardId);
  const cards = await Card.find(
    { _id: { $in: cardObjectIds } },
    { scryfallId: 1 },
  ).lean();

  return NextResponse.json({
    scryfallIds: cards.map((c) => c.scryfallId),
  });
}

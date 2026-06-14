import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";

/** Returns a scryfallId → quantity map for every card the user owns. */
export async function GET() {
  const guard = await guardApiRequest("collection-ids");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const collection = await UserCollection.findOne(
    { userId: guard.user.uid },
    { "cards.cardId": 1, "cards.quantity": 1 },
  ).lean();

  if (!collection || collection.cards.length === 0) {
    return NextResponse.json({ quantities: {} });
  }

  const qtyByCardId = new Map(
    collection.cards.map((e) => [e.cardId.toString(), e.quantity]),
  );

  const cardObjectIds = collection.cards.map((e) => e.cardId);
  const cards = await Card.find(
    { _id: { $in: cardObjectIds } },
    { scryfallId: 1 },
  ).lean();

  const quantities: Record<string, number> = {};
  for (const card of cards) {
    quantities[card.scryfallId] = qtyByCardId.get(card._id.toString()) ?? 1;
  }

  return NextResponse.json({ quantities });
}

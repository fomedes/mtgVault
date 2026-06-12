import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { Card } from "@/lib/models/Card";
import { Types } from "mongoose";
import { toCardListItem } from "@/lib/api/card-dto";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("history-detail", { limit: 60 });
  if (!guard.ok) return guard.response;

  const { id: sessionId } = await params;

  await connectToDatabase();

  const deck = await SavedDeck.findOne({
    sessionId,
    userId: guard.user.uid,
  }).lean();

  if (!deck) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const objectIds = deck.cardIds
    .map((id) => {
      try { return new Types.ObjectId(id); } catch { return null; }
    })
    .filter((id): id is Types.ObjectId => id !== null);

  const cardDocs = await Card.find({ _id: { $in: objectIds } }).lean();
  const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));

  const cards = deck.cardIds.map((id) => {
    const doc = cardMap.get(id);
    return doc ? toCardListItem(doc) : null;
  }).filter(Boolean);

  return NextResponse.json({
    sessionId: deck.sessionId,
    setCode: deck.setCode,
    cards,
    cardIds: deck.cardIds,
    createdAt: (deck.createdAt as Date).toISOString(),
  });
}

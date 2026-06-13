import { NextRequest, NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Friendship, canonicalPair } from "@/lib/models/Friendship";
import { Deck } from "@/lib/models/Deck";

/**
 * GET /api/friends/[id]/decks
 * Returns the friend's deck list in read-only mode.
 * Requires an accepted Friendship between the caller and [id].
 * [id] is the friend's UID (not a friendship ID).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("friends:decks", {
    limit: 30,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  const { id: friendUid } = await params;
  await connectToDatabase();

  // Verify accepted friendship.
  const pair = canonicalPair(guard.user.uid, friendUid);
  const friendship = await Friendship.findOne({
    ...pair,
    status: "accepted",
  }).lean();

  if (!friendship) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const decks = await Deck.find(
    { userId: friendUid },
    { name: 1, cards: 1, updatedAt: 1, sourceDraftId: 1 },
  )
    .sort({ updatedAt: -1 })
    .lean();

  const deckSummaries = decks.map((d) => ({
    id: String(d._id),
    name: d.name,
    cardCount: (d.cards ?? []).reduce((sum, c) => sum + (c.quantity ?? 0), 0),
    updatedAt: ((d.updatedAt as Date) ?? new Date()).toISOString(),
    sourceDraftId: d.sourceDraftId ?? null,
  }));

  return NextResponse.json({ decks: deckSummaries });
}

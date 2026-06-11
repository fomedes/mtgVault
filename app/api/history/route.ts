import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { DraftSession } from "@/lib/models/DraftSession";

export async function GET() {
  const guard = await guardApiRequest("history");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const decks = await SavedDeck.find(
    { userId: guard.user.uid },
    { sessionId: 1, setCode: 1, cardIds: 1, createdAt: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const sessionIds = decks.map((d) => d.sessionId);
  const sessions = await DraftSession.find(
    { sessionId: { $in: sessionIds } },
    { sessionId: 1, players: 1, completedAt: 1 },
  ).lean();

  const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]));

  return NextResponse.json({
    drafts: decks.map((d) => {
      const session = sessionMap.get(d.sessionId);
      return {
        sessionId: d.sessionId,
        setCode: d.setCode,
        pickCount: d.cardIds.length,
        completedAt: (d.createdAt as Date).toISOString(),
        players: session?.players?.map((p) => p.displayName) ?? [],
      };
    }),
  });
}

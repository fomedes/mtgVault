import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { SavedDeck } from "@/lib/models/SavedDeck";
import { DraftSession } from "@/lib/models/DraftSession";

const KindParam = z.enum(["all", "multiplayer", "phantom"]).default("all");

export async function GET(req: Request) {
  const guard = await guardApiRequest("history");
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(req.url);
  const kindParsed = KindParam.safeParse(searchParams.get("kind") ?? "all");
  if (!kindParsed.success) {
    return NextResponse.json({ error: "invalid_kind" }, { status: 400 });
  }
  const kind = kindParsed.data;

  await connectToDatabase();

  const filter: Record<string, unknown> = { userId: guard.user.uid };
  if (kind !== "all") filter.kind = kind;

  const decks = await SavedDeck.find(
    filter,
    { sessionId: 1, setCode: 1, cardIds: 1, createdAt: 1, kind: 1, difficulty: 1 },
  )
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  // Only multiplayer SavedDecks correspond to a DraftSession; phantom ones don't.
  const mpSessionIds = decks
    .filter((d) => (d.kind ?? "multiplayer") === "multiplayer")
    .map((d) => d.sessionId);

  const sessions = mpSessionIds.length
    ? await DraftSession.find(
        { sessionId: { $in: mpSessionIds } },
        { sessionId: 1, players: 1 },
      ).lean()
    : [];

  const sessionMap = new Map(sessions.map((s) => [s.sessionId, s]));

  return NextResponse.json({
    drafts: decks.map((d) => {
      const rowKind = (d.kind ?? "multiplayer") as string;
      const session = rowKind === "multiplayer" ? sessionMap.get(d.sessionId) : undefined;
      const row: Record<string, unknown> = {
        sessionId: d.sessionId,
        setCode: d.setCode,
        pickCount: d.cardIds.length,
        completedAt: (d.createdAt as Date).toISOString(),
        players: session?.players?.map((p) => p.displayName) ?? [],
        kind: rowKind,
      };
      const diff = (d as Record<string, unknown>).difficulty as string | undefined;
      if (diff) row.difficulty = diff;
      return row;
    }),
  });
}

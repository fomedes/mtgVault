import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { createDeck, getDeckSummaries } from "@/lib/game/deck";

const CreateDeckSchema = z.object({
  name: z.string().min(1).max(80),
  sourceDraftId: z.string().optional(),
  cardIds: z.array(z.string()).max(500).optional(),
});

export async function GET() {
  const guard = await guardApiRequest("decks-list");
  if (!guard.ok) return guard.response;

  const decks = await getDeckSummaries(guard.user.uid);
  return NextResponse.json({ decks });
}

export async function POST(req: NextRequest) {
  const guard = await guardApiRequest("decks-create");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = CreateDeckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input", issues: parsed.error.issues }, { status: 422 });
  }

  const deck = await createDeck(guard.user.uid, parsed.data);
  return NextResponse.json({ deck }, { status: 201 });
}

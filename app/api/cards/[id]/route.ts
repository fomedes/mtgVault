import { NextResponse } from "next/server";
import { z } from "zod";
import { toCardDetail } from "@/lib/api/card-dto";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { getRulingsForCard, type RulingEntry } from "@/lib/mtg-api/rulings";
import { Card } from "@/lib/models/Card";

const paramsSchema = z.object({ id: z.uuid() });

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("card-detail", { limit: 60 });
  if (!guard.ok) return guard.response;

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  await connectToDatabase();
  const card = await Card.findOne({ scryfallId: parsed.data.id }).lean();
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Rulings are best-effort: a Scryfall hiccup must not break the card view.
  let rulings: RulingEntry[] = [];
  try {
    rulings = await getRulingsForCard({
      scryfallId: card.scryfallId,
      oracleId: card.oracleId,
    });
  } catch (error) {
    console.error(`[cards/${card.scryfallId}] rulings fetch failed:`, error);
  }

  return NextResponse.json({ card: toCardDetail(card), rulings });
}

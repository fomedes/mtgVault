import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { toCardListItem } from "@/lib/api/card-dto";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";

// Accepts up to 60 MongoDB ObjectId strings (one full pack = 15 cards;
// draft tray grows to 45 picks).
const IdsSchema = z
  .string()
  .transform((s) => s.split(",").map((id) => id.trim()).filter(Boolean))
  .pipe(z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(60));

/**
 * GET /api/cards/batch?ids=<objectId1>,<objectId2>,...
 *
 * Returns `{ cards: Record<string, CardListItemDto> }` where each key is the
 * MongoDB ObjectId string — matching the IDs stored in draft pack state.
 */
export async function GET(req: NextRequest) {
  const guard = await guardApiRequest("cards-batch", { limit: 120, windowMs: 60_000 });
  if (!guard.ok) return guard.response;

  const raw = new URL(req.url).searchParams.get("ids") ?? "";
  const parsed = IdsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }

  await connectToDatabase();
  const docs = await Card.find({ _id: { $in: parsed.data } }).lean();

  // Key by ObjectId string so callers can do O(1) cache lookups.
  const cards: Record<string, ReturnType<typeof toCardListItem>> = {};
  for (const doc of docs) {
    cards[String(doc._id)] = toCardListItem(doc);
  }

  return NextResponse.json({ cards });
}

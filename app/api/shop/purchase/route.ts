import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { awardAchievement } from "@/lib/game/achievements";
import { generateBoosters } from "@/lib/game/booster";
import { addCards } from "@/lib/game/collection";
import { debitWallet, InsufficientFundsError } from "@/lib/game/wallet";
import { Card } from "@/lib/models/Card";
import { CardSet } from "@/lib/models/CardSet";
import { toCardListItem } from "@/lib/api/card-dto";

const purchaseSchema = z.object({
  setCode: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9]{2,6}$/),
  quantity: z.number().int().min(1).max(3),
});

export async function POST(request: Request) {
  const guard = await guardApiRequest("shop-purchase", {
    limit: 20,
    windowMs: 60_000,
  });
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = purchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_body",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      },
      { status: 400 },
    );
  }

  const { setCode, quantity } = parsed.data;

  await connectToDatabase();

  const cardSet = await CardSet.findOne(
    { code: setCode, enabled: true, cardsSyncedAt: { $exists: true } },
    { boosterPrice: 1 },
  ).lean();

  if (!cardSet) {
    return NextResponse.json({ error: "set_not_available" }, { status: 404 });
  }

  const priceEach = cardSet.boosterPrice ?? 100;
  const totalCost = priceEach * quantity;

  // Guarded debit — throws InsufficientFundsError if balance is too low.
  let newBalance: number;
  try {
    ({ newBalance } = await debitWallet(
      guard.user.uid,
      totalCost,
      "shop_purchase",
      { setCode, packCount: quantity },
    ));
  } catch (err) {
    if (err instanceof InsufficientFundsError) {
      return NextResponse.json({ error: "insufficient_funds" }, { status: 402 });
    }
    throw err;
  }

  // Generate packs and ingest cards.
  const { cardIds } = await generateBoosters(setCode, quantity);
  await addCards(guard.user.uid, cardIds, "shop");

  // Resolve card details for the opening animation.
  const cardDocs = await Card.find({ _id: { $in: cardIds } }).lean();
  const cardMap = new Map(cardDocs.map((c) => [c._id.toString(), c]));
  const cards = cardIds.map((id) => {
    const doc = cardMap.get(id.toString());
    return doc ? toCardListItem(doc) : null;
  }).filter(Boolean);

  // Fire first_purchase achievement (idempotent).
  await awardAchievement(guard.user.uid, "first_purchase");

  return NextResponse.json({ cards, newBalance, packCount: quantity });
}

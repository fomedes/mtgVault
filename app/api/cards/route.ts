import { NextResponse } from "next/server";
import { toCardListItem } from "@/lib/api/card-dto";
import {
  buildCardFilter,
  buildCardSort,
  cardListQuerySchema,
} from "@/lib/api/cards-query";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";

export async function GET(request: Request) {
  const guard = await guardApiRequest("cards");
  if (!guard.ok) return guard.response;

  const searchParams = new URL(request.url).searchParams;
  const parsed = cardListQuerySchema.safeParse(
    Object.fromEntries(searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_query",
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      },
      { status: 400 },
    );
  }

  await connectToDatabase();

  // Resolve owned card ObjectIds server-side when ownedOnly is requested.
  let ownedCardIds: string[] | undefined;
  if (parsed.data.ownedOnly) {
    const coll = await UserCollection.findOne(
      { userId: guard.user.uid },
      { "cards.cardId": 1 },
    ).lean();
    ownedCardIds = coll?.cards.map((c) => c.cardId.toString()) ?? [];
  }

  const filter = buildCardFilter(parsed.data, ownedCardIds);
  const { page, pageSize } = parsed.data;
  const [cards, total] = await Promise.all([
    Card.find(filter)
      .sort(buildCardSort(parsed.data.sort))
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Card.countDocuments(filter),
  ]);

  return NextResponse.json({
    cards: cards.map(toCardListItem),
    page,
    pageSize,
    total,
    hasMore: page * pageSize < total,
  });
}

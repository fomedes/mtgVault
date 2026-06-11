import { NextResponse } from "next/server";
import { toMtgoLine, toTextLine } from "@/lib/api/collection-dto";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { UserCollection } from "@/lib/models/UserCollection";
import { toCollectionEntryDto } from "@/lib/api/collection-dto";

const ALLOWED_FORMATS = ["text", "mtgo"] as const;
type ExportFormat = (typeof ALLOWED_FORMATS)[number];

export async function GET(request: Request) {
  const guard = await guardApiRequest("collection-export", { limit: 30 });
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const rawFormat = searchParams.get("format") ?? "text";
  if (!(ALLOWED_FORMATS as readonly string[]).includes(rawFormat)) {
    return NextResponse.json(
      { error: "invalid_format", allowed: ALLOWED_FORMATS },
      { status: 400 },
    );
  }
  const format = rawFormat as ExportFormat;

  await connectToDatabase();

  const collection = await UserCollection.findOne(
    { userId: guard.user.uid },
    { cards: 1 },
  ).lean();

  if (!collection || collection.cards.length === 0) {
    return new NextResponse("", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="collection.${format === "mtgo" ? "txt" : "txt"}"`,
      },
    });
  }

  const cardIds = collection.cards.map((e) => e.cardId);
  const cards = await Card.find({ _id: { $in: cardIds } }).lean();
  const cardMap = new Map(cards.map((c) => [c._id.toString(), c]));

  const entries = collection.cards
    .map((entry) => {
      const card = cardMap.get(entry.cardId.toString());
      if (!card) return null;
      return toCollectionEntryDto(entry, card);
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.card.name.localeCompare(b.card.name));

  const lines =
    format === "mtgo"
      ? entries.map(toMtgoLine)
      : entries.map(toTextLine);

  const body = lines.join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="collection.txt"`,
    },
  });
}

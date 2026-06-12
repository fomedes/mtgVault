import { NextRequest, NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { getDeckDetail } from "@/lib/game/deck";
import { isBasicLand } from "@/lib/models/Deck";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("decks-export");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const deck = await getDeckDetail(id, guard.user.uid);
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const format = req.nextUrl.searchParams.get("format") ?? "text";

  const lines = deck.cards.flatMap((card) => {
    const notOwned =
      !isBasicLand(card.typeLine) && card.ownedQty < card.quantity
        ? ` [NOT OWNED: ${card.quantity - card.ownedQty}]`
        : "";
    const line =
      format === "mtgo"
        ? `${card.quantity} ${card.name}${notOwned}`
        : `${card.quantity}x ${card.name}${notOwned}`;
    return [line];
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${deck.name.replace(/[^a-zA-Z0-9 _-]/g, "")}.txt"`,
    },
  });
}

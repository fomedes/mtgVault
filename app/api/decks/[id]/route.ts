import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Deck } from "@/lib/models/Deck";
import { getDeckDetail, patchDeck } from "@/lib/game/deck";

const PatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  addCardScryfallId: z.string().optional(),
  removeCardScryfallId: z.string().optional(),
  setCardQty: z
    .object({ scryfallId: z.string(), quantity: z.number().int().min(0) })
    .optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("decks-get");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const deck = await getDeckDetail(id, guard.user.uid);
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ deck });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("decks-patch");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  const deck = await patchDeck(id, guard.user.uid, parsed.data);
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ deck });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("decks-delete");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await connectToDatabase();
  const result = await Deck.deleteOne({ _id: id, userId: guard.user.uid });
  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

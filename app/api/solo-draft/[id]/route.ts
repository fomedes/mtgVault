import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { getSoloDraftView, humanPick } from "@/lib/game/solo-draft";

const PickSchema = z.object({
  cardId: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("solo-draft-get");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const view = await getSoloDraftView(id, guard.user.uid);
  if (!view) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ session: view });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApiRequest("solo-draft-pick", { limit: 60, windowMs: 60_000 });
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const parsed = PickSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 422 });
  }

  const { id } = await params;
  const view = await humanPick(id, guard.user.uid, parsed.data.cardId);
  if (!view) return NextResponse.json({ error: "invalid_pick" }, { status: 400 });

  return NextResponse.json({ session: view });
}

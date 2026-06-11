import { NextResponse } from "next/server";
import { z } from "zod";
import { addCards } from "@/lib/game/collection";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { Card } from "@/lib/models/Card";
import { User } from "@/lib/models/User";

const grantBodySchema = z.object({
  targetUserId: z.string().min(1).max(128),
  scryfallIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(request: Request) {
  const guard = await guardApiRequest("admin-grant", { limit: 60 });
  if (!guard.ok) return guard.response;

  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = grantBodySchema.safeParse(body);
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

  const { targetUserId, scryfallIds } = parsed.data;

  await connectToDatabase();

  // Verify target user exists.
  const targetUser = await User.findOne({ uid: targetUserId }, { uid: 1 }).lean();
  if (!targetUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Resolve scryfallIds to MongoDB ObjectIds.
  const cards = await Card.find(
    { scryfallId: { $in: scryfallIds } },
    { _id: 1 },
  ).lean();

  if (cards.length === 0) {
    return NextResponse.json({ error: "no_cards_found" }, { status: 404 });
  }

  const cardObjectIds = cards.map((c) => c._id);
  await addCards(targetUserId, cardObjectIds, "admin");

  return NextResponse.json({ granted: cards.length });
}

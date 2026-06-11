import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export async function GET() {
  const guard = await guardApiRequest("admin-sets", { limit: 30 });
  if (!guard.ok) return guard.response;
  if (guard.user.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectToDatabase();

  const sets = await CardSet.find(
    {},
    { code: 1, name: 1, setType: 1, enabled: 1, boosterPrice: 1, cardCount: 1, releasedAt: 1 },
  )
    .sort({ releasedAt: -1 })
    .lean();

  return NextResponse.json({ sets });
}

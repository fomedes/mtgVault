import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export async function GET() {
  const guard = await guardApiRequest("sets");
  if (!guard.ok) return guard.response;

  await connectToDatabase();
  // Only enabled sets whose metadata has actually been synced are browsable.
  const sets = await CardSet.find({
    enabled: true,
    cachedAt: { $exists: true },
  })
    .sort({ releasedAt: -1 })
    .lean();

  return NextResponse.json({
    sets: sets.map((set) => ({
      code: set.code,
      name: set.name,
      setType: set.setType,
      cardCount: set.cardCount,
      releasedAt: set.releasedAt ?? null,
      iconSvgUri: set.iconSvgUri,
    })),
  });
}

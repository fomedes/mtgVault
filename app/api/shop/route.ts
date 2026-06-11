import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export async function GET() {
  const guard = await guardApiRequest("shop");
  if (!guard.ok) return guard.response;

  await connectToDatabase();

  const sets = await CardSet.find(
    { enabled: true, cachedAt: { $exists: true }, cardsSyncedAt: { $exists: true } },
    { code: 1, name: 1, setType: 1, iconSvgUri: 1, releasedAt: 1, boosterPrice: 1 },
  )
    .sort({ releasedAt: -1 })
    .lean();

  return NextResponse.json({
    packs: sets.map((s) => ({
      setCode: s.code,
      setName: s.name,
      setType: s.setType,
      iconSvgUri: s.iconSvgUri,
      releasedAt: s.releasedAt?.toISOString() ?? null,
      price: s.boosterPrice ?? 100,
    })),
    balance: guard.user.vaultCoins ?? 0,
  });
}

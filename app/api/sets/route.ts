import { NextResponse } from "next/server";
import { guardApiRequest } from "@/lib/auth/api-guard";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";
import { groupSetsByBlock, type SetSummary } from "@/lib/sets-grouping";

export async function GET() {
  const guard = await guardApiRequest("sets");
  if (!guard.ok) return guard.response;

  await connectToDatabase();
  // Return all enabled sets — unsynced sets appear as "coming soon" tiles (P13-06).
  const sets = await CardSet.find({ enabled: true })
    .sort({ releasedAt: -1 })
    .lean();

  const summaries: SetSummary[] = sets.map((set) => ({
    code: set.code,
    name: set.name,
    setType: set.setType,
    cardCount: set.cardCount,
    releasedAt: set.releasedAt ? set.releasedAt.toISOString() : null,
    iconSvgUri: set.iconSvgUri,
    synced: !!set.cachedAt,
    block: set.block ?? "",
    blockName: set.blockName ?? "",
    blockOrder: set.blockOrder ?? 0,
    setOrderInBlock: set.setOrderInBlock ?? 0,
  }));

  return NextResponse.json(groupSetsByBlock(summaries));
}

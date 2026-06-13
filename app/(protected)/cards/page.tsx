import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";
import { SetLibrary } from "@/components/cards/set-library";
import { groupSetsByBlock, type SetSummary } from "@/lib/sets-grouping";

export const metadata = { title: "Card Library — MTG Vault" };

export default async function CardsPage() {
  await connectToDatabase();
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

  const totalSynced = summaries.filter((s) => s.synced).length;
  const grouped = groupSetsByBlock(summaries);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="space-y-1">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Card Library</h1>
        <p className="text-muted-foreground text-sm">
          {totalSynced} curated set{totalSynced === 1 ? "" : "s"} in the vault.
        </p>
      </header>

      <SetLibrary blocks={grouped.blocks} standalone={grouped.standalone} standaloneYearRange={grouped.standaloneYearRange} />
    </main>
  );
}

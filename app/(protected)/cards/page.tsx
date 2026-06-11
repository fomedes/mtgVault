import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { connectToDatabase } from "@/lib/db";
import { CardSet } from "@/lib/models/CardSet";

export const metadata = { title: "Card Browser — MTG Vault" };

export default async function CardsPage() {
  await connectToDatabase();
  const sets = await CardSet.find({
    enabled: true,
    cachedAt: { $exists: true },
  })
    .sort({ releasedAt: -1 })
    .lean();

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
        <h1 className="text-2xl font-bold tracking-tight">Card Browser</h1>
        <p className="text-muted-foreground text-sm">
          {sets.length} curated set{sets.length === 1 ? "" : "s"} in the vault.
        </p>
      </header>

      {sets.length === 0 ? (
        <div className="bg-card rounded-lg border p-8 text-center">
          <p className="font-semibold">No sets synced yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Run <code className="font-mono">pnpm seed:sets</code> and then{" "}
            <code className="font-mono">pnpm sync:set --all</code> to fill the
            vault.
          </p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <Link
              key={set.code}
              href={`/cards/${set.code}`}
              className="bg-card hover:bg-muted/60 focus-visible:ring-ring/50 flex items-center gap-4 rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
            >
              {set.iconSvgUri ? (
                // eslint-disable-next-line @next/next/no-img-element -- tiny static SVGs from Scryfall's CDN; black fill needs invert on dark
                <img
                  src={set.iconSvgUri}
                  alt=""
                  aria-hidden
                  className="size-9 shrink-0 invert"
                />
              ) : (
                <div className="bg-muted size-9 shrink-0 rounded-full" />
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{set.name}</p>
                <p className="text-muted-foreground text-sm">
                  {set.code.toUpperCase()}
                  {set.releasedAt
                    ? ` · ${set.releasedAt.getFullYear()}`
                    : ""} · {set.cardCount} cards
                </p>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

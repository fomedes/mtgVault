import Link from "next/link";
import type { RecentDeck } from "@/lib/game/dashboard";

export function RecentDecks({ decks }: { decks: RecentDeck[] }) {
  return (
    <section className="bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">Recent Decks</h2>
        <Link
          href="/decks"
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          All decks →
        </Link>
      </div>
      {decks.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No decks yet.{" "}
          <Link href="/decks" className="text-foreground underline-offset-2 hover:underline">
            Build one
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-1.5">
          {decks.map((deck) => (
            <li key={deck.id}>
              <Link
                href={`/decks/${deck.id}`}
                className="hover:bg-muted/60 -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors"
              >
                <span className="truncate text-sm font-medium">{deck.name}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {deck.cardCount} cards
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NewDeckDialog } from "@/components/decks/new-deck-dialog";
import type { DeckSummaryDto } from "@/lib/api/deck-dto";
import { cn } from "@/lib/utils";

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-violet-500/20 text-violet-300" },
  complete: { label: "Complete", className: "bg-emerald-500/20 text-emerald-300" },
  wishlist: { label: "Wishlist", className: "bg-amber-500/20 text-amber-300" },
};

function ColorPips({ colors }: { colors: string[] }) {
  if (colors.length === 0) return <span className="text-muted-foreground text-xs">Colorless</span>;
  return (
    <div className="flex items-center gap-1">
      {colors.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={c}
          src={`/mana_symbols/${c}.svg`}
          alt={c}
          title={c}
          className="h-4 w-4"
        />
      ))}
    </div>
  );
}

export function DeckList({ initialDecks }: { initialDecks: DeckSummaryDto[] }) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/decks/${id}`, { method: "DELETE" });
      if (res.ok) setDecks((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function handleCreated(deckId: string) {
    router.push(`/decks/${deckId}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Decks</h1>
          <p className="text-muted-foreground text-sm">{decks.length} deck{decks.length !== 1 ? "s" : ""}</p>
        </div>
        <NewDeckDialog onCreated={handleCreated} />
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <p className="text-lg font-medium">No decks yet</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Build from scratch, browse your collection, or import a saved draft.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const cat = CATEGORY_STYLE[deck.category] ?? CATEGORY_STYLE.wishlist;
            return (
              <div
                key={deck.id}
                className="bg-card group flex flex-col gap-3 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/decks/${deck.id}`}
                      className="hover:text-primary line-clamp-1 text-sm font-semibold transition-colors"
                    >
                      {deck.name}
                    </Link>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {deck.cardCount} cards
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", cat.className)}>
                    {cat.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <ColorPips colors={deck.colors} />
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/decks/${deck.id}`}
                      className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(deck.id)}
                      disabled={deleting === deck.id}
                      className="text-muted-foreground hover:text-destructive rounded px-2 py-1 text-xs transition-colors disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

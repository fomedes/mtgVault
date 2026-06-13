"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardGrid } from "@/components/cards/card-grid";
import { CardTile } from "@/components/cards/card-tile";
import { Button } from "@/components/ui/button";
import type { CardListItemDto } from "@/lib/api/card-dto";

interface DeckDetail {
  sessionId: string;
  setCode: string;
  cards: CardListItemDto[];
  cardIds: string[];
  createdAt: string;
  kind: "multiplayer" | "phantom";
  difficulty?: string;
}

export function SavedDeckView({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    fetch(`/api/history/${sessionId}`)
      .then((r) => r.json())
      .then((d: DeckDetail) => {
        setDeck(d);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [sessionId]);

  async function handleBuildDeck() {
    if (!deck) return;
    setBuilding(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Draft — ${deck.setCode.toUpperCase()} (${new Date(deck.createdAt).toLocaleDateString()})`,
          sourceDraftId: deck.sessionId,
          cardIds: deck.cardIds,
        }),
      });
      const data = (await res.json()) as { deck?: { id: string } };
      if (data.deck?.id) router.push(`/decks/${data.deck.id}`);
    } finally {
      setBuilding(false);
    }
  }

  if (isLoading) {
    return <div className="bg-muted h-64 animate-pulse rounded-lg" />;
  }

  if (!deck) {
    return <p className="text-muted-foreground text-sm">Draft not found.</p>;
  }

  const isPhantom = deck.kind === "phantom";
  const difficultyLabel = deck.difficulty
    ? deck.difficulty.charAt(0).toUpperCase() + deck.difficulty.slice(1)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-sm uppercase tracking-wide">
              {deck.setCode} · {new Date(deck.createdAt).toLocaleDateString()}
            </p>
            {isPhantom && (
              <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-violet-500/15 text-violet-400 border border-violet-500/30">
                Phantom
              </span>
            )}
          </div>
          <p className="text-lg font-semibold">{deck.cards.length} picks</p>
          {isPhantom && difficultyLabel && (
            <p className="text-muted-foreground text-xs">
              Solo draft · {difficultyLabel} bots
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBuildDeck}
          disabled={building}
        >
          {building ? "Creating…" : "Build Deck →"}
        </Button>
      </div>

      <CardGrid>
        {deck.cards.map((card, i) => (
          <CardTile
            key={`${card.scryfallId}-${i}`}
            card={card}
          />
        ))}
      </CardGrid>
    </div>
  );
}

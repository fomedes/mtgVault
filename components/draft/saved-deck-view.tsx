"use client";

import { useEffect, useState } from "react";
import { CardGrid } from "@/components/cards/card-grid";
import { CardTile } from "@/components/cards/card-tile";
import type { CardListItemDto } from "@/lib/api/card-dto";

interface DeckDetail {
  sessionId: string;
  setCode: string;
  cards: CardListItemDto[];
  createdAt: string;
}

export function SavedDeckView({ sessionId }: { sessionId: string }) {
  const [deck, setDeck] = useState<DeckDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/history/${sessionId}`)
      .then((r) => r.json())
      .then((d: DeckDetail) => {
        setDeck(d);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [sessionId]);

  if (isLoading) {
    return <div className="bg-muted h-64 animate-pulse rounded-lg" />;
  }

  if (!deck) {
    return <p className="text-muted-foreground text-sm">Draft not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm uppercase tracking-wide">
            {deck.setCode} · {new Date(deck.createdAt).toLocaleDateString()}
          </p>
          <p className="text-lg font-semibold">{deck.cards.length} picks</p>
        </div>
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

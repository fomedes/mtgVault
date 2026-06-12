"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CardSourcePane } from "@/components/decks/card-source-pane";
import { DeckCardRow } from "@/components/decks/deck-card-row";
import { DeckStats } from "@/components/decks/deck-stats";
import { Button } from "@/components/ui/button";
import { isBasicLand, type DeckDetailDto } from "@/lib/api/deck-dto";

interface DeckBuilderProps {
  initialDeck: DeckDetailDto;
}

export function DeckBuilder({ initialDeck }: DeckBuilderProps) {
  const [deck, setDeck] = useState(initialDeck);
  const [nameValue, setNameValue] = useState(initialDeck.name);
  const [saving, setSaving] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const patch = useCallback(
    async (body: Record<string, unknown>): Promise<DeckDetailDto | null> => {
      const res = await fetch(`/api/decks/${deck.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { deck: DeckDetailDto };
      return data.deck;
    },
    [deck.id],
  );

  async function handleNameBlur() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === deck.name) return;
    setSaving(true);
    const updated = await patch({ name: trimmed });
    if (updated) setDeck(updated);
    setSaving(false);
  }

  async function handleAdd(scryfallId: string) {
    setAddingId(scryfallId);
    const updated = await patch({ addCardScryfallId: scryfallId });
    if (updated) setDeck(updated);
    setAddingId(null);
  }

  async function handleRemove(scryfallId: string) {
    const updated = await patch({ removeCardScryfallId: scryfallId });
    if (updated) setDeck(updated);
  }

  async function handleSetQty(scryfallId: string, quantity: number) {
    const updated = await patch({ setCardQty: { scryfallId, quantity } });
    if (updated) setDeck(updated);
  }

  async function handleExport(format: "text" | "mtgo") {
    const res = await fetch(`/api/decks/${deck.id}/export?format=${format}`);
    if (!res.ok) return;
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setExportMsg("Copied to clipboard!");
    setTimeout(() => setExportMsg(null), 2000);
  }

  // Group cards by type for display
  const creatures = deck.cards.filter((c) => c.typeLine.includes("Creature"));
  const spells = deck.cards.filter(
    (c) => !c.typeLine.includes("Creature") && !c.typeLine.includes("Land"),
  );
  const lands = deck.cards.filter((c) => c.typeLine.includes("Land"));

  function CardGroup({ label, cards }: { label: string; cards: DeckDetailDto["cards"] }) {
    if (cards.length === 0) return null;
    const total = cards.reduce((s, c) => s + c.quantity, 0);
    return (
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase tracking-wider">
          {label} ({total})
        </p>
        {cards.map((card) => (
          <DeckCardRow
            key={card.scryfallId}
            card={card}
            onAdd={() => handleAdd(card.scryfallId)}
            onRemove={() => {
              if (isBasicLand(card.typeLine) && card.quantity > 1) {
                handleSetQty(card.scryfallId, card.quantity - 1);
              } else {
                handleRemove(card.scryfallId);
              }
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header: editable name + save indicator */}
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={handleNameBlur}
          maxLength={80}
          aria-label="Deck name"
          className="border-input bg-background min-w-0 flex-1 rounded-lg border px-3 py-2 text-lg font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        {saving && <span className="text-muted-foreground text-xs">Saving…</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: card source pane */}
        <section className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Add Cards</h2>
          <div className="bg-card rounded-lg border p-3">
            <CardSourcePane onAdd={handleAdd} addingId={addingId} />
          </div>
        </section>

        {/* Centre: deck list */}
        <section className="lg:col-span-1">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Deck List</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("text")}
              >
                Copy
              </Button>
              <a
                href={`/api/decks/${deck.id}/export?format=text`}
                download
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Export
              </a>
            </div>
          </div>
          {exportMsg && (
            <p className="text-muted-foreground mb-2 text-xs">{exportMsg}</p>
          )}
          <div className="bg-card rounded-lg border p-2">
            {deck.cards.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Search for cards to add them here.
              </p>
            ) : (
              <div className="space-y-4">
                <CardGroup label="Creatures" cards={creatures} />
                <CardGroup label="Spells" cards={spells} />
                <CardGroup label="Lands" cards={lands} />
              </div>
            )}
          </div>
        </section>

        {/* Right: stats */}
        <section className="lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Stats</h2>
          <div className="bg-card rounded-lg border p-4">
            <DeckStats deck={deck} />
          </div>
        </section>
      </div>
    </div>
  );
}

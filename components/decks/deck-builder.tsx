"use client";

import { useCallback, useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { CardSourcePane } from "@/components/decks/card-source-pane";
import { DeckCardRow } from "@/components/decks/deck-card-row";
import { DeckStats } from "@/components/decks/deck-stats";
import { CardPreviewProvider } from "@/components/cards/card-preview-provider";
import { Button } from "@/components/ui/button";
import { isBasicLand, type DeckDetailDto, type DeckCardDto } from "@/lib/api/deck-dto";
import { groupAndSort } from "@/lib/game/deck-sort";
import { cn } from "@/lib/utils";

// ── Card group with collapsible header ──────────────────────────────────────

function CardGroup({
  label,
  cards,
  onAdd,
  onRemove,
  collapsed,
  onToggle,
}: {
  label: string;
  cards: DeckCardDto[];
  onAdd: (id: string) => void;
  onRemove: (card: DeckCardDto) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const total = cards.reduce((s, c) => s + c.quantity, 0);
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-1 text-left"
        aria-expanded={!collapsed}
      >
        {collapsed ? (
          <ChevronRightIcon className="text-muted-foreground size-3.5 shrink-0" />
        ) : (
          <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
        )}
        <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
          {label}
        </span>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {total}
        </span>
      </button>
      {!collapsed && (
        <div className="mt-0.5">
          {cards.map((card) => (
            <DeckCardRow
              key={card.scryfallId}
              card={card}
              onAdd={() => onAdd(card.scryfallId)}
              onRemove={() => onRemove(card)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main DeckBuilder ─────────────────────────────────────────────────────────

interface DeckBuilderProps {
  initialDeck: DeckDetailDto;
}

export function DeckBuilder({ initialDeck }: DeckBuilderProps) {
  const [deck, setDeck] = useState(initialDeck);
  const [nameValue, setNameValue] = useState(initialDeck.name);
  const [saving, setSaving] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

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

  async function handleRemove(card: DeckCardDto) {
    const updated = await patch(
      isBasicLand(card.typeLine) && card.quantity > 1
        ? { setCardQty: { scryfallId: card.scryfallId, quantity: card.quantity - 1 } }
        : { removeCardScryfallId: card.scryfallId },
    );
    if (updated) setDeck(updated);
  }

  async function handleExport(format: "text" | "mtgo") {
    const res = await fetch(`/api/decks/${deck.id}/export?format=${format}`);
    if (!res.ok) return;
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setExportMsg("Copied!");
    setTimeout(() => setExportMsg(null), 2000);
  }

  const groups = groupAndSort(deck.cards);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <CardPreviewProvider>
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
              <h2 className="text-sm font-semibold">
                Deck List
                <span className={cn("ml-2 text-xs font-normal text-muted-foreground", deck.cards.length === 0 && "hidden")}>
                  ({deck.cards.reduce((s, c) => s + c.quantity, 0)})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExport("text")}>
                  {exportMsg ?? "Copy"}
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

            <div className="bg-card rounded-lg border p-2">
              {groups.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  Search for cards to add them here.
                </p>
              ) : (
                <div className="space-y-3">
                  {groups.map((g) => (
                    <CardGroup
                      key={g.key}
                      label={g.label}
                      cards={g.cards}
                      onAdd={handleAdd}
                      onRemove={handleRemove}
                      collapsed={collapsedGroups.has(g.key)}
                      onToggle={() => toggleGroup(g.key)}
                    />
                  ))}
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
    </CardPreviewProvider>
  );
}

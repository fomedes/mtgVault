"use client";

import { useEffect, useRef, useState } from "react";
import { CardImage } from "@/components/cards/card-image";
import type { CardListItemDto } from "@/lib/api/card-dto";
import { cn } from "@/lib/utils";

type SourceTab = "all" | "collection";

interface CardSourcePaneProps {
  onAdd: (cardId: string) => void;
  addingId: string | null;
}

interface CollectionCard {
  cardId: string;
  card: CardListItemDto;
  quantity: number;
}

interface SearchCard {
  id: string;      // MongoDB _id string
  scryfallId: string;
  name: string;
  typeLine: string;
  manaCost: string;
  rarity: string;
  imageUris?: { small?: string; normal?: string };
}

export function CardSourcePane({ onAdd, addingId }: CardSourcePaneProps) {
  const [tab, setTab] = useState<SourceTab>("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // All-cards search state
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Collection search state
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [collLoaded, setCollLoaded] = useState(false);
  const [collLoading, setCollLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  useEffect(() => {
    if (tab === "collection" && !collLoaded && !collLoading) {
      setCollLoading(true);
      fetch("/api/collection")
        .then((r) => r.json())
        .then((d: { entries: CollectionCard[] }) => {
          setCollection(d.entries ?? []);
          setCollLoaded(true);
        })
        .catch(() => undefined)
        .finally(() => setCollLoading(false));
    }
  }, [tab, collLoaded, collLoading]);

  useEffect(() => {
    if (tab !== "all") return;
    if (!debouncedQuery.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    const params = new URLSearchParams({ name: debouncedQuery, pageSize: "20" });
    fetch(`/api/cards?${params}`)
      .then((r) => r.json())
      .then((d: { cards: Array<{ _id?: string; scryfallId: string; name: string; typeLine: string; manaCost: string; rarity: string; imageUris?: { small?: string; normal?: string } }> }) => {
        setSearchResults(
          (d.cards ?? []).map((c) => ({
            id: c._id ?? c.scryfallId,
            scryfallId: c.scryfallId,
            name: c.name,
            typeLine: c.typeLine,
            manaCost: c.manaCost,
            rarity: c.rarity,
            imageUris: c.imageUris,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setSearchLoading(false));
  }, [tab, debouncedQuery]);

  const filteredCollection =
    tab === "collection" && debouncedQuery
      ? collection.filter((e) =>
          e.card.name.toLowerCase().includes(debouncedQuery.toLowerCase()),
        )
      : collection;

  const tabClass = (active: boolean) =>
    cn(
      "flex-1 rounded-md py-1.5 text-sm transition-colors",
      active
        ? "bg-primary text-primary-foreground font-medium"
        : "text-muted-foreground hover:bg-muted",
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg border p-1">
        <button type="button" onClick={() => setTab("all")} className={tabClass(tab === "all")}>
          All Cards
        </button>
        <button type="button" onClick={() => setTab("collection")} className={tabClass(tab === "collection")}>
          My Collection
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tab === "all" ? "Search all cards…" : "Filter collection…"}
        className="border-input bg-background h-9 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Search cards"
      />

      {tab === "all" ? (
        <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
          {!debouncedQuery ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Type to search all cards</p>
          ) : searchLoading ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">No cards found</p>
          ) : (
            searchResults.map((card) => (
              <SourceCardRow
                key={card.scryfallId}
                id={card.id}
                name={card.name}
                typeLine={card.typeLine}
                rarity={card.rarity}
                imageUrl={card.imageUris?.small}
                manaCost={card.manaCost}
                onAdd={onAdd}
                adding={addingId === card.id}
              />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "400px" }}>
          {collLoading ? (
            <p className="text-muted-foreground py-6 text-center text-xs">Loading…</p>
          ) : filteredCollection.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              {debouncedQuery ? "No matching cards" : "Collection is empty"}
            </p>
          ) : (
            filteredCollection.map((entry) => (
              <SourceCardRow
                key={entry.cardId}
                id={entry.card.scryfallId}
                name={entry.card.name}
                typeLine={entry.card.typeLine}
                rarity={entry.card.rarity}
                imageUrl={entry.card.imageUris?.small}
                manaCost={entry.card.manaCost}
                badge={`×${entry.quantity}`}
                onAdd={onAdd}
                adding={addingId === entry.card.scryfallId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SourceCardRow({
  id,
  name,
  typeLine,
  rarity,
  imageUrl,
  manaCost,
  badge,
  onAdd,
  adding,
}: {
  id: string;
  name: string;
  typeLine: string;
  rarity: string;
  imageUrl?: string;
  manaCost: string;
  badge?: string;
  onAdd: (id: string) => void;
  adding: boolean;
}) {
  const RARITY_DOT: Record<string, string> = {
    common: "bg-rarity-common",
    uncommon: "bg-rarity-uncommon",
    rare: "bg-rarity-rare",
    mythic: "bg-rarity-mythic",
  };

  return (
    <button
      type="button"
      onClick={() => onAdd(id)}
      disabled={adding}
      aria-label={`Add ${name} to deck`}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-muted/40 disabled:opacity-60"
    >
      <div className="h-9 w-7 shrink-0 overflow-hidden rounded-sm">
        <CardImage
          name={name}
          imageUrl={imageUrl}
          manaCost={manaCost}
          typeLine={typeLine}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", RARITY_DOT[rarity] ?? "bg-muted")}
            aria-hidden
          />
          <span className="truncate text-sm">{name}</span>
        </div>
        <p className="text-muted-foreground truncate text-xs">{typeLine}</p>
      </div>
      {badge && <span className="text-muted-foreground shrink-0 text-xs">{badge}</span>}
      <span className="text-muted-foreground shrink-0 text-sm">{adding ? "…" : "+"}</span>
    </button>
  );
}

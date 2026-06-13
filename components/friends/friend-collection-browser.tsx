"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { CardFilterBar } from "@/components/cards/card-filter-bar";
import { CardGrid, CardGridSkeleton } from "@/components/cards/card-grid";
import { CardPreviewProvider } from "@/components/cards/card-preview-provider";
import {
  DEFAULT_FILTERS,
  type CardFilterState,
} from "@/components/cards/filter-state";
import { CollectionTile } from "@/components/collection/collection-tile";
import type { CollectionEntryDto } from "@/lib/api/collection-dto";

const PAGE_SIZE = 120;

function matchesFilters(entry: CollectionEntryDto, filters: CardFilterState) {
  const { card } = entry;
  if (
    filters.name &&
    !card.name.toLowerCase().includes(filters.name.toLowerCase())
  )
    return false;
  if (filters.colors.length > 0) {
    const colorless = filters.colors.includes("C");
    if (colorless && card.colors.length === 0) {
      // passes
    } else if (!filters.colors.some((c) => c !== "C" && card.colors.includes(c))) {
      return false;
    }
  }
  if (filters.rarity.length > 0 && !filters.rarity.includes(card.rarity))
    return false;
  if (
    filters.type &&
    !card.typeLine.toLowerCase().includes(filters.type.toLowerCase())
  )
    return false;
  return true;
}

interface FriendCollectionBrowserProps {
  friendUid: string;
  friendName: string;
}

export function FriendCollectionBrowser({
  friendUid,
  friendName,
}: FriendCollectionBrowserProps) {
  const [entries, setEntries] = useState<CollectionEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilterState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasFetchedRef = useRef(false);
  const endSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = endSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((prev) => prev + PAGE_SIZE);
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    fetch(`/api/friends/${friendUid}/collection`)
      .then((res) => {
        if (res.status === 403) throw new Error("You are not friends with this user.");
        if (!res.ok) throw new Error("Failed to load collection");
        return res.json();
      })
      .then((data: { entries: CollectionEntryDto[] }) => {
        setEntries(data.entries);
        setIsLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setIsLoading(false);
      });
  }, [friendUid]);

  const filtered = useMemo(
    () => entries.filter((e) => matchesFilters(e, filters)),
    [entries, filters],
  );

  const visibleEntries = filtered.slice(0, visibleCount);
  const totalCards = entries.reduce((s, e) => s + e.quantity, 0);

  return (
    <CardPreviewProvider>
      <div className="flex flex-col gap-6">
        <header className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {friendName}&rsquo;s Collection
            </h1>
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {isLoading
                ? "Loading…"
                : `${entries.length} unique · ${totalCards} total`}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Read-only view</p>
        </header>

        <CardFilterBar
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setVisibleCount(PAGE_SIZE);
          }}
        />

        {error ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">{error}</p>
          </div>
        ) : isLoading ? (
          <CardGrid>
            <CardGridSkeleton count={18} />
          </CardGrid>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-lg font-medium">Collection is empty</p>
            <p className="text-muted-foreground max-w-sm text-sm">
              {friendName} hasn&rsquo;t collected any cards yet.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground py-16 text-center text-sm">
            No cards match these filters.
          </p>
        ) : (
          <>
            <CardGrid>
              {visibleEntries.map((entry) => (
                <CollectionTile
                  key={entry.cardId}
                  entry={entry}
                  onClick={() => setSelectedId(entry.cardId)}
                />
              ))}
            </CardGrid>
            <div ref={endSentinelRef} className="h-1" aria-hidden />
          </>
        )}

        <CardDetailModal
          cardId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </CardPreviewProvider>
  );
}

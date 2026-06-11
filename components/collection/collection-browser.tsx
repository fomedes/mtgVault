"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { CardFilterBar } from "@/components/cards/card-filter-bar";
import { CardGrid, CardGridSkeleton } from "@/components/cards/card-grid";
import {
  DEFAULT_FILTERS,
  type CardFilterState,
} from "@/components/cards/filter-state";
import { CollectionExport } from "@/components/collection/collection-export";
import { CollectionTile } from "@/components/collection/collection-tile";
import { useCollectionAnimations } from "@/lib/animations/collection";
import type { CollectionEntryDto } from "@/lib/api/collection-dto";
import { cn } from "@/lib/utils";

type GroupBy = "none" | "set" | "color";

const COLOR_ORDER: Record<string, number> = {
  W: 0,
  U: 1,
  B: 2,
  R: 3,
  G: 4,
  Multi: 5,
  Colorless: 6,
};

const RARITY_ORDER: Record<string, number> = {
  mythic: 0,
  rare: 1,
  uncommon: 2,
  common: 3,
  special: 4,
  bonus: 5,
};

function cmcValue(cmc: string): [number, number] | null {
  if (cmc === "7+") return [7, Infinity];
  const n = Number(cmc);
  if (!cmc || isNaN(n)) return null;
  return [n, n];
}

function matchesFilters(
  entry: CollectionEntryDto,
  filters: CardFilterState,
): boolean {
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

  if (
    filters.rarity.length > 0 &&
    !filters.rarity.includes(card.rarity)
  )
    return false;

  if (
    filters.type &&
    !card.typeLine.toLowerCase().includes(filters.type.toLowerCase())
  )
    return false;

  const cmcRange = cmcValue(filters.cmc);
  if (cmcRange) {
    const cmc =
      "cmc" in card ? (card as { cmc: number }).cmc : undefined;
    if (cmc !== undefined && (cmc < cmcRange[0] || cmc > cmcRange[1]))
      return false;
  }

  if (filters.legal) {
    const legalities =
      "legalities" in card
        ? (card as { legalities?: Record<string, string> }).legalities
        : undefined;
    if (!legalities || legalities[filters.legal] !== "legal") return false;
  }

  return true;
}

function sortEntries(
  entries: CollectionEntryDto[],
  sort: string,
): CollectionEntryDto[] {
  return [...entries].sort((a, b) => {
    switch (sort) {
      case "name":
        return a.card.name.localeCompare(b.card.name);
      case "rarity":
        return (
          (RARITY_ORDER[a.card.rarity] ?? 99) -
          (RARITY_ORDER[b.card.rarity] ?? 99)
        );
      case "cmc": {
        const aCmc =
          "cmc" in a.card ? (a.card as { cmc: number }).cmc : 0;
        const bCmc =
          "cmc" in b.card ? (b.card as { cmc: number }).cmc : 0;
        return aCmc - bCmc;
      }
      case "collector":
      default:
        if (a.card.set !== b.card.set)
          return a.card.set.localeCompare(b.card.set);
        return a.card.collectorNumber.localeCompare(b.card.collectorNumber, undefined, {
          numeric: true,
        });
    }
  });
}

function groupDominantColor(colors: string[]): string {
  if (colors.length === 0) return "Colorless";
  if (colors.length > 1) return "Multi";
  return colors[0];
}

export function CollectionBrowser() {
  const [entries, setEntries] = useState<CollectionEntryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CardFilterState>(DEFAULT_FILTERS);
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const { staggerContainer } = useCollectionAnimations();

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    fetch("/api/collection")
      .then((res) => {
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
      })
      .finally(() => setIsFirstLoad(false));
  }, []);

  const filtered = useMemo(
    () => sortEntries(entries.filter((e) => matchesFilters(e, filters)), filters.sort),
    [entries, filters],
  );

  const groups = useMemo<Array<{ label: string; entries: CollectionEntryDto[] }>>(
    () => {
      if (groupBy === "none") return [{ label: "", entries: filtered }];

      const map = new Map<string, CollectionEntryDto[]>();
      for (const entry of filtered) {
        const key =
          groupBy === "set"
            ? entry.card.set.toUpperCase()
            : groupDominantColor(entry.card.colors);
        const bucket = map.get(key) ?? [];
        bucket.push(entry);
        map.set(key, bucket);
      }

      if (groupBy === "color") {
        return [...map.entries()]
          .sort(
            ([a], [b]) => (COLOR_ORDER[a] ?? 99) - (COLOR_ORDER[b] ?? 99),
          )
          .map(([label, groupEntries]) => ({ label, entries: groupEntries }));
      }

      return [...map.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, groupEntries]) => ({ label, entries: groupEntries }));
    },
    [filtered, groupBy],
  );

  const totalCards = entries.reduce((s, e) => s + e.quantity, 0);

  const groupTabClass = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-sm transition-colors",
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted",
    );

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">My Collection</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {isLoading
              ? "Loading…"
              : `${entries.length} unique · ${totalCards} total`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="flex items-center gap-1 rounded-lg border p-1"
            role="group"
            aria-label="Group cards by"
          >
            {(["none", "set", "color"] as GroupBy[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroupBy(g)}
                className={groupTabClass(groupBy === g)}
              >
                {g === "none" ? "All" : g === "set" ? "By Set" : "By Color"}
              </button>
            ))}
          </div>
          <CollectionExport disabled={entries.length === 0} />
        </div>
      </header>

      <CardFilterBar filters={filters} onChange={setFilters} />

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
          <p className="text-lg font-medium">Your collection is empty</p>
          <p className="text-muted-foreground max-w-sm text-sm">
            Cards appear here after you open boosters, complete drafts, or
            receive an admin grant.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          No cards match these filters.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map(({ label, entries: groupEntries }) => (
            <section key={label || "all"}>
              {label ? (
                <h2 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-widest">
                  {label}
                </h2>
              ) : null}
              <motion.div
                variants={isFirstLoad ? staggerContainer : undefined}
                initial={isFirstLoad ? "hidden" : false}
                animate={isFirstLoad ? "visible" : undefined}
              >
                <CardGrid>
                  {groupEntries.map((entry) => (
                    <CollectionTile
                      key={entry.cardId}
                      entry={entry}
                      animate={isFirstLoad}
                      onClick={() => setSelectedId(entry.card.scryfallId)}
                    />
                  ))}
                </CardGrid>
              </motion.div>
            </section>
          ))}
        </div>
      )}

      <CardDetailModal
        cardId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardDetailModal } from "@/components/cards/card-detail-modal";
import { CardFilterBar } from "@/components/cards/card-filter-bar";
import { CardGrid, CardGridSkeleton } from "@/components/cards/card-grid";
import { CardPreviewProvider } from "@/components/cards/card-preview-provider";
import { CardTile } from "@/components/cards/card-tile";
import {
  filtersFromSearchParams,
  filtersToApiParams,
  filtersToSearchParams,
} from "@/components/cards/filter-state";
import { Button } from "@/components/ui/button";
import { useInfiniteCards } from "@/hooks/use-infinite-cards";

const NAME_DEBOUNCE_MS = 300;

function useOwnedIds(): Set<string> {
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch("/api/collection/ids")
      .then((res) => (res.ok ? res.json() : { scryfallIds: [] }))
      .then((data: { scryfallIds: string[] }) =>
        setOwnedIds(new Set(data.scryfallIds)),
      )
      .catch(() => undefined);
  }, []);
  return ownedIds;
}

export function CardBrowser({
  setCode,
  setName,
}: {
  setCode: string;
  setName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() =>
    filtersFromSearchParams(new URLSearchParams(searchParams)),
  );
  const [debouncedName, setDebouncedName] = useState(filters.name);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedName(filters.name),
      NAME_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [filters.name]);

  // Keep the URL shareable without triggering a navigation/scroll reset.
  useEffect(() => {
    const params = filtersToSearchParams(filters).toString();
    router.replace(params ? `${pathname}?${params}` : pathname, {
      scroll: false,
    });
  }, [filters, pathname, router]);

  const apiQuery = useMemo(
    () =>
      filtersToApiParams(
        { ...filters, name: debouncedName },
        setCode,
      ).toString(),
    [filters, debouncedName, setCode],
  );
  const { cards, total, hasMore, isLoading, error, loadMore, retry } =
    useInfiniteCards(apiQuery);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ownedIds = useOwnedIds();

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <CardPreviewProvider>
    <div className="flex flex-col gap-5">
      <header className="space-y-1">
        <Link
          href="/cards"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          All sets
        </Link>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{setName}</h1>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {isLoading && cards.length === 0 ? "Loading…" : `${total} cards`}
          </p>
        </div>
      </header>

      <CardFilterBar filters={filters} onChange={setFilters} />

      {error ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : !isLoading && cards.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          No cards match these filters.
        </p>
      ) : (
        <CardGrid>
          {cards.map((card) => (
            <CardTile
              key={card.scryfallId}
              card={card}
              owned={ownedIds.has(card.scryfallId)}
              onClick={() => setSelectedId(card.scryfallId)}
            />
          ))}
          {isLoading ? (
            <CardGridSkeleton count={cards.length === 0 ? 18 : 6} />
          ) : null}
        </CardGrid>
      )}

      <div ref={sentinelRef} aria-hidden className="h-px" />
      {!isLoading && !error && hasMore ? (
        <Button
          variant="outline"
          size="sm"
          className="mx-auto"
          onClick={loadMore}
        >
          Load more
        </Button>
      ) : null}

      <CardDetailModal
        cardId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
    </CardPreviewProvider>
  );
}

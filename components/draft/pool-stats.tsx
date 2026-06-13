"use client";
import { computeDeckStats, type StatCard } from "@/lib/game/deck-stats";
import { DeckStatsPanel } from "@/components/cards/deck-stats-panel";
import type { CardListItemDto } from "@/lib/api/card-dto";

export function PoolStats({
  cardIds,
  cardCache,
  variant = "compact",
  className,
}: {
  cardIds: string[];
  cardCache: Map<string, CardListItemDto>;
  variant?: "compact" | "expanded";
  className?: string;
}) {
  const cards: StatCard[] = cardIds.map((id) => {
    const c = cardCache.get(id);
    return {
      typeLine: c?.typeLine ?? "",
      manaCost: c?.manaCost ?? "",
      cmc: c?.cmc ?? 0,
      colors: c?.colors ?? [],
      rarity: c?.rarity ?? "common",
      oracleText: c?.oracleText ?? "",
      quantity: 1,
    };
  });
  const stats = computeDeckStats(cards);
  return <DeckStatsPanel stats={stats} variant={variant} className={className} />;
}

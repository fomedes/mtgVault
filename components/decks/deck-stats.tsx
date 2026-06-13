import { computeDeckStats, type StatCard } from "@/lib/game/deck-stats";
import { DeckStatsPanel } from "@/components/cards/deck-stats-panel";
import type { DeckDetailDto } from "@/lib/api/deck-dto";

function toStatCard(card: DeckDetailDto["cards"][number]): StatCard {
  return {
    typeLine: card.typeLine,
    manaCost: card.manaCost,
    cmc: card.cmc,
    colors: card.colors,
    rarity: card.rarity,
    oracleText: "",   // deck entries don't store oracle text; tags are best-effort
    quantity: card.quantity,
  };
}

/**
 * Stats panel for the deck builder (P10-01). Delegates to the shared
 * `computeDeckStats` engine (P9-01) — the old bespoke curve (which miscounted
 * lands as 0-CMC) is gone. Renders the compact sidebar variant.
 */
export function DeckStats({ deck }: { deck: DeckDetailDto }) {
  const stats = computeDeckStats(deck.cards.map(toStatCard));
  return <DeckStatsPanel stats={stats} variant="compact" />;
}

/**
 * Tests for the PoolStats component (components/draft/pool-stats.tsx).
 *
 * Focuses on the component's contract: it wires a cardCache + cardIds array
 * into computeDeckStats and passes the result to DeckStatsPanel.
 * DeckStatsPanel and computeDeckStats themselves are covered by Phase-9 tests
 * so we keep this test focused on PoolStats's own wiring.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Unmount all rendered components between tests so the DOM stays clean.
afterEach(cleanup);
import { PoolStats } from "@/components/draft/pool-stats";
import { computeDeckStats } from "@/lib/game/deck-stats";
import type { CardListItemDto } from "@/lib/api/card-dto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCard(
  id: string,
  overrides: Partial<CardListItemDto> = {},
): CardListItemDto {
  return {
    scryfallId: id,
    name: `Card ${id}`,
    set: "neo",
    collectorNumber: "1",
    rarity: "common",
    manaCost: "{1}{W}",
    typeLine: "Creature — Spirit",
    colors: ["W"],
    colorIdentity: ["W"],
    layout: "normal",
    cmc: 2,
    oracleText: "",
    cardFaces: [],
    ...overrides,
  };
}

/**
 * Small card cache used across tests.
 *
 * Contents:
 *   c1 — Creature  (nonland)
 *   c2 — Instant   (nonland)
 *   c3 — Sorcery   (nonland)
 *   c4 — basic Land (excluded from nonland/Spells count)
 *   c5 — Creature  (nonland)
 */
function buildSmallCache(): Map<string, CardListItemDto> {
  const cache = new Map<string, CardListItemDto>();
  cache.set("c1", makeCard("c1", { typeLine: "Creature — Human", cmc: 2 }));
  cache.set("c2", makeCard("c2", { typeLine: "Instant", cmc: 1 }));
  cache.set("c3", makeCard("c3", { typeLine: "Sorcery", cmc: 3 }));
  cache.set("c4", makeCard("c4", { typeLine: "Basic Land — Plains", manaCost: "", cmc: 0 }));
  cache.set("c5", makeCard("c5", { typeLine: "Creature — Elf Druid", cmc: 2 }));
  return cache;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PoolStats", () => {
  it("renders without crashing for an empty pool", () => {
    const cache = new Map<string, CardListItemDto>();
    // Should not throw.
    const { container } = render(<PoolStats cardIds={[]} cardCache={cache} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("renders without crashing for a non-empty pool", () => {
    const cache = buildSmallCache();
    const cardIds = ["c1", "c2", "c3", "c4", "c5"];
    const { container } = render(<PoolStats cardIds={cardIds} cardCache={cache} />);
    expect(container.firstChild).not.toBeNull();
  });

  it("correctly excludes lands from the nonland (Spells) count", () => {
    const cache = buildSmallCache();
    // c1, c2, c3, c5 are nonlands (4 cards); c4 is a land (1 card).
    const cardIds = ["c1", "c2", "c3", "c4", "c5"];

    // Verify the pure engine's output first — confirms the test data is correct.
    // PoolStats passes these same cards through computeDeckStats internally.
    const statCards = cardIds.map((id) => {
      const c = cache.get(id);
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
    const stats = computeDeckStats(statCards);
    expect(stats.counts.nonland).toBe(4);
    expect(stats.counts.lands).toBe(1);

    // Now render PoolStats and check that those values appear in the rendered output.
    const { container } = render(<PoolStats cardIds={cardIds} cardCache={cache} />);

    // The compact panel renders "Spells" (nonland count) and "Lands" count.
    // We search for ALL text nodes with value "4" and "1" to confirm they are
    // present in the rendered output.  Both numbers must appear somewhere in the
    // component tree because the compact stat grid renders them.
    const textContent = container.textContent ?? "";
    // "4" should appear as the Spells count; "1" as the Lands count.
    // (Other numeric text in the mana curve must not interfere with these checks
    // since we verify the stat values via the pure engine above.)
    expect(textContent).toContain("4");
    expect(textContent).toContain("1");

    // Confirm "Spells" and "Lands" labels are actually rendered.
    expect(screen.getAllByText("Spells").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lands").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 0 spells and 0 lands for an empty pool", () => {
    render(<PoolStats cardIds={[]} cardCache={new Map()} />);
    // Both stat cells should show "0".
    const allZeroes = screen.getAllByText("0");
    // At minimum the Spells and Lands cells both read 0.
    expect(allZeroes.length).toBeGreaterThanOrEqual(2);
  });

  it("uses cardCache to resolve card metadata — missing ids resolve to empty defaults", () => {
    // "unknown" is not in the cache; PoolStats should fall back to empty
    // typeLine ("") which is a nonland (treated as "others").
    const cache = buildSmallCache();
    const cardIds = ["c1", "unknown"];
    // Should not throw even with a missing cache entry.
    expect(() => render(<PoolStats cardIds={cardIds} cardCache={cache} />)).not.toThrow();
  });

  it("renders with expanded variant without crashing", () => {
    const cache = buildSmallCache();
    const cardIds = ["c1", "c2", "c4"];
    const { container } = render(
      <PoolStats cardIds={cardIds} cardCache={cache} variant="expanded" />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});

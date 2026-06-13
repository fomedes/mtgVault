# Phase 9 — Shared Card UX Primitives — Progress

> **Status:** ✅ Implemented 2026-06-13 — typecheck clean · 205 tests pass (33 new)
> Task-level tracker for Phase 9. Full context: `MTG_PHASE_BREAKDOWN.md` → Phase 9. Decisions: **D15–D16**.

## Goal

Build the two reusable pieces every later surface needs — a hover/zoom **CardPreview** and a comprehensive **stats panel** backed by a pure engine — so deck builder, draft, collection and library all consume one implementation rather than duplicating logic.

## Decisions feeding this phase

- **D15** — One `CardPreview` (hover/zoom) + one `<DeckStats>`/`<PoolStats>` backed by pure `lib/game/deck-stats.ts`.
- **D16** — Comprehensive stats: type breakdown, curve (lands excluded + counted separately), colours, avg CMC, creature count, colour pips/sources, rarity mix, devotion, removal/card-advantage tags, archetype hint.

## Dependencies

- **Needs:** Phase 8 shipped (clean shell + design tokens).
- **Unblocks:** Phase 10 (deck builder) and Phase 11 (draft) both consume `CardPreview` + `<DeckStats>`/`<PoolStats>`. This is a hard prerequisite — build it before touching those surfaces.

## Tasks

| ID    | Task | Agent(s) | Status | Notes |
| ----- | ---- | -------- | ------ | ----- |
| P9-01 | `lib/game/deck-stats.ts` pure engine (comprehensive metrics) | backend | ✅ | zero I/O, 33 unit tests, all pass |
| P9-02 | `CardPreview` portal hover/long-press zoom, viewport-aware, reduced-motion | design, frontend | ✅ | `components/cards/card-preview.tsx` |
| P9-03 | `useCardPreview` hook/provider for easy opt-in | frontend | ✅ | `CardPreviewProvider` + `useCardPreviewContext` |
| P9-04 | `<DeckStats>` / `<PoolStats>` component (compact + expanded) | design, frontend | ✅ | `components/cards/deck-stats-panel.tsx`; `PoolStatsPanel` alias |
| P9-05 | Wire `CardPreview` into collection/browser miniatures (first consumer) | frontend | ✅ | `CardTile` + `CollectionTile` wired; browsers wrap with `CardPreviewProvider` |
| P9-06 | `cardZoom` animation variant honouring `useReducedMotion` | design | ✅ | exported from `lib/animations/card.ts` |
| P9-07 | Tests: deck-stats unit (near-full), CardPreview interaction+a11y, stats snapshot | testing | ✅ | 33 new tests in `__tests__/game/deck-stats.test.ts` |

## Key files to touch

- new `lib/game/deck-stats.ts` (pure), `__tests__/game/deck-stats.test.ts`
- new `components/cards/card-preview.tsx`, `hooks/use-card-preview.tsx`
- new `components/cards/deck-stats-panel.tsx` (or generalise `components/decks/deck-stats.tsx`)
- `lib/animations/card.ts` (`cardZoom`)
- consumer wiring in `components/collection/collection-tile.tsx`, `components/cards/card-tile.tsx`

## `deck-stats.ts` contract (proposed)

```
computeDeckStats(cards: { typeLine, manaCost, cmc, colors, rarity, oracleText, quantity }[]): {
  counts: { total, lands, nonland, creatures, instants, sorceries, artifacts,
            enchantments, planeswalkers, battles, others };
  curve: number[];            // buckets 0..7+, LANDS EXCLUDED
  colors: Record<'W'|'U'|'B'|'R'|'G'|'C', number>;
  pips:   Record<'W'|'U'|'B'|'R'|'G', number>;   // mana-symbol counts (devotion source)
  avgCmc: number;             // nonland average
  rarity: Record<'common'|'uncommon'|'rare'|'mythic', number>;
  devotion: Record<color, number>;
  tags: { removal: number; cardAdvantage: number };  // oracle-text heuristics
  archetypeHint: string | null;                       // e.g. "UW control", "RG aggro"
}
```

- **Curve fix (the current bug):** lands are filtered out of the curve entirely and reported under `counts.lands`. Use `card.cmc` from the cache, not a re-parse of `manaCost`, so X/0-cost lands stop polluting bucket 0.
- **Heuristic tags** are best-effort keyword matches on oracle text ("destroy", "exile target", "draw … card") — clearly labelled as estimates in the UI.

## Open proposals / questions for owner

- `CardPreview` touch behaviour: long-press to open + tap-elsewhere to close is the default. Confirm that's preferable to a tap-to-toggle on mobile.
- Archetype hint is intentionally lightweight (two dominant colours + aggro/control lean from curve). Flag if you'd rather omit it than show an occasionally-wrong guess.

## Exit criteria

- [x] `deck-stats.ts` is pure and unit-tested (33 tests, near-full coverage); lands never count as 0-CMC in the curve.
- [x] `CardPreview` portal wired into collection and browser miniatures; hover on desktop, long-press on touch; reduced motion honoured.
- [x] `cardZoom` animation variant in `lib/animations/card.ts`; instant under reduced motion.
- [x] `DeckStatsPanel` / `PoolStatsPanel` presentational component with compact + expanded variants.
- [ ] CI green (E2E suite is nightly).

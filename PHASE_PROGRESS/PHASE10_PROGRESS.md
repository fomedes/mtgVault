# Phase 10 — Deck Builder Overhaul — Progress

> **Status:** COMPLETE · Updated 2026-06-13
> Task-level tracker for Phase 10. Full context: `MTG_PHASE_BREAKDOWN.md` → Phase 10. Decisions: **D15–D16**.

## Goal

Bring the deck builder up to spec: comprehensive stats, a corrected curve, a type-grouped / CMC-sorted deck list, an advanced filter overlay on the card source, and hover-zoom on miniatures. Builds on Phase 6, consumes Phase 9.

## Decisions feeding this phase

- **D16** — Comprehensive stats replace the current Spells/Lands-only panel.
- **D15** — Reuse Phase 9's `CardPreview` + `<DeckStats>` (no bespoke versions).

## Dependencies

- **Needs:** Phase 9 shipped (`deck-stats.ts`, `CardPreview`, `<DeckStats>`).
- **Unblocks:** Phase 11 reuses the same filter overlay patterns and `<PoolStats>`.

## Tasks

| ID     | Task | Agent(s) | Status | Notes |
| ------ | ---- | -------- | ------ | ----- |
| P10-01 | Swap `deck-stats.tsx` to P9 engine + `<DeckStats>` (Comprehensive); delete buggy local curve | frontend | ✅ | delegates to `DeckStatsPanel` via `computeDeckStats` |
| P10-02 | Deck list: group by type, sort CMC asc then name; collapsible type headers + counts | frontend, design | ✅ | `groupAndSort` extracted to `lib/game/deck-sort.ts`; Artifacts/Enchantments priority over Creatures |
| P10-03 | Advanced filter overlay (Filters button) — type/colour/CMC min-max/power/toughness/rarity/owned-only | frontend, design | ✅ | `FilterDialog` in `card-source-pane.tsx`; ≥/= toggle per P/T field; active chip pills |
| P10-04 | Backend: extend `GET /api/cards` + collection query with new params (Zod, clamped) | backend | ✅ | `sets`, `power`/`powerOp`, `toughness`/`toughnessOp`, `ownedOnly`; $expr/$toDouble for GTE; `_id $in` for ownedOnly |
| P10-05 | Integrate `CardPreview` on source + deck-list miniatures | frontend | ✅ | `useCardPreviewContext` + `previewHandlers` on `SourceCardRow` and `DeckCardRow`; wrapped in `CardPreviewProvider` |
| P10-06 | Security review: param validation/bounds (no regex injection, clamped ranges) | security | ✅ | All external params Zod-validated; power/toughness clamped 0–20; sets capped at 20; ownedOnly resolved server-side; UserCollection looked up by uid |
| P10-07 | Tests: grouping/sort unit, filter-overlay E2E, mixed-deck stats, API integration | testing | ✅ | 21 deck-sort unit tests (`__tests__/game/deck-sort.test.ts`); 18 API filter tests added to `__tests__/cards-query.test.ts`; 234 tests total |

## Key files touched

- `components/decks/deck-stats.tsx` — delegates to `DeckStatsPanel` via `computeDeckStats`
- `components/decks/deck-builder.tsx` — `groupAndSort` from `lib/game/deck-sort`, collapsible `CardGroup`, `CardPreviewProvider`
- `components/decks/deck-card-row.tsx` — `useCardPreviewContext` + `previewHandlers`
- `components/decks/card-source-pane.tsx` — `FilterDialog` overlay with all new params; `SourceCardRow` with preview
- `lib/game/deck-sort.ts` (NEW) — pure `groupAndSort`, `dominantColorRank`, `TYPE_GROUPS`, `COLOR_RANK`
- `lib/api/cards-query.ts` — `sets`, `power/powerOp`, `toughness/toughnessOp`, `ownedOnly` params
- `app/api/cards/route.ts` — resolves `ownedCardIds` from UserCollection; passes to `buildCardFilter`
- `lib/models/Deck.ts` — `cmc` field on `deckCardSchema`
- `lib/api/deck-dto.ts` — `cmc: number` on `DeckCardDto`
- `lib/game/deck.ts` — passes `cmc` in `createDeck`/`patchDeck`
- `__tests__/game/deck-sort.test.ts` (NEW) — 21 unit tests for grouping + sort
- `__tests__/cards-query.test.ts` — 18 new tests for Phase 10 filter params

## Exit criteria

- [x] Stats panel shows full type breakdown + comprehensive analytics; curve excludes lands.
- [x] Deck list grouped by type and CMC-sorted; filters overlay covers all listed parameters; miniatures zoom on hover.
- [x] CI green (234/234 tests pass, typecheck clean).

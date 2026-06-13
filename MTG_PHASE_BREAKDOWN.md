# MTG Vault — Phase Breakdown

> Generated 2026-06-11 from `MTGVAULT_PROJECT_OVERVIEW.md` §14. This is the working plan: granular tasks per phase, agent assignments, and dependency ordering. The Orchestrator reads this file at the start of every phase. Update task status in place as work lands.
>
> **Expanded 2026-06-13:** Phases 0–7 shipped. A second wave (Phases 8–15) was added covering navigation/dashboard, theming, deck-builder & draft UX, history, set blocks, and friends. See decisions **D12–D19** below; each new phase has a companion `PHASE_PROGRESS/PHASEx_PROGRESS.md` for task-level tracking.

---

## 0. Resolved Decisions

These answers to the overview's §12 open questions (plus foundational tooling choices) were confirmed with the project owner on 2026-06-10/11 and **supersede the overview wherever they conflict**:

| #   | Decision                     | Resolution                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Card data source**         | **Scryfall API** (`api.scryfall.com`) — replaces `api.magicthegathering.io` everywhere in the overview. Actively maintained, complete sets, high-res images. Boosters are simulated server-side from cached set data (the overview already planned this in §8).                                                                                                                                                    |
| D2  | **Set scope**                | **Curated list** — admin-managed `enabled` flag per set; start with ~10–20 draftable sets, expandable via config/admin UI, never a code change.                                                                                                                                                                                                                                                                    |
| D3  | **Winston draft**            | **Deferred to backlog.** Phase 4 ships booster draft only. `DraftSession.format` enum keeps `winston` from day one so no migration is needed later.                                                                                                                                                                                                                                                                |
| D4  | **Deck building**            | Draft pick lists are **read-only records through Phase 5**; a full **Deck Builder is a committed Phase 6** (hard requirement, not a maybe).                                                                                                                                                                                                                                                                        |
| D5  | **Notifications**            | **In-app only** (bell + dashboard feed + Socket.io pushes). Email deferred to backlog; no schema changes required to add it later.                                                                                                                                                                                                                                                                                 |
| D6  | **Card image fallback**      | With Scryfall, coverage is near-total. The rare miss renders a **stylised CSS placeholder** (card frame with name, mana cost, colour identity). No Gatherer dependency.                                                                                                                                                                                                                                            |
| D7  | **Bot difficulty (Phase 7)** | Adopt the overview's §12.6 proposal: Easy = random, Medium = colour-preference heuristic, Hard = synergy/curve scoring.                                                                                                                                                                                                                                                                                            |
| D8  | **Test stack**               | **Vitest** (unit/integration) + **Playwright** (E2E). Playwright chosen specifically for multi-browser-context draft tests.                                                                                                                                                                                                                                                                                        |
| D9  | **Package manager**          | **pnpm**, lockfile committed from Phase 0.                                                                                                                                                                                                                                                                                                                                                                         |
| D10 | **Hosting**                  | **$0 to start:** Next.js on Vercel (free) + Socket.io server on **Render free tier** + MongoDB Atlas M0. Known tradeoff: Render sleeps after 15 min idle → first lobby visitor waits ~30–60 s cold start; active drafts stay awake. **Upgrade path:** Railway Hobby ($5/mo flat, always warm) if cold starts become annoying. Railway's free tier was rejected — its $1/mo credit hard-stops the server mid-month. |
| D11 | **Language/runtime**         | TypeScript strict mode everywhere; Node LTS; latest stable Next.js (App Router).                                                                                                                                                                                                                                                                                                                                   |

### Expansion decisions (Phases 8–15, confirmed with the owner 2026-06-13)

The owner reviewed Phases 0–7 and commissioned a second wave of work (navigation/dashboard, theming, deck-builder and draft UX, history, set blocks, friends). These decisions scope Phases 8–15 and supersede earlier wording where they conflict:

| #   | Decision                  | Resolution                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D12 | **Dashboard composition** | The navbar is the **single canonical menu**. The dashboard's "Quick Links" panel (a duplicate of the navbar) is **removed** and replaced with data widgets: collection snapshot, resume-draft, recent decks, achievement progress, and a friends-activity widget (placeholder until P14).                                                                                              |
| D13 | **Navigation overhaul**   | Mobile nav becomes a **burger-triggered overlay**; desktop keeps the inline bar. Labels renamed: Draft → **Multiplayer Draft**, Solo → **Phantom Draft**, Collection → **My Collection**, Browse → **Card Library** (Home/Shop/Decks/History unchanged). "Drafts played" becomes **X/Y** (X = multiplayer, Y = phantom) with a "Multiplayer / Phantom" caption.                          |
| D14 | **Theming & backgrounds** | Fix the card/background clash by adjusting the background theme token so black card borders read against the page. Add a user-selectable MTG **wallpaper** layer: assets in `public/backgrounds/`, **WebP @ ~2560×1440, < 400 KB each**, rendered as a fixed, dimmed/blurred subtle layer behind content; choice stored on `User.preferences`, "None" is the default.                     |
| D15 | **Shared card primitives**| Two reusable pieces built once and consumed by deck builder, draft, collection and library: a **hover/zoom card preview** (`CardPreview`) and a **stats panel** backed by a pure `lib/game/deck-stats.ts` engine. No duplicated stats/preview logic per surface.                                                                                                                        |
| D16 | **Stats depth**           | **Comprehensive**: full type breakdown (creature/instant/sorcery/artifact/enchantment/planeswalker/battle/land), mana curve with **lands excluded and counted separately**, colour breakdown, average CMC (nonland), creature count, colour-pip/source counts, rarity mix, colour devotion, removal/card-advantage tags (oracle-text heuristics), and lightweight archetype hints.     |
| D17 | **Friends & social**      | Friendship via a per-user **numeric friend code** with a request/accept flow. Friends unlock: direct draft-lobby invites, presence/activity surfacing, and **read-only collection & deck viewing** (foundation for future trading).                                                                                                                                                   |
| D18 | **Set blocks**            | Add a `block` field to `Set`; the Card Library groups sets under **collapsible block sections** (standalone sets in their own section). Seed the original **Ravnica block** (`rav`, `gpt`, `dis`) and **Urza block** (`usg`, `ulg`, `uds`) to prove grouping; **correct the `usa` → `usg` set-code typo** in the seed. Blocks are intentionally incomplete for now — foundation only.    |
| D19 | **Phantom drafts in history** | Phantom (solo) draft completions are recorded as **read-only pick lists** (no collection ingest, no VC) so they appear in **Draft History** and can seed the Deck Builder. History is filterable **All / Multiplayer / Phantom**, and the dashboard counter splits accordingly.                                                                                                    |

---

## 1. Phase Dependency Graph

```
P0 Foundation
 └─► P1 Card Browser        (needs: auth, DB, Scryfall client)
      └─► P2 Collection      (needs: Card cache, browser components)
           └─► P3 Economy    (needs: collection ingest for packs)
                └─► P4 Draft (needs: ingest + wallet + booster generator)
                     └─► P5 Dashboard & Polish (needs: data from all systems)
                          └─► P6 Deck Builder  (committed; needs: collection + saved drafts)
                               └─► P7 Phantom Solo Draft (needs: draft engine)

P0–P7 shipped ─► expansion (added 2026-06-13):
 P8  Navigation, Dashboard & Theming    (nav overlay · dashboard widgets · background/wallpapers)
  └─► P9  Shared Card UX Primitives      (hover-zoom CardPreview + pure deck-stats engine)
       ├─► P10 Deck Builder Overhaul     (stats · curve fix · type+CMC sort · filter overlay · zoom)
       └─► P11 Draft Experience Overhaul (MP/phantom UI parity · save list · completion stats)
            └─► P12 Draft History & Records (record all drafts + filter All/MP/Phantom)
 P13 Card Library & Set Blocks   (independent — needs P1 cache; collapsible blocks + new sets)
 P14 Friends & Social            (independent vertical — codes · invites · read-only sharing)
 P15 Ideas Backlog               (unscheduled; owner sign-off before promotion)
Backlog: Winston draft · email notifications · scheduled draft sessions
```

Phases are strictly sequential. A phase begins only when the previous phase's **exit criteria** are all met. (Overview rule: _no feature phase starts until Phase 0 infrastructure is confirmed working._)

Agent workflow inside every phase (overview §6.2):
**db → backend → frontend**, with **design** producing primitives early, **security** reviewing every backend change, and **testing** adding tests behind each agent's output. Conflicts go to the **orchestrator**, never agent-to-agent.

---

## Phase 0 — Foundation & Tooling

> **Status (2026-06-11):** P0-01 … P0-17 implemented and verified locally (typecheck, lint, 17 unit tests, 3 E2E smoke tests, production build — all green). Remaining for exit: owner completes SETUP.md (Firebase project, Atlas cluster, `.env.local`, allowlist seed), verifies live sign-in, and pushes to GitHub to light up CI.

**Goal:** A running skeleton: Next.js + Tailwind + Firebase allowlist auth + MongoDB wired up, Socket.io server booting, CI green.
**Manual prerequisites (project owner):** create the Firebase project (Google provider enabled), the MongoDB Atlas M0 cluster, and a GitHub repo; paste credentials into `.env.local`.

| ID    | Task                                                                                                        | Agent(s)          | Depends on   |
| ----- | ----------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| P0-01 | `git init`, `.gitignore`, README stub, push to GitHub                                                       | orchestrator      | —            |
| P0-02 | Scaffold Next.js (App Router, TS strict) + Tailwind + pnpm; repo layout per overview §13                    | frontend          | P0-01        |
| P0-03 | ESLint + Prettier + `typecheck` script                                                                      | frontend          | P0-02        |
| P0-04 | shadcn/ui init; Tailwind theme tokens: MTG colour-identity palette, rarity colours, dark mode default       | design            | P0-02        |
| P0-05 | `lib/db/` Mongo connection helper (cached across dev hot reloads)                                           | db                | P0-02        |
| P0-06 | `User` Mongoose model + indexes (`uid` unique)                                                              | db                | P0-05        |
| P0-07 | Firebase client SDK init (`lib/firebase/`), Google Sign-In flow                                             | backend           | P0-02        |
| P0-08 | Firebase Admin SDK init (`lib/firebase-admin/`) + ID-token verification helper                              | backend           | P0-07        |
| P0-09 | Auth middleware: verify token → upsert User → **enforce allowlist on every protected call**                 | security, backend | P0-06, P0-08 |
| P0-10 | Login page; `(protected)` route guard; "not on the list" rejection screen                                   | frontend          | P0-09        |
| P0-11 | Seed script: create first admin + allowlist entries from CLI                                                | db                | P0-06        |
| P0-12 | `server/` Socket.io skeleton: boot, health endpoint, Firebase token + allowlist handshake, CORS origin lock | backend, security | P0-08        |
| P0-13 | `.env.local.example` (all var names per CLAUDE.md) + Zod env validation at boot of both processes           | security          | P0-02        |
| P0-14 | Vitest setup + first unit tests (env validation, auth middleware with mocked Admin SDK)                     | testing           | P0-09        |
| P0-15 | Playwright setup + auth smoke E2E (allowlisted in, non-allowlisted rejected)                                | testing           | P0-10        |
| P0-16 | GitHub Actions CI: install → lint → typecheck → unit tests → build (E2E job optional/nightly)               | testing           | P0-03, P0-14 |
| P0-17 | `.claude/agents/*.md` definitions mirroring the CLAUDE.md roster                                            | orchestrator      | P0-02        |

**Exit criteria**

- `pnpm dev` serves the app; `pnpm dev:socket` boots the Socket.io server with a passing health check.
- An allowlisted Google account signs in and reaches an empty dashboard; a non-allowlisted account sees the rejection screen.
- CI is green on `main`; `.env.local.example` is complete; no secret appears in the repo.

---

## Phase 1 — Card Browser

> **Status (2026-06-11):** P1-01 … P1-09, P1-11, P1-12 implemented and verified locally (lint, typecheck, 74 unit/integration tests, 7 E2E tests incl. authenticated browse + DFC flip, production build — all green). All 12 curated sets (KTK, DOM, MH2, NEO, ONE, LTR, WOE, LCI, MKM, OTJ, BLB, DSK — 5,360 cards) synced into Atlas; warm re-sync confirmed at zero Scryfall requests. Browse UX decision: infinite scroll with URL-synced filters. Remaining for exit: P1-10 Vercel deploy (owner-guided) + CI green on main.

**Goal:** Browse and search the curated sets with full card detail, backed by a Scryfall cache layer that respects API etiquette.

| ID    | Task                                                                                                                                                                                                                                                                                                                                                  | Agent(s)     | Depends on          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------- |
| P1-01 | Scryfall client (`lib/mtg-api/`): typed fetch wrapper, ≤10 req/s throttle + 100 ms spacing, retry with backoff on 429/5xx, identifying `User-Agent`                                                                                                                                                                                                   | api          | P0 done             |
| P1-02 | `Card` + `Set` models, Scryfall-shaped: `scryfallId`, `oracleId`, `name`, `set`, `collectorNumber`, `rarity`, `colors`, `colorIdentity`, `typeLine`, `manaCost`, `cmc`, `oracleText`, `flavorText`, `imageUris`, `cardFaces[]` (DFC), `layout`, `legalities`, `inBooster`, `cachedAt`. Indexes: `{set, collectorNumber}` unique, text index on `name` | db           | P0 done             |
| P1-03 | Curated-set seed: `Set.enabled` flag + seed script with the initial set list (owner picks codes; placeholder list until then)                                                                                                                                                                                                                         | db, api      | P1-02               |
| P1-04 | Set sync job: `/sets/:code` metadata + paginated `/cards/search?q=e:CODE&unique=prints` upsert with `cachedAt`; CLI `pnpm sync:set <code>`; TTLs per overview (7 d sets / 30 d cards)                                                                                                                                                                 | api          | P1-01, P1-02, P1-03 |
| P1-05 | Rulings: fetch `/cards/:id/rulings` on demand, cache 30 d                                                                                                                                                                                                                                                                                             | api          | P1-01, P1-02        |
| P1-06 | REST API: `GET /api/sets` (enabled only), `GET /api/cards` (filters: set, color, rarity, type, subtype, cmc, legality, partial name; paginated), `GET /api/cards/:id` (+ rulings). All params Zod-validated                                                                                                                                           | backend      | P1-02, P1-04        |
| P1-07 | Design primitives: `Card` component (image + D6 placeholder fallback), rarity-coloured accents, responsive grid (`2/3/4–6` cols per §10), skeleton loaders; `cardHover` + `cardFlip` variants in `lib/animations/card.ts` with `useReducedMotion`                                                                                                     | design       | P0-04               |
| P1-08 | Browser pages `/cards`: set list → set view, filter bar, name search, pagination/infinite scroll                                                                                                                                                                                                                                                      | frontend     | P1-06, P1-07        |
| P1-09 | Card detail modal: full art, oracle + flavor text, rulings; double-faced flip animation; bottom sheet on mobile / dialog on desktop                                                                                                                                                                                                                   | frontend     | P1-05, P1-07        |
| P1-10 | Deploy Next.js to Vercel (preview + prod) against Atlas; smoke-check live                                                                                                                                                                                                                                                                             | orchestrator | P1-08               |
| P1-11 | Security review: filter-param validation, no query injection, `express-rate-limit`-equivalent on API routes                                                                                                                                                                                                                                           | security     | P1-06               |
| P1-12 | Tests: throttle/retry unit; sync job vs mocked Scryfall; filter API integration; E2E browse → filter → modal → DFC flip                                                                                                                                                                                                                               | testing      | P1-08, P1-09        |

**Exit criteria**

- All curated sets synced into Atlas; sync logs cache hits/misses; zero Scryfall calls on a warm browse path.
- Browsing is smooth at 375 px and desktop; DFC cards flip; CI green; Vercel deploy live.

---

## Phase 2 — User Collection

**Goal:** Per-user collections with the ingest service every later phase (shop, draft) will reuse, plus list export.

| ID    | Task                                                                                                                                                                          | Agent(s) | Depends on   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ | ----- |
| P2-01 | `UserCollection` model + indexes (`userId` unique; `cards.cardId`)                                                                                                            | db       | P1 done      |
| P2-02 | **Ingest service** `lib/game/collection.ts`: `addCards(userId, cardIds[], obtainedVia)` — atomic upsert of quantities, the single entry point for draft/booster/admin sources | backend  | P2-01        |
| P2-03 | API: `GET /api/collection` (filter/sort/group params), `GET /api/collection/export?format=text                                                                                | mtgo`    | backend      | P2-02 |
| P2-04 | Admin-only grant endpoint (give cards for testing until the shop exists)                                                                                                      | backend  | P2-02        |
| P2-05 | Collection UI: grid with quantity badges, group by set/colour, filters reusing P1 browser components, empty state                                                             | frontend | P2-03, P1-07 |
| P2-06 | Export UI: copy-to-clipboard + file download in both formats                                                                                                                  | frontend | P2-03        |
| P2-07 | `cardEnterCollection` animation (scale pulse + shine sweep)                                                                                                                   | design   | P1-07        |
| P2-08 | "Owned" badge in the card browser                                                                                                                                             | frontend | P2-03, P1-08 |
| P2-09 | Security review: users can only ever read/write their own collection; admin grant gated by role                                                                               | security | P2-03, P2-04 |
| P2-10 | Tests: ingest unit (duplicates, quantity merge, source tagging), export format unit, API integration, E2E view + export                                                       | testing  | P2-05        |

**Exit criteria**

- Cards granted via admin endpoint appear instantly in the collection UI with correct quantities and source tags.
- Exported MTGO list round-trips correctly. CI green.

---

## Phase 3 — Economy & Shop

**Goal:** Vault Coins with an audit trail, atomic booster purchases with the opening animation, achievements, daily bonus, and the admin dashboard.

| ID    | Task                                                                                                                                                                                                                                                                          | Agent(s)                    | Depends on          |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------- |
| P3-01 | `Transaction` model + indexes (`userId + createdAt`)                                                                                                                                                                                                                          | db                          | P2 done             |
| P3-02 | **Wallet service**: atomic credit/debit (guarded `$inc`, balance can never go negative), every mutation writes a `Transaction` — the only path that touches `vaultCoins`                                                                                                      | backend                     | P3-01               |
| P3-03 | Daily login bonus: idempotent per UTC day, awarded on first authenticated request. Assign a first time bonus equal to booster price, so user can open a booster without waiting days or playing drafts.                                                                       | backend                     | P3-02               |
| P3-04 | `Achievement` model + declarative engine (defs: `first_draft`, `collection_100`, …) with VC rewards through the wallet                                                                                                                                                        | db, backend                 | P3-02               |
| P3-05 | **Booster generator** `lib/game/booster.ts`: 15-card pack simulated from cached cards (`inBooster` flag; slots: 10 C / 3 U / 1 R-or-M at ~1:8 mythic / 1 basic land; rates configurable per set). Known simplification: classic draft-booster model, not modern play boosters | api, backend                | P1-04               |
| P3-06 | Shop API: `GET /api/shop` (pack catalog from enabled sets, server-side prices), `POST /api/shop/purchase` — one atomic flow: debit → generate → ingest (P2-02) → log                                                                                                          | backend                     | P3-02, P3-05, P2-02 |
| P3-07 | Shop UI: catalog, VC balance, purchase flow with confirm                                                                                                                                                                                                                      | frontend                    | P3-06               |
| P3-08 | Pack-opening experience: `packShuffle` → `cardReveal` fan-out → per-card flip → `rarityGlow` on rare/mythic; full-screen takeover on mobile with swipe-to-dismiss                                                                                                             | design, frontend            | P3-07               |
| P3-09 | Admin dashboard `/admin`: user list, VC grant, allowlist toggle, curated-set management, pack price config — all actions role-gated server-side                                                                                                                               | frontend, backend, security | P3-02, P1-03        |
| P3-10 | Security review: prices resolved server-side only, purchase idempotency, double-spend race audit, rate limits on purchase route                                                                                                                                               | security                    | P3-06               |
| P3-11 | Tests: concurrent-purchase race (no negative balance, no double-spend), booster rarity distribution over N packs, daily-bonus idempotency, E2E buy → open → cards in collection                                                                                               | testing                     | P3-08               |

**Exit criteria**

- Full loop works: admin grants VC → user buys pack → opening animation → cards land in collection → transaction log shows both entries.
- Race tests pass under concurrency. CI green.

---

## Phase 4 — Live Multiplayer Draft

**Goal:** 2–8 player real-time booster draft with lobby, timers, reconnect, and post-draft payout. The riskiest phase — engine logic stays pure and exhaustively unit-tested before any socket wiring.

| ID    | Task                                                                                                                                                                                                                                    | Agent(s)              | Depends on          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------- |
| P4-01 | `DraftSession` model per overview §4 (format enum includes `winston`, unused for now) + `SavedDeck` model (read-only draft record per D4)                                                                                               | db                    | P3 done             |
| P4-02 | **Draft engine** (pure functions, `lib/game/draft.ts`, zero I/O): seating, 3×15 pack generation (reuses P3-05), pass left/right/left by round, pick validation, auto-pick on timer expiry, round/pick advancement, completion detection | backend               | P3-05               |
| P4-03 | Socket server state layer: in-memory active sessions + Mongo persistence checkpoints after every pick (crash recovery)                                                                                                                  | backend               | P4-01, P4-02        |
| P4-04 | Lobby events: create room (set + timer 30–90 s config), join by short code, leave, ready, host-start                                                                                                                                    | backend               | P4-03               |
| P4-05 | Draft events: per-player pack state (**own pack only**), pick submission + ack, timer broadcast, others' progress as public info (picks count, connected)                                                                               | backend               | P4-03               |
| P4-06 | Reconnect: re-auth on handshake, full state resync for the rejoining seat, grace period, auto-pick for disconnected players                                                                                                             | backend               | P4-05               |
| P4-07 | Completion flow: ingest picks via P2-02 → save `SavedDeck` → award VC via P3-02 (base + participation bonus) → fire `first_draft` achievement                                                                                           | backend               | P4-05, P2-02, P3-02 |
| P4-08 | `Notification` model + in-app invites: bell badge, socket push to invited users, dashboard surfacing later (P5)                                                                                                                         | db, backend, frontend | P4-04               |
| P4-09 | Zustand draft store + socket lifecycle hook (connect/auth/reconnect/cleanup)                                                                                                                                                            | frontend              | P4-04               |
| P4-10 | Lobby UI: create/join by code, roster with ready states, config display, invite sharing                                                                                                                                                 | frontend              | P4-09               |
| P4-11 | Draft room UI: pack grid with `cardDraft` pick animation, timer ring, picked-cards tray, player status rail; mobile = vertical card list, tap to pick (§10)                                                                             | frontend, design      | P4-09               |
| P4-12 | Draft history page + read-only saved deck view + export (reuses P2 export)                                                                                                                                                              | frontend              | P4-07               |
| P4-13 | Deploy Socket.io server to **Render free**; lock CORS to the Vercel domain; document cold-start behaviour + Railway Hobby upgrade path in README                                                                                        | orchestrator          | P4-06               |
| P4-14 | Security review: server-authoritative audit — no client ever receives another player's pack or the hidden pool; pick validated against current pack server-side; handshake auth + allowlist; origin restriction                         | security              | P4-05, P4-06        |
| P4-15 | Tests: exhaustive engine state-machine unit suite (pass direction, edge seats, timeouts, completion); multi-client socket integration (simulated 4-player draft); reconnect mid-draft; 2-browser-context Playwright E2E                 | testing               | P4-07, P4-11        |

**Exit criteria**

- A full 2+ player draft runs on the deployed stack end-to-end: lobby → 45 picks each → collections updated → VC awarded → history visible.
- Kill a client mid-draft: it reconnects and resumes its seat; a never-returning player gets auto-picks and the draft completes.
- Engine coverage ≥ 70% (target: near-total — it's pure logic). CI green.

---

## Phase 5 — Dashboard & Polish

**Goal:** The dashboard ties every system together; performance, mobile, and accessibility sweeps across the whole app.

| ID    | Task                                                                                                                                                | Agent(s)                  | Depends on |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------- |
| P5-01 | Dashboard API: summary stats (cards, drafts played, VC), merged activity feed (transactions + achievements + drafts), pending invites, open lobbies | backend                   | P4 done    |
| P5-02 | Dashboard UI: stat cards, activity feed, invite list, rule-based recommendations ("You can afford a Dominaria booster")                             | frontend, design          | P5-01      |
| P5-03 | Achievements page: locked/unlocked grid with VC rewards                                                                                             | frontend                  | P3-04      |
| P5-04 | Notification center: bell history, mark-as-read                                                                                                     | frontend                  | P4-08      |
| P5-05 | Performance pass: Next/Image strategy audit, virtualise large card grids, bundle analysis, ISR tuning on set pages                                  | frontend                  | P5-02      |
| P5-06 | Mobile QA sweep: every route at 375 px → desktop, nav behaviour per §10                                                                             | frontend, design, testing | P5-02      |
| P5-07 | Accessibility + reduced-motion audit: keyboard nav, focus management in modals, contrast on rarity colours, `prefers-reduced-motion` everywhere     | design                    | P5-02      |
| P5-08 | E2E regression suite consolidation: stable critical-path suite (auth, browse, buy/open, draft, collection)                                          | testing                   | P5-06      |

**Exit criteria**

- Dashboard reflects real activity live. Mobile clean on all routes. Reduced-motion honoured. CI runs the consolidated E2E suite green.

---

## Phase 6 — Deck Builder _(committed — hard requirement per D4)_

**Goal:** Saved draft lists become editable decks validated against the owned collection. Originals stay read-only.

| ID    | Task                                                                                                      | Agent(s)          | Depends on |
| ----- | --------------------------------------------------------------------------------------------------------- | ----------------- | ---------- |
| P6-01 | `Deck` model: name, cards + quantities, unlimited basic lands, optional `sourceDraftId`                   | db                | P5 done    |
| P6-02 | Deck CRUD API with ownership validation: non-basic quantities must not exceed owned collection quantities | backend           | P6-01      |
| P6-03 | Builder UI: collection picker, deck list pane, mana curve + colour breakdown, autosave                    | frontend, design  | P6-02      |
| P6-04 | "Edit as deck" action on saved draft records — copies into a new `Deck`, original record untouched        | frontend, backend | P6-02      |
| P6-05 | Export updated for decks (text + MTGO, mainboard/sideboard)                                               | backend           | P6-02      |
| P6-06 | Security review (ownership) + tests (validation edge cases, builder E2E)                                  | security, testing | P6-03      |

**Exit criteria**

- Draft a deck → edit it within owned cards → export. Attempting to add unowned cards is rejected server-side. CI green.

---

## Phase 7 — Phantom Solo Draft

**Goal:** Single-player practice draft against bots. Phantom: no collection ingest, no VC (configurable later).

| ID    | Task                                                                                                                                                  | Agent(s) | Depends on   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------ |
| P7-01 | Bot strategy interface + **Easy** (random pick)                                                                                                       | backend  | P6 done      |
| P7-02 | **Medium**: colour-preference heuristic (commit to 2 colours from early picks)                                                                        | backend  | P7-01        |
| P7-03 | **Hard**: synergy/curve scoring (rarity weight, curve fit, colour discipline)                                                                         | backend  | P7-02        |
| P7-04 | Solo draft service: reuses the P4-02 engine with bot-filled seats; `phantom` flag bypasses ingest/VC; runs over REST (no socket needed for one human) | backend  | P7-01, P4-02 |
| P7-05 | Solo draft UI: same draft-room components, instant or simulated bot pick delays, difficulty selector                                                  | frontend | P7-04        |
| P7-06 | Results summary + practice history (separate from real draft history)                                                                                 | frontend | P7-04        |
| P7-07 | Tests: bot strategy determinism with seeded RNG, pick-quality sanity assertions, full solo-draft integration                                          | testing  | P7-04        |

**Exit criteria**

- A solo draft against 7 bots completes in under 10 minutes; phantom cards never reach the real collection. CI green.

---

## Phase 8 — Navigation, Dashboard & Theming

> **Status (2026-06-13):** ✅ Implemented (typecheck + Phase-8 lint + 172 tests green; live QA pending). Per-task tracking in `PHASE_PROGRESS/PHASE8_PROGRESS.md`.

**Goal:** A coherent navigation shell (canonical menu, mobile overlay, corrected labels), a dashboard that surfaces real activity instead of a duplicate of the navbar, and a background system that no longer clashes with black card borders — plus optional, subtle MTG wallpapers. Implements **D12–D14**.

| ID    | Task                                                                                                                                                                                          | Agent(s)          | Depends on   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------ |
| P8-01 | Add a `preferences` subdoc to `User` (`background` id; room for future UI prefs) with a safe default; no migration needed (defaults on read)                                                  | db                | P7 done      |
| P8-02 | Theme fix: adjust the `--background`/card-surface tokens in `app/globals.css` so black card borders separate from the page; re-verify dark **and** light mode contrast                       | design            | P7 done      |
| P8-03 | Wallpaper assets: curate 4–6 MTG-themed WebP wallpapers in `public/backgrounds/` (~2560×1440, < 400 KB each) + a `lib/backgrounds.ts` manifest (id, label, file, credit)                     | design            | P8-02        |
| P8-04 | `BackgroundLayer` component: fixed full-viewport, dimmed/blurred scrim behind content, reads the user preference, honours `useReducedMotion`; "None" is the default                          | frontend, design  | P8-03        |
| P8-05 | Background picker UI (in a profile/settings menu) → `PATCH /api/me/preferences` route persisting to `User.preferences`; optimistic localStorage apply for instant feedback                   | frontend, backend | P8-01, P8-04 |
| P8-06 | Navbar refactor: single source-of-truth menu config; rename labels (Multiplayer Draft, Phantom Draft, My Collection, Card Library); keep active-state logic                                  | frontend          | P7 done      |
| P8-07 | Mobile burger → full-screen/overlay menu (scrim + focus trap, Esc/scrim close, reduced-motion); desktop inline bar unchanged                                                                 | frontend, design  | P8-06        |
| P8-08 | Dashboard API: split draft counts (multiplayer = `SavedDeck` count; phantom = completed `SoloDraftSession` count) + widget payloads (collection snapshot, in-progress drafts, recent decks, achievement progress) | backend           | P7 done      |
| P8-09 | Dashboard redesign: **remove Quick Links**, add a widget grid — stat cards (incl. **X/Y** "Multiplayer / Phantom" drafts), resume-draft, recent decks, achievements progress, friends-activity (placeholder until P14) | frontend, design  | P8-08        |
| P8-10 | Security review: preferences route auth + Zod validation; background id is an allowlisted enum (no path traversal/SSRF); asset size/type sanity                                              | security          | P8-05        |
| P8-11 | Tests: nav active-state + mobile-overlay E2E, preferences API unit/integration, dashboard split-count unit, background-picker persistence E2E                                                | testing           | P8-09        |

**Exit criteria**

- Mobile shows a burger overlay menu; desktop shows the inline bar; all labels are renamed; active states are correct.
- The dashboard has no duplicated nav links; widgets reflect real data; the drafts stat reads **X/Y** with the "Multiplayer / Phantom" caption.
- A selected wallpaper persists across reload/sessions; card borders are clearly separated from the background in both dark and light mode. CI green.

---

## Phase 9 — Shared Card UX Primitives

> **Status (2026-06-13):** ✅ Implemented — typecheck clean · 205 tests pass (33 new). Per-task tracking in `PHASE_PROGRESS/PHASE9_PROGRESS.md`.

**Goal:** Build the two reusable pieces every later surface needs — a hover/zoom card preview and a comprehensive stats panel backed by a **pure** engine — so deck builder, draft, collection and library all consume one implementation. Implements **D15–D16**.

| ID    | Task                                                                                                                                                                                                                                                                                                           | Agent(s)         | Depends on |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| P9-01 | `lib/game/deck-stats.ts` (pure, zero I/O): from a card list compute type breakdown, mana curve (**lands excluded**, bucketed 0…7+), colour breakdown, average CMC (nonland), creature count, colour-pip/source counts, rarity mix, colour devotion, removal/card-advantage tags (oracle-text heuristics), archetype hint | backend          | P8 done    |
| P9-02 | `CardPreview` shareable component: hover (desktop) / long-press or tap (touch) shows an enlarged card in a portal layer; viewport-aware positioning, image prefetch, instant fallback under reduced motion, keyboard focusable                                                                                  | design, frontend | P8 done    |
| P9-03 | `useCardPreview` hook/provider so any miniature list opts in with minimal wiring                                                                                                                                                                                                                              | frontend         | P9-02      |
| P9-04 | `<DeckStats>` / `<PoolStats>` presentational component consuming P9-01: compact (sidebar) and expanded variants; colour/rarity tokens from the design system                                                                                                                                                  | design, frontend | P9-01      |
| P9-05 | Wire `CardPreview` into the existing collection/browser miniatures as the first consumer (proves shareability)                                                                                                                                                                                                | frontend         | P9-03      |
| P9-06 | `cardZoom` animation variant in `lib/animations/` honouring `useReducedMotion`                                                                                                                                                                                                                                | design           | P9-02      |
| P9-07 | Tests: deck-stats engine unit suite toward near-full coverage (curve excludes lands, type buckets, devotion, tags); `CardPreview` interaction + a11y; `DeckStats` render snapshot                                                                                                                              | testing          | P9-01, P9-04 |

**Exit criteria**

- `deck-stats.ts` is pure and unit-tested (target near-full coverage); lands never count as 0-CMC in the curve.
- Hovering any miniature in the collection shows a readable enlarged card; touch uses long-press; reduced motion is honoured. CI green.

---

## Phase 10 — Deck Builder Overhaul

> **Status (2026-06-13):** **COMPLETE.** All tasks shipped. 234/234 tests pass, typecheck clean. Per-task tracking in `PHASE_PROGRESS/PHASE10_PROGRESS.md`.

**Goal:** Bring the deck builder up to spec — comprehensive stats, a corrected curve, a type-grouped / CMC-sorted list, an advanced filter overlay on the card source, and hover-zoom on miniatures. Builds on Phase 6 and consumes Phase 9.

| ID     | Task                                                                                                                                                                                                  | Agent(s)         | Depends on   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------ |
| P10-01 | Replace `components/decks/deck-stats.tsx` internals with the P9-01 engine + `<DeckStats>` (Comprehensive); delete the local buggy curve (lands no longer counted as 0-CMC)                            | frontend         | P9 done      |
| P10-02 | Deck list (`deck-list.tsx` / `deck-card-row.tsx`): group by full card type, sort within each group by **CMC ascending** then name (replaces pick order); collapsible type headers with counts        | frontend, design | P9 done      |
| P10-03 | Advanced filter overlay on the card source pane: keep the text searchbox, add a **Filters** button opening an overlay — type, colour/colour-identity, block & set (multi), CMC min/max, name, power, toughness, rarity, owned-only; shared filter state | frontend, design | P9 done      |
| P10-04 | Backend: extend `GET /api/cards` (and the collection query) to accept the new params (`cmcMin`/`cmcMax`, `power`, `toughness`, `block`, multi-`set`, `ownedOnly`) with Zod validation/clamping       | backend          | P10-03       |
| P10-05 | Integrate `CardPreview` (P9-02) on all deck-builder miniatures (source pane + deck list)                                                                                                             | frontend         | P9 done      |
| P10-06 | Security review: new query params validated/bounded (no regex injection, numeric ranges clamped, multi-value caps)                                                                                   | security         | P10-04       |
| P10-07 | Tests: list grouping/sort unit, filter-overlay E2E, stats render with a mixed deck, query-param API integration                                                                                      | testing          | P10-02, P10-04 |

**Exit criteria**

- The stats panel shows the full type breakdown + comprehensive analytics; the curve excludes lands.
- The deck list is grouped by type and CMC-sorted; the source pane has a working filters overlay covering all listed parameters; miniatures zoom on hover. CI green.

---

## Phase 11 — Draft Experience Overhaul

> **Status (2026-06-13):** COMPLETE. typecheck clean · 266 tests pass (28 new). Per-task tracking in `PHASE_PROGRESS/PHASE11_PROGRESS.md`.

**Goal:** Make multiplayer and phantom drafts share **one UI** (logic differs only in backend transport: socket vs REST), give the picking phase more room, add hover-zoom to picked cards, add a live draft stats panel, and turn the completion screen into a richer, **saveable** summary. Consumes Phase 9; implements the recording half of **D19**.

| ID     | Task                                                                                                                                                                                                                                       | Agent(s)         | Depends on        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------- |
| P11-01 | Audit & unify draft-room components so `draft-room.tsx` (MP) and `solo-draft-room.tsx` (phantom) render the **same** presentational components, differing only in the data/transport hook (socket vs REST)                                | frontend         | P9 done           |
| P11-02 | Picking layout: move the picked tray to the **bottom**; give the active booster more space and larger cards; mobile = vertical list per §10                                                                                               | frontend, design | P11-01            |
| P11-03 | Picked tray: integrate `CardPreview` (P9-02) so each picked miniature zooms to a readable card                                                                                                                                            | frontend         | P9 done, P11-01   |
| P11-04 | Live draft stats: embed `<PoolStats>` (P9-04) over the picked pool (curve/types/colours/archetype hint) during and after the draft                                                                                                       | frontend         | P9 done           |
| P11-05 | Save-list flow: on completion persist the human seat's picks as a read-only record — including **phantom** drafts (new `format`/`kind: 'phantom'` flag; **no ingest, no VC**); add a "Build a deck" CTA seeding the Deck Builder (reuses P6-04) | backend, db      | P11-01            |
| P11-06 | Completion screen redesign: pool summary + `<PoolStats>`, pick timeline, set/difficulty/seat context, export, and "Build a deck" / "Save list" actions                                                                                    | frontend, design | P11-04, P11-05    |
| P11-07 | Parity QA: confirm both draft types expose identical affordances (save, stats, hover, layout)                                                                                                                                             | testing          | P11-06            |
| P11-08 | Security review: server stays authoritative; phantom save writes only the owner's own picks; **no ingest/VC path** is triggered for phantom                                                                                               | security         | P11-05            |
| P11-09 | Tests: phantom completion saves a record without ingest/VC, completion stats render, layout E2E (mobile + desktop), MP/phantom parity snapshot                                                                                            | testing          | P11-05, P11-06    |

**Exit criteria**

- A phantom draft and a multiplayer draft present an identical picking and completion UI.
- Finishing either draft offers to save the list and build a deck; phantom saves never touch the collection or wallet.
- The picking phase gives the booster more room; picked cards zoom on hover; a stats panel reflects the pool. CI green.

> **Cross-phase note:** P11-05 adds a `format`/`kind` discriminator to the saved draft record; Phase 12 reads it. Coordinate the schema between P11 and P12 (db agent owns both).

---

## Phase 12 — Draft History & Records

> **Status (2026-06-13):** COMPLETE. typecheck clean · 276 tests pass (10 new). Per-task tracking in `PHASE_PROGRESS/PHASE12_PROGRESS.md`.

**Goal:** Register **every** draft (multiplayer and phantom) and let users filter history by type. Implements the surfacing half of **D19**. (Today `/api/history` reads only `SavedDeck`, i.e. multiplayer; the `draftsPlayed` counter likewise undercounts phantom drafts.)

| ID     | Task                                                                                                                                                                | Agent(s)         | Depends on |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| P12-01 | Data: ensure phantom drafts produce history records (from P11-05); persist `kind` (`'multiplayer'` \| `'phantom'`) + `difficulty` (phantom) on the saved record + index | db               | P11 done   |
| P12-02 | History API: merge multiplayer + phantom records, return `kind`, support `?kind=all\|multiplayer\|phantom` (Zod-validated), keep 50-item paging                     | backend          | P12-01     |
| P12-03 | History UI: type filter (All / Multiplayer / Phantom), per-row kind badge, phantom rows show difficulty; empty states per filter                                    | frontend, design | P12-02     |
| P12-04 | Detail view handles both kinds (phantom has no co-players — show bots/difficulty instead)                                                                           | frontend         | P12-02     |
| P12-05 | Security review: users read only their own history; phantom records carry no economy side effects                                                                  | security         | P12-02     |
| P12-06 | Tests: mixed-history API filter unit/integration, history E2E (filter switch), phantom detail render                                                                | testing          | P12-03     |

**Exit criteria**

- Completed phantom and multiplayer drafts both appear in history; the All/Multiplayer/Phantom filter works; each row is correctly typed; the dashboard X/Y counter agrees with history. CI green.

---

## Phase 13 — Card Library & Set Blocks

> **Status (2026-06-13):** COMPLETE. typecheck clean · 298 tests pass (22 new). Per-task tracking in PHASE_PROGRESS/PHASE13_PROGRESS.md.

**Goal:** Group expansions into **collapsible block sections** and lay the data foundation for blocks, seeding two real blocks to validate it. Implements **D18**.

| ID     | Task                                                                                                                                                                       | Agent(s)        | Depends on |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------- |
| P13-01 | Add `block` (id), `blockName`, and ordering fields (`blockOrder`, `setOrderInBlock`) to the `Set` model; backfill existing sets where applicable; index `{ block: 1 }`    | db              | P1 done    |
| P13-02 | `lib/blocks.ts` registry mapping set code → block (id, name, order) so seeds **and** the sync job set block deterministically                                              | db, api         | P13-01     |
| P13-03 | Seed new sets — original **Ravnica block** (`rav`, `gpt`, `dis`) + **Urza block** (`usg`, `ulg`, `uds`); **fix the `usa` → `usg` typo** in `scripts/seed-sets.ts`; run `pnpm sync:set --all` to cache them | db, api         | P13-02     |
| P13-04 | Sets API: `GET /api/sets` returns block-grouped data (or provide a grouping helper); enabled-only still enforced                                                          | backend         | P13-02     |
| P13-05 | Card Library UI: collapsible block sections (block header + member set tiles) with a "Standalone Sets" section for blockless sets; remember expand/collapse; set click → existing card grid | frontend, design | P13-04     |
| P13-06 | Graceful partial blocks: blocks whose sets aren't synced yet render as greyed / "coming soon" tiles instead of breaking                                                   | frontend        | P13-05     |
| P13-07 | Security/etiquette review: new-set sync is cache-first, throttled, identifying UA (no Scryfall etiquette regressions)                                                     | security, api   | P13-03     |
| P13-08 | Tests: block-grouping API/unit, block-registry unit, library E2E (expand block → open set)                                                                                | testing         | P13-05     |

**Exit criteria**

- The Card Library shows Ravnica and Urza sets grouped under collapsible block headers, with standalone sets separate; new sets are synced cache-first with zero redundant Scryfall calls on warm paths. CI green.

> **Scope note:** blocks are intentionally incomplete (only Ravnica + Urza seeded). This proves the foundation, not full historical coverage.

---

## Phase 14 — Friends & Social

> **Status (2026-06-13):** Not started. Independent vertical. Per-task tracking in `PHASE_PROGRESS/PHASE14_PROGRESS.md`.

**Goal:** A friend system keyed on numeric codes with request/accept, draft-lobby invites, presence/activity, and **read-only** collection & deck viewing. Implements **D17**.

| ID     | Task                                                                                                                                                                                | Agent(s)         | Depends on |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- |
| P14-01 | `User.friendCode` (unique numeric, generated on first need) + `Friendship` model (pair, `status: 'pending'\|'accepted'`, requester) with indexes preventing duplicate pairs        | db               | P12 done   |
| P14-02 | Friends API: send request by code, accept/decline, list friends + pending (in/out), remove friend; Zod-validated; rate-limited                                                     | backend          | P14-01     |
| P14-03 | Presence: derive online/last-seen from the socket connection + `lastLoginAt`; expose through the friends list                                                                      | backend          | P14-02     |
| P14-04 | Notifications: friend-request + request-accepted events reuse the `Notification` model + socket push                                                                               | backend          | P14-02     |
| P14-05 | Friends page UI: your code (copy/share), add-by-code, roster with presence, incoming/outgoing requests, remove                                                                     | frontend, design | P14-02     |
| P14-06 | Draft invites to friends: invite a friend straight into a lobby from the roster or lobby UI                                                                                         | frontend, backend | P14-05     |
| P14-07 | Read-only friend views: a friend's collection and decks (read-only, gated by an accepted friendship)                                                                               | backend, frontend | P14-02     |
| P14-08 | Dashboard friends-activity widget — fills the P8-09 placeholder                                                                                                                    | frontend         | P14-07     |
| P14-09 | Security review: friendship required for any friend-data read; **no user enumeration by code** (rate-limit + generic errors); can't act on non-friends; collection/deck reads scoped to accepted friends | security         | P14-07     |
| P14-10 | Tests: request/accept flow unit/integration, code-enumeration rate-limit test, read-only friend-collection E2E, invite-friend-to-draft E2E                                         | testing          | P14-07     |

**Exit criteria**

- Two users can befriend via code, see each other's presence, view each other's collection/decks read-only, and invite each other to drafts. Non-friends can access none of it. CI green.

---

## Phase 15 — Ideas Backlog _(unscheduled — owner sign-off before promotion)_

> **Status (2026-06-13):** Parking lot, not a committed phase. Per-task tracking stub in `PHASE_PROGRESS/PHASE15_PROGRESS.md`. Nothing here is built until the owner promotes it to a real phase.

Ideas surfaced during the expansion. Each is sized roughly and tagged with what it builds on:

| Idea                                  | Builds on        | Notes                                                                                                  |
| ------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| **Trading between friends**           | P14, wallet      | The natural next step after read-only friend views; needs an escrow/confirm flow + audited transfers. |
| **Sealed pool format**                | booster, P10     | Open 6 packs → build from the pool; reuses the booster generator + deck builder.                       |
| **Cube support**                      | draft engine     | Custom curated card pools for drafting instead of real sets.                                           |
| **Deck goldfish / opening-hand sim**  | P10              | Draw 7 + mulligan on a built deck for quick testing.                                                   |
| **Collection completion meter**       | P13 blocks       | "% of set/block collected" progress bars; nudges toward shop/trades.                                   |
| **Wishlist completion nudges**        | existing wishlist decks | "You're N cards from finishing this deck" — surface on dashboard/shop.                          |
| **Post-draft pick insights**          | P9 archetype tags | "Best card in pack" / signal hints on the completion screen.                                          |
| **Expanded achievements**             | P11, P13, P14    | First friend, first phantom draft, complete a block, etc.                                              |
| **Extra export/import formats**       | export service   | Arena / Moxfield clipboard formats in addition to text + MTGO.                                         |
| **Accent theming by colour identity** | P8 theming       | Optional guild/colour accent on top of the wallpaper layer.                                            |
| **PWA / installable + offline browse**| —                | Service worker for offline collection/library browsing.                                                |

---

## Backlog (deliberately unscheduled)

| Item                         | Origin        | Notes                                                                        |
| ---------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Winston draft                | D3            | Pile-based 2-player engine variant + UI; schema already supports it          |
| Email notifications          | D5            | Adds a delivery service (e.g. Resend); `Notification` model already in place |
| Scheduled draft sessions     | Overview §2.6 | Calendar-style planning of future drafts; P5 ships open-lobby surfacing only |
| Hosting upgrade              | D10           | Render free → Railway Hobby ($5/mo) if cold starts annoy the group           |
| Configurable phantom rewards | Overview §2.7 | Let solo drafts optionally award cards/VC                                    |

---

## Risk Register

| Risk                                                 | Mitigation                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scryfall etiquette violations (rate/UA)              | Client enforces ≤10 req/s + spacing + identifying UA; cache-first design means warm paths make zero external calls; bulk-data endpoint available if a full-catalogue sync is ever needed |
| Render free cold start (~30–60 s)                    | Accepted tradeoff (D10); documented in README; lobby UI shows a "waking the server…" state; upgrade path defined                                                                         |
| Atlas M0 512 MB ceiling                              | Curated set scope keeps the card cache ~50–80 MB; monitor via Atlas alerts before enabling many more sets                                                                                |
| Booster accuracy vs real products                    | P3-05 uses the classic 15-card model deliberately (matches overview §2.4); per-set slot config allows refinement later                                                                   |
| Draft state loss on server crash                     | P4-03 checkpoints to Mongo after every pick; reconnect/resume restores from the checkpoint                                                                                               |
| Firebase private key handling across three platforms | Key lives only in Vercel/Render env vars (base64-encoded), validated at boot (P0-13); never in the repo                                                                                  |

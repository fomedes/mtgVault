# MTG Vault — Phase Breakdown

> Generated 2026-06-11 from `MTGVAULT_PROJECT_OVERVIEW.md` §14. This is the working plan: granular tasks per phase, agent assignments, and dependency ordering. The Orchestrator reads this file at the start of every phase. Update task status in place as work lands.

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
| P3-03 | Daily login bonus: idempotent per UTC day, awarded on first authenticated request                                                                                                                                                                                             | backend                     | P3-02               |
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

# MTG Draft & Collection Platform — Project Overview

> **Purpose:** This document is the authoritative reference for Claude Code phase planning, agent configuration, and architectural decisions. It covers the full scope of a private, fan-use Magic: The Gathering web application for drafting and collecting cards.

---

## 1. Project Identity

| Field            | Value                                                                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**         | MTG Draft & Collection Platform (working title: `mtg-vault`)                                                                                                                                                                                                                |
| **Type**         | Private fan-use web application (non-commercial)                                                                                                                                                                                                                            |
| **Access Model** | Invite-only; no public registration                                                                                                                                                                                                                                         |
| **IP Notice**    | All Magic: The Gathering card names, artwork, and game mechanics are IP of Wizards of the Coast. This app is for personal/private use only and must not be distributed commercially. Card data is sourced exclusively from the public MTG API (`api.magicthegathering.io`). |

---

## 2. High-Level Feature Map

### 2.1 Authentication & Access Control

- Firebase Authentication, Google Sign-In only (to start)
- Allowlist-based access: only pre-approved Google accounts can log in
- Admin role (manual flag in MongoDB) for currency grants and user management
- No public registration page — login page exists but rejected accounts see a "not on the list" message

### 2.2 Full Card Collection Browser

- Browse all Magic cards by expansion/set
- Filters: set, color, type, rarity, CMC (converted mana cost), subtype, format legality
- Search by card name (partial match)
- Card detail modal with full art, rules text, rulings, and flavor text
- Animated card flip for double-faced cards

### 2.3 Personal Collection

- Each user has their own collection (cards + quantities)
- Cards enter the collection via:
  - **Draft winnings** (cards picked during a live draft are auto-added)
  - **Booster pack opening** from the in-game shop
- Collection view: filterable, sortable, grouped by set or color
- Export deck list (plain text, MTGO format)

### 2.4 Live Multiplayer Draft

- Lobby system: a user creates a draft room, selects a set, invites other users (2–8 players)
- Draft engine: Winston draft or standard booster draft format
  - Standard booster draft: 3 packs of 15 cards each, pass left/right per round
- Real-time card passing via **Socket.io** (see architecture recommendation in §5)
- Timer per pick (configurable 30–90 seconds)
- Post-draft: cards auto-added to each player's collection; draft pick list saved as a deck
- Reconnect support: player can rejoin a draft in progress
- Draft history: view past drafts and the picks made

### 2.5 In-Game Economy & Shop

- **Currency:** "Vault Coins" (VC) — earned and admin-granted, never purchasable with real money
- **Earning VC:**
  - Completing a draft: base reward + bonus for participation
  - Daily login bonus
  - Achievement milestones (first draft, 100-card collection, etc.)
- **Admin grants:** Admin users can award VC to any user via the admin dashboard
- **Shop:**
  - Booster packs (cost configurable per set)
  - Packs use the `/sets/:id/booster` endpoint from the MTG API
  - Opening animation: cards fan out with flip animation, rarities highlighted
- Transaction log stored per user

### 2.6 User Dashboard

- Summary stats: total cards, drafts played, VC balance
- Recent activity feed
- Active draft invitations / lobby notifications
- Recommended actions (e.g. "You have enough VC for a Dominaria booster")
- Upcoming/scheduled draft sessions

### 2.7 Phantom Solo Draft _(Phase 5 — Future)_

- Single-player draft against AI bots
- Bots use heuristic or ML-based pick strategies
- Full draft experience without needing other online users
- Cards earned do **not** go to the real collection (phantom = for practice only, unless configured otherwise)
- Deferred: requires bot logic design and is independent of all other phases

---

## 3. Technology Stack

### 3.1 Frontend

| Layer            | Choice                           | Rationale                                                 |
| ---------------- | -------------------------------- | --------------------------------------------------------- |
| Framework        | **Next.js 14+ (App Router)**     | SSR for card browsing, SSG for set pages, great DX        |
| Styling          | **Tailwind CSS** (mandatory)     | Utility-first, responsive, dark-mode ready                |
| UI Components    | **shadcn/ui** on top of Tailwind | Accessible, composable, unstyled by default               |
| Animations       | **Framer Motion**                | Card flips, hover lifts, booster opens, transitions       |
| State Management | **Zustand**                      | Lightweight global state for draft room, collection cache |
| Real-time Client | **Socket.io-client**             | Draft room communication                                  |
| Auth Client      | **Firebase SDK (client)**        | Google Sign-In flow                                       |

### 3.2 Backend

| Layer           | Choice                                          | Rationale                                                                                                                                               |
| --------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | **Node.js + Express** or **Next.js API Routes** | API routes for simple endpoints; dedicated Express server for Socket.io                                                                                 |
| Real-time       | **Socket.io**                                   | Best fit for turn-based multiplayer with reconnect support; lower complexity than raw WebSockets, more control than Firebase Realtime DB for game state |
| Auth Middleware | **Firebase Admin SDK**                          | Validates Firebase ID tokens server-side                                                                                                                |
| Database        | **MongoDB** (via Mongoose)                      | Document model fits card collections and draft state naturally                                                                                          |
| ODM             | **Mongoose**                                    | Schema validation, virtuals, middleware hooks                                                                                                           |
| External API    | **magicthegathering.io v1**                     | Card and set data; cached aggressively in MongoDB                                                                                                       |

> **Why Socket.io over Firebase Realtime DB for draft?**
> The draft engine has complex turn-order logic, timers, and reconnect scenarios that benefit from server-authoritative state. Socket.io gives full control over the game loop on a Node server, whereas Firebase Realtime DB would push game logic into the client or Cloud Functions, increasing complexity and cost unpredictably.

### 3.3 Infrastructure & Auth

| Layer               | Choice                                                        |
| ------------------- | ------------------------------------------------------------- |
| Auth Provider       | Firebase Authentication (Google OAuth)                        |
| Hosting (suggested) | Vercel (Next.js frontend) + Railway/Render (Socket.io server) |
| Database Hosting    | MongoDB Atlas (free tier initially)                           |
| Environment Config  | `.env.local` + Vercel/Railway env vars                        |
| Image CDN           | Gatherer image URLs (from API) + Next.js Image optimization   |

---

## 4. Data Models (MongoDB / Mongoose)

### `User`

```
{
  uid: String,           // Firebase UID
  email: String,
  displayName: String,
  photoURL: String,
  role: enum['user', 'admin'],
  vaultCoins: Number,
  createdAt: Date,
  lastLoginAt: Date,
  isAllowlisted: Boolean
}
```

### `Card` _(local cache of MTG API)_

```
{
  mtgId: String,         // SHA1 id from API
  multiverseId: Number,
  name: String,
  set: String,           // set code e.g. "KTK"
  setName: String,
  rarity: String,
  colors: [String],
  type: String,
  manaCost: String,
  cmc: Number,
  text: String,
  imageUrl: String,
  layout: String,        // normal, double-faced, split, flip
  number: String,
  power: String,
  toughness: String,
  cachedAt: Date
}
```

### `UserCollection`

```
{
  userId: String,        // Firebase UID
  cards: [{
    cardId: ObjectId,    // ref: Card
    quantity: Number,
    obtainedVia: enum['draft', 'booster', 'admin'],
    obtainedAt: Date
  }]
}
```

### `DraftSession`

```
{
  code: String,          // short join code e.g. "KTKT-7X"
  hostUserId: String,
  set: String,
  format: enum['booster', 'winston'],
  status: enum['lobby', 'active', 'completed', 'abandoned'],
  players: [{
    userId: String,
    displayName: String,
    seatIndex: Number,
    isConnected: Boolean,
    picks: [ObjectId]    // ref: Card
  }],
  packs: [[ObjectId]],   // server-side pack state (hidden from clients)
  currentRound: Number,
  currentPick: Number,
  pickTimerSeconds: Number,
  createdAt: Date,
  completedAt: Date
}
```

### `Transaction`

```
{
  userId: String,
  type: enum['draft_reward', 'daily_login', 'achievement', 'admin_grant', 'booster_purchase'],
  amount: Number,        // positive = credit, negative = debit
  description: String,
  relatedId: String,     // draftSessionId, packId, etc.
  createdAt: Date
}
```

### `Achievement`

```
{
  userId: String,
  key: String,           // e.g. "first_draft", "collection_100"
  unlockedAt: Date,
  vcRewarded: Number
}
```

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│   Next.js App Router + Tailwind + Framer Motion + Zustand   │
│   ┌───────────────┐  ┌───────────────┐  ┌────────────────┐  │
│   │  Card Browser │  │  Collection   │  │  Draft Room    │  │
│   │  (SSR/SSG)    │  │  Dashboard    │  │ (Socket.io)    │  │
│   └───────────────┘  └───────────────┘  └────────────────┘  │
└──────────────┬──────────────────────────────────┬───────────┘
               │ HTTPS REST (Next.js API Routes)  │ WS (Socket.io)
               ▼                                  ▼
┌──────────────────────────┐      ┌──────────────────────────────┐
│  Next.js API Routes      │      │  Socket.io Server (Node.js)  │
│  /api/collection         │      │  Draft game loop             │
│  /api/shop               │      │  Timer management            │
│  /api/users (admin)      │      │  Pack state machine          │
│  /api/transactions       │      │  Reconnect handling          │
│  (Firebase ID token      │      │  (Firebase token auth        │
│   verified via Admin SDK)│      │   on handshake)              │
└──────────┬───────────────┘      └──────────────┬───────────────┘
           │                                     │
           ▼                                     ▼
┌──────────────────────────────────────────────────────────────┐
│                     MongoDB Atlas                            │
│   Users │ Cards (cache) │ Collections │ Drafts │ Transactions│
└──────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────┐
│  MTG API (external)      │
│  api.magicthegathering.io│
│  Rate limit: 5000 req/hr │
│  Cached in MongoDB       │
└──────────────────────────┘
```

### API Caching Strategy

The MTG API is rate-limited to 5,000 req/hr. To avoid hitting limits:

- Sets and card data for a given set are fetched once and stored in MongoDB with a `cachedAt` timestamp
- Cache TTL: 7 days for sets; 30 days for cards (card data rarely changes)
- A background sync job refreshes stale sets on demand or on a weekly cron
- Booster pack generation (`/sets/:id/booster`) is called per pack opening but can be simulated server-side from cached card data to reduce external calls

---

## 6. Claude Code Agent Architecture

The project uses a **multi-agent orchestration** model in Claude Code. One **Orchestrator Agent** manages the overall task flow and delegates to specialist sub-agents.

### 6.1 Agent Roster

#### 🎯 Orchestrator Agent (`orchestrator`)

- Reads this file and the phase breakdown as its primary context
- Decomposes tasks into sub-tasks and assigns to specialist agents
- Aggregates outputs, resolves conflicts between agents
- Tracks phase completion and surfacing blockers
- **When to invoke manually:** When starting a new phase, or when a task spans multiple domains (e.g., "add booster shop" touches backend, frontend, DB schema, and tests)

#### 🖥️ Frontend Agent (`agent-frontend`)

- Owns: `app/`, `components/`, `hooks/`, `store/`, `styles/`
- Responsibilities: Next.js pages, React components, Tailwind styling, Framer Motion animations, responsive layouts, Socket.io client integration
- Follows: mobile-first Tailwind breakpoints; dark mode by default; card animation patterns defined in shared design tokens
- Escalates to Orchestrator: when a UI change requires a new API endpoint

#### ⚙️ Backend Agent (`agent-backend`)

- Owns: `server/` (Socket.io server), `app/api/` (Next.js API routes), `lib/db/`, `lib/firebase-admin/`
- Responsibilities: REST endpoints, Socket.io event handlers, Firebase Admin token verification, MongoDB queries via Mongoose, game logic (draft state machine, pack generation)
- Escalates to Orchestrator: when schema changes affect frontend models

#### 🗄️ Database Agent (`agent-db`)

- Owns: `lib/models/`, `lib/db/`, migration scripts
- Responsibilities: Mongoose schema design, indexes, seed data, migration scripts, query optimization
- Works alongside Backend Agent; produces schema files that Backend Agent imports
- Escalates to Orchestrator: schema changes that break existing API contracts

#### 🔌 API Integration Agent (`agent-api`)

- Owns: `lib/mtg-api/`, caching layer, API sync jobs
- Responsibilities: MTG API client (with rate-limit handling + retry), local cache management, booster pack simulation from cached data, set/card sync jobs
- Key concern: never exceed 5,000 req/hr; prefer cache; log cache misses
- Escalates to Orchestrator: if MTG API changes schema or endpoints become unreliable

#### 🔒 Security Agent (`agent-security`)

- Owns: Firebase Auth allowlist enforcement, API route middleware, Socket.io auth handshake, environment variable hygiene
- Responsibilities: verify Firebase ID tokens on every protected route, enforce allowlist check on login, sanitize all user inputs, prevent draft state tampering (server-authoritative), CORS configuration, rate limiting on own API
- Runs a security review pass at the end of each phase before merge
- Escalates to Orchestrator: any endpoint lacking auth, any client-trusted game state

#### 🧪 Testing Agent (`agent-testing`)

- Owns: `__tests__/`, `cypress/` (or `playwright/`), `jest.config.js`
- Responsibilities: unit tests (Vitest/Jest) for game logic and utilities, integration tests for API routes, E2E tests (Playwright) for auth flow + draft flow + shop
- Generates test stubs when Backend/Frontend agents create new modules
- Escalates to Orchestrator: coverage drops below 70% on critical paths (auth, draft engine, shop)

#### 🎨 Design System Agent (`agent-design`)

- Owns: `components/ui/`, `styles/globals.css`, Tailwind config, animation presets
- Responsibilities: shared Tailwind theme (MTG color identity palette, card rarity colours), Framer Motion variants library (card flip, hover, booster open reveal), responsive grid system, dark/light mode tokens
- Invoked early in each phase to produce component primitives before feature agents build on them

### 6.2 Agent Communication Protocol

```
Orchestrator receives task
  → Breaks into sub-tasks with agent assignments
  → Agents work in dependency order:
       DB Agent → Backend Agent → Frontend Agent
       (Security Agent reviews each backend change)
       (Testing Agent adds tests after each agent's output)
  → Orchestrator integrates and runs smoke check
  → If conflicts: Orchestrator arbitrates, never agents directly
```

### 6.3 CLAUDE.md (Project Root)

A `CLAUDE.md` file at the project root configures Claude Code's behaviour for this repo:

- Lists all agents and their ownership boundaries
- Defines commit conventions (conventional commits)
- Defines the "no client-side game state" rule for draft
- Defines env variable names (never hardcode secrets)
- References this overview and the phase breakdown

---

## 7. Development Phases

| Phase | Name                   | Key Deliverables                                                                                                                    | Agents Active                            |
| ----- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **0** | Foundation & Tooling   | Repo setup, Next.js + Tailwind + Firebase + MongoDB wired up, CI pipeline, `CLAUDE.md`, env config, allowlist auth                  | All agents bootstrapping                 |
| **1** | Card Browser           | Full card/set browser, MTG API cache layer, filters, card detail modal, double-face flip animation                                  | api, db, frontend, design                |
| **2** | User Collection        | Personal collection UI, collection schema, post-draft ingest hook (stub), export deck list                                          | db, backend, frontend                    |
| **3** | Economy & Shop         | Vault Coins model, transaction log, booster shop, pack opening animation, admin VC grant, daily login reward                        | db, backend, frontend, security          |
| **4** | Live Multiplayer Draft | Draft lobby, Socket.io server, booster draft engine, real-time pick UI, timer, reconnect, post-draft collection save, draft history | backend, frontend, db, security, testing |
| **5** | Dashboard & Polish     | User dashboard, activity feed, notifications, achievements, performance optimisation, mobile QA sweep                               | frontend, design, testing                |
| **6** | Phantom Solo Draft     | Bot heuristics, solo draft mode, practice UI (cards not added to real collection)                                                   | backend, frontend, testing               |

---

## 8. MTG API Integration Details

### Base URL

`https://api.magicthegathering.io/v1`

### Endpoints Used

| Endpoint                       | Usage                                           | Cache TTL                 |
| ------------------------------ | ----------------------------------------------- | ------------------------- |
| `GET /sets`                    | Load all sets for browser                       | 7 days                    |
| `GET /sets/:code`              | Set detail (booster schema)                     | 7 days                    |
| `GET /sets/:code/booster`      | Generate booster pack                           | Per request (or simulate) |
| `GET /cards?set=:code&page=:n` | Fetch all cards for a set (paginated, 100/page) | 30 days                   |
| `GET /cards/:id`               | Single card detail                              | 30 days                   |

### Rate Limit Handling

- 5,000 requests/hour limit
- All fetched data stored in MongoDB with `cachedAt`
- API agent checks cache before making external requests
- Exponential backoff on 403 rate-limit responses
- Set card sync is paginated and queued (not burst-fetched)
- Booster packs: prefer server-side simulation from cached set card pool when `booster` field is present in set data

### Key Fields Used by the App

- `imageUrl` (may be absent for older cards — fallback to placeholder)
- `layout` (detect double-faced, split, flip for animation handling)
- `rarity` (drives pack slot logic and UI colour coding)
- `set` + `number` (canonical card identity)
- `multiverseid` (fallback image URL via Gatherer)

---

## 9. Card Animation Design

All card animations are implemented with **Framer Motion** and defined as reusable variants in `lib/animations/card.ts`:

| Animation             | Trigger                    | Description                                                     |
| --------------------- | -------------------------- | --------------------------------------------------------------- |
| `cardHover`           | Mouse enter on card        | Lift (translateY -8px) + subtle glow by rarity colour           |
| `cardFlip`            | Click on double-faced card | 3D rotateY 180° with backface-hidden, shows back face           |
| `cardReveal`          | Booster pack opening       | Sequential fan-out from deck stack, then individual flip reveal |
| `cardDraft`           | Picking a card in draft    | Card slides from pack toward player area                        |
| `cardEnterCollection` | Card added to collection   | Brief scale pulse + shine sweep                                 |
| `packShuffle`         | Before opening a booster   | Pack shakes slightly, then tears open                           |
| `rarityGlow`          | On reveal of rare/mythic   | Colour-appropriate particle burst (gold/orange)                 |

All animations respect `prefers-reduced-motion` via Framer Motion's `useReducedMotion` hook.

---

## 10. Responsive & Mobile Strategy

- **Mobile-first Tailwind**: all components designed at 375px base, scaled up
- Navigation: hamburger menu on mobile → collapsible sidebar on tablet → persistent sidebar on desktop
- Draft UI: vertical card list on mobile (no horizontal scroll required); tap to pick
- Card grid: 2 cols on mobile, 3 on tablet, 4–6 on desktop (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6`)
- Card modal: full-screen bottom sheet on mobile; centred dialog on desktop
- Booster opening: full-screen takeover on mobile with swipe-to-dismiss

---

## 11. Security Considerations

- **No client-side trust**: draft state lives only on the Socket.io server; clients receive only their own hand and public info
- **Firebase ID token verification** on every API route and Socket.io handshake via Firebase Admin SDK
- **Allowlist enforcement**: checked on every protected API call, not only at login
- **Admin actions** (VC grant, user management) gated by `role: 'admin'` check server-side
- **Input sanitisation**: all query params validated with Zod before use in MongoDB queries
- **No secrets in frontend**: Firebase client config uses public keys only; Admin SDK private key is server-only env var
- **CORS**: API server locked to the app's domain; Socket.io origin-restricted
- **Rate limiting**: own API routes rate-limited with `express-rate-limit` to prevent abuse

---

## 12. Open Questions / Decisions to Revisit

These items are intentionally deferred and should be resolved before the relevant phase begins:

1. **Draft format variants** — Should Winston Draft be included in Phase 4 alongside booster draft, or deferred to a later iteration?
2. **Card image fallback** — Some older cards lack `imageUrl`. Use Gatherer image URL (`gatherer.wizards.com/...`) as fallback, or a stylised placeholder with card name/colour?
3. **Set scope** — Should the app surface _all_ MTG sets (~500+) or a curated list? A curated list improves UX and reduces sync overhead significantly.
4. **Deck building** — Should saved draft lists be editable as full decks (add/remove cards from collection)? Or are they read-only draft records?
5. **Notifications** — Draft invitations: in-app only, or also email via Firebase (requires email auth)?
6. **Bot difficulty levels** — When Phase 6 arrives, define 2–3 difficulty tiers. Easy = random pick; Medium = colour-preference heuristic; Hard = MTGA-style synergy scoring.

---

## 13. Repository Structure (Proposed)

```
mtg-vault/
├── CLAUDE.md                    # Claude Code agent config & project rules
├── MTG_PLATFORM_PROJECT_OVERVIEW.md
├── MTG_PHASE_BREAKDOWN.md       # (generated next — detailed phase tasks)
├── app/                         # Next.js App Router
│   ├── (auth)/login/
│   ├── (protected)/
│   │   ├── dashboard/
│   │   ├── collection/
│   │   ├── cards/               # Full card browser
│   │   ├── draft/
│   │   │   ├── lobby/
│   │   │   └── [sessionId]/     # Live draft room
│   │   └── shop/
│   └── api/                     # Next.js API routes
│       ├── auth/
│       ├── cards/
│       ├── collection/
│       ├── draft/
│       ├── shop/
│       └── admin/
├── components/
│   ├── ui/                      # Design system primitives (shadcn base)
│   ├── cards/                   # Card, CardGrid, CardModal, CardFlip
│   ├── draft/                   # DraftBoard, PackDisplay, PickTimer
│   ├── shop/                    # BoosterPack, PackOpening, ShopItem
│   └── layout/                  # Nav, Sidebar, MobileMenu
├── lib/
│   ├── animations/              # Framer Motion variant library
│   ├── db/                      # MongoDB connection
│   ├── models/                  # Mongoose schemas
│   ├── mtg-api/                 # MTG API client + cache logic
│   ├── firebase-admin/          # Admin SDK init + token verify
│   └── game/                    # Draft engine, pack logic, VC rules
├── server/                      # Standalone Socket.io server
│   ├── index.ts
│   ├── handlers/                # draft, lobby, timer handlers
│   └── state/                   # In-memory draft session state
├── store/                       # Zustand stores (UI state, draft client)
├── hooks/                       # Custom React hooks
├── styles/
│   └── globals.css
├── __tests__/
├── e2e/                         # Playwright tests
├── .env.local.example
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## 14. First Steps for Claude Code

When this document is loaded into Claude Code, the Orchestrator Agent should:

1. Read this file in full
2. Ask the user to confirm or adjust the **Open Questions** in §12 before Phase 0 begins
3. Generate `MTG_PHASE_BREAKDOWN.md` with granular task lists per phase, agent assignments per task, and dependency ordering
4. Generate `CLAUDE.md` at the repo root with agent definitions, coding conventions, and project rules
5. Begin Phase 0: scaffold the repo, install dependencies, wire up Firebase + MongoDB + Next.js + Tailwind, create the allowlist auth middleware skeleton

**Do not begin implementation of any feature phase until Phase 0 infrastructure is confirmed working.**

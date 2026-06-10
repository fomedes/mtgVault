# CLAUDE.md — MTG Vault

Private, invite-only, non-commercial MTG drafting & collection web app for a small group of friends. All card names/art/mechanics are Wizards of the Coast IP — never add monetisation, public registration, or distribution features.

## Core references

| File                           | Role                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------- |
| `MTGVAULT_PROJECT_OVERVIEW.md` | Authoritative spec: features, data models, architecture, agent roster                          |
| `MTG_PHASE_BREAKDOWN.md`       | Working plan: per-phase tasks, agent assignments, exit criteria, **resolved decisions D1–D11** |

**The decisions table (§0) in the phase breakdown supersedes the overview wherever they conflict.** Most important override: card data comes from **Scryfall** (`api.scryfall.com`), not `api.magicthegathering.io` — ignore the overview's references to the latter.

## Stack

Next.js (App Router) · TypeScript strict · Tailwind + shadcn/ui · Framer Motion · Zustand · Socket.io (standalone server in `server/`) · MongoDB Atlas via Mongoose · Firebase Auth (Google, allowlist-only) · Vitest + Playwright · pnpm. Hosting: Vercel + Render free (socket server) + Atlas M0.

## Commands

```
pnpm dev           # Next.js dev server
pnpm dev:socket    # Socket.io server (server/)
pnpm lint          # ESLint + Prettier check
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest unit/integration
pnpm test:e2e      # Playwright
pnpm build         # production build
pnpm sync:set <code>  # sync one Scryfall set into the cache
```

(Created during Phase 0 — keep this list in sync as scripts land.)

## Agent roster & ownership

Orchestrator decomposes multi-domain tasks and arbitrates all conflicts; agents never negotiate with each other directly. Work order inside a phase: **db → backend → frontend**, design produces primitives first, security reviews every backend change, testing follows each agent's output.

| Agent            | Owns                                                         | Escalates when                                            |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------- |
| `orchestrator`   | phase tracking, integration, smoke checks                    | —                                                         |
| `agent-frontend` | `app/` (pages), `components/`, `hooks/`, `store/`, `styles/` | a UI change needs a new API endpoint                      |
| `agent-backend`  | `app/api/`, `server/`, `lib/firebase-admin/`, `lib/game/`    | schema changes affect frontend models                     |
| `agent-db`       | `lib/models/`, `lib/db/`, seeds & migrations                 | schema change breaks an API contract                      |
| `agent-api`      | `lib/mtg-api/` (Scryfall client, cache, sync jobs)           | Scryfall schema/endpoint changes                          |
| `agent-security` | auth middleware, allowlist, socket handshake, env hygiene    | any unauthenticated endpoint or client-trusted game state |
| `agent-testing`  | `__tests__/`, `e2e/`, test configs                           | coverage < 70% on auth, draft engine, or economy          |
| `agent-design`   | `components/ui/`, Tailwind theme, `lib/animations/`          | —                                                         |

## Hard rules

**Security (non-negotiable)**

- Draft state is **server-authoritative only**. Clients receive their own pack/hand and public info — never another player's pack, never the hidden pool. Any client-trusted game state is a bug.
- Every protected API route and the Socket.io handshake verify the Firebase ID token via Admin SDK **and re-check the allowlist** — not just at login.
- `vaultCoins` is mutated only through the wallet service (atomic guarded `$inc`, paired `Transaction` record). Prices and rewards are resolved server-side; never trust client-sent amounts.
- Admin actions require a server-side `role: 'admin'` check.
- All external input (query params, bodies, socket payloads) is Zod-validated before touching MongoDB.
- Secrets live in env vars only. Client-side code may use `NEXT_PUBLIC_*` vars exclusively; the Firebase Admin private key never leaves the server.

**Scryfall etiquette**

- Cache-first: check MongoDB (`cachedAt`, TTL 7 d sets / 30 d cards) before any external call. Warm paths make zero Scryfall requests.
- ≤ 10 requests/second with ~100 ms spacing, identifying `User-Agent`, backoff on 429.
- Boosters are simulated server-side from cached cards — never fetched per pack.

**Code conventions**

- TypeScript strict; no `any` without a justifying comment.
- Conventional commits with scope: `feat(draft): …`, `fix(shop): …`, `chore(ci): …`.
- Mobile-first Tailwind (375 px base); dark mode is the default theme.
- All Framer Motion animations live as variants in `lib/animations/` and respect `useReducedMotion`.
- Game logic in `lib/game/` stays pure (no I/O) so it's unit-testable; sockets and routes are thin adapters around it.

**Process**

- Follow `MTG_PHASE_BREAKDOWN.md` phase order; a phase starts only when the previous phase's exit criteria are met. No feature work before Phase 0 is confirmed working.
- Security review pass at the end of every phase before merge.
- Don't re-litigate decisions D1–D11; raise a proposal with rationale if one genuinely needs revisiting.

## Environment variables

| Name                                                                        | Scope                              |
| --------------------------------------------------------------------------- | ---------------------------------- |
| `MONGODB_URI`                                                               | server (both processes)            |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | client (public)                    |
| `FIREBASE_ADMIN_PROJECT_ID` / `_CLIENT_EMAIL` / `_PRIVATE_KEY`              | server only — never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SOCKET_URL`                                                    | client                             |
| `SOCKET_PORT`, `SOCKET_CORS_ORIGIN`                                         | socket server                      |

Both processes validate their env with Zod at boot and fail fast on missing vars. `.env.local.example` is the canonical list — update it with every new var.

## Testing standards

- Vitest for unit/integration; Playwright for E2E (multi-browser-context tests for multiplayer draft).
- ≥ 70% coverage on critical paths: auth/allowlist, draft engine, wallet/shop.
- The draft engine (`lib/game/draft.ts`) is pure and should approach full coverage before socket wiring.
- Concurrency tests are mandatory for wallet operations (no double-spend, no negative balance).

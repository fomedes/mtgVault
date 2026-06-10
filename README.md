# MTG Vault

Private, invite-only Magic: The Gathering draft & collection platform for a small group of friends. Non-commercial fan project — all card names, artwork, and mechanics are IP of Wizards of the Coast. Card data via [Scryfall](https://scryfall.com/docs/api).

## Stack

Next.js (App Router) · TypeScript · Tailwind + shadcn/ui · Motion · Zustand · Socket.io · MongoDB (Mongoose) · Firebase Auth (Google, allowlist-only) · Vitest + Playwright · pnpm

## Quick start

```bash
pnpm install
copy .env.local.example .env.local   # then fill it in — see SETUP.md
pnpm dev          # Next.js on :3000
pnpm dev:socket   # Socket.io server on :4000 (separate terminal)
```

First-time setup (Firebase project, MongoDB Atlas, allowlisting yourself): follow **[SETUP.md](./SETUP.md)**.

## Scripts

| Script                                                   | What it does                                  |
| -------------------------------------------------------- | --------------------------------------------- |
| `pnpm dev` / `pnpm dev:socket`                           | Dev servers (web / realtime)                  |
| `pnpm build` / `pnpm start`                              | Production build / serve                      |
| `pnpm start:socket`                                      | Run the Socket.io server (production)         |
| `pnpm lint` / `pnpm typecheck` / `pnpm format`           | Code quality                                  |
| `pnpm test` / `pnpm test:watch`                          | Vitest unit tests                             |
| `pnpm test:e2e`                                          | Playwright E2E (starts the dev server itself) |
| `pnpm seed:allowlist --email you@gmail.com --role admin` | Allow an account in                           |

## Project documentation

| File                                                             | Purpose                                          |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| [`MTGVAULT_PROJECT_OVERVIEW.md`](./MTGVAULT_PROJECT_OVERVIEW.md) | Full spec: features, data models, architecture   |
| [`MTG_PHASE_BREAKDOWN.md`](./MTG_PHASE_BREAKDOWN.md)             | Development plan, resolved decisions, task lists |
| [`CLAUDE.md`](./CLAUDE.md)                                       | Claude Code agent config and project rules       |
| [`SETUP.md`](./SETUP.md)                                         | One-time service setup (Firebase, Atlas)         |

## Publishing to GitHub

The repo is local-only right now. To publish:

1. Create a **private** repository on github.com (no README/.gitignore — the repo already has them).
2. ```bash
   git remote add origin https://github.com/<you>/mtg-vault.git
   git push -u origin main
   ```

CI (lint, typecheck, format, unit tests, build) runs automatically via GitHub Actions on every push and PR.

## Hosting plan (decision D10)

| Piece            | Where              | Cost |
| ---------------- | ------------------ | ---- |
| Next.js app      | Vercel (Hobby)     | $0   |
| Socket.io server | Render (free tier) | $0   |
| MongoDB          | Atlas M0           | $0   |

Known tradeoff: the Render free instance sleeps after 15 min idle — the first person opening a draft lobby waits ~30–60 s while it wakes. Active drafts keep it awake. If that gets annoying, the upgrade path is Railway Hobby ($5/mo flat, always warm); migration is just env vars + a start command.

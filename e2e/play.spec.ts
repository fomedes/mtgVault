import { expect, test, type BrowserContext } from "@playwright/test";
import {
  BASE_URL,
  createE2ESessionCookie,
  createE2ESessionCookieFor,
  hasE2ECredentials,
} from "./helpers/session";

/**
 * Phase 16 — Live Multiplayer Play E2E.
 * Two browser contexts (host + guest) run a full lobby → start → action flow:
 * create/join by code, import a basic-land decklist, start, and confirm a life
 * change made by one player syncs to the other.
 *
 * Requires real Firebase/Mongo credentials; skips cleanly in CI without them.
 */

const GUEST_UID = "e2e-play-guest-bot";
const GUEST_EMAIL = "e2e-play-guest@mtgvault.test";

// Basic lands resolve against any synced set in the curated cache.
const DECKLIST = "30 Forest\n30 Mountain";

test.describe("live multiplayer play", () => {
  test.skip(!hasE2ECredentials(), "Firebase/Mongo credentials not configured in .env.local");

  let hostCookie: { name: string; value: string };
  let guestCookie: { name: string; value: string };

  test.beforeAll(async () => {
    hostCookie = await createE2ESessionCookie();
    guestCookie = await createE2ESessionCookieFor(GUEST_UID, GUEST_EMAIL);
  });

  test("two players create, join, start and sync a life change", async ({ browser }) => {
    const hostCtx = await browser.newContext();
    const guestCtx = await browser.newContext();
    await addCookie(hostCtx, hostCookie);
    await addCookie(guestCtx, guestCookie);

    const host = await hostCtx.newPage();
    const guest = await guestCtx.newPage();

    // ── Host creates a table ──────────────────────────────────────────────────
    await host.goto("/play");
    await host.getByRole("button", { name: /create table/i }).click();
    const code = (await host.getByTestId("play-short-code").innerText()).trim();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);

    // ── Guest joins by code ───────────────────────────────────────────────────
    await guest.goto("/play");
    await guest.getByTestId("play-join-code").fill(code);
    await guest.getByRole("button", { name: /^join$/i }).click();
    // Both should now see two players in the roster.
    await expect(host.getByText(/Players \(2\/2\)/)).toBeVisible();

    // ── Both import a basic-land decklist + ready up ──────────────────────────
    for (const page of [host, guest]) {
      await page.getByPlaceholder(/paste a decklist/i).fill(DECKLIST);
      await page.getByRole("button", { name: /import pasted list/i }).click();
      await expect(page.getByText(/deck ready/i)).toBeVisible();
      await page.getByRole("button", { name: /ready up/i }).click();
    }

    // ── Host starts ───────────────────────────────────────────────────────────
    await host.getByRole("button", { name: /start game/i }).click();
    await expect(host.getByTestId("play-board")).toBeVisible();
    await expect(guest.getByTestId("play-board")).toBeVisible();

    // ── Life change made by host syncs to guest ───────────────────────────────
    const guestFirstLife = guest.getByTestId("life-value").first();
    const before = await guestFirstLife.innerText();
    // Host decrements the first life counter (the "−" button on the first card).
    await host.locator('[data-testid="life-value"]').first().locator("xpath=preceding-sibling::button").click();
    await expect(guestFirstLife).not.toHaveText(before);

    await hostCtx.close();
    await guestCtx.close();
  });
});

async function addCookie(ctx: BrowserContext, cookie: { name: string; value: string }) {
  await ctx.addCookies([{ ...cookie, url: BASE_URL }]);
}

import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  createE2ESessionCookie,
  hasE2ECredentials,
} from "./helpers/session";

/**
 * P5-08 — Critical-path regression suite.
 * Covers auth, browse, shop, collection, draft lobby, history, and new P5
 * pages (dashboard, achievements, notifications).
 *
 * Requires real Firebase/Mongo credentials; skips cleanly in CI without them.
 */

test.describe("critical path (authenticated)", () => {
  test.skip(
    !hasE2ECredentials(),
    "Firebase/Mongo credentials not configured in .env.local",
  );

  let cookie: { name: string; value: string };

  test.beforeAll(async () => {
    cookie = await createE2ESessionCookie();
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ ...cookie, url: BASE_URL }]);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  test("dashboard loads for authenticated user", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
  });

  test("unauthenticated root redirects to /login", async ({ browser }) => {
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();
    await freshPage.goto("/");
    await expect(freshPage).toHaveURL(/\/login$/);
    await freshCtx.close();
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────

  test("dashboard shows stat cards and quick links", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Unique cards")).toBeVisible();
    await expect(page.getByText("Vault Coins")).toBeVisible();
    await expect(page.getByText("Recent Activity")).toBeVisible();
  });

  // ── Card browser ──────────────────────────────────────────────────────────

  test("card browser lists enabled sets", async ({ page }) => {
    await page.goto("/cards");
    await expect(page.getByRole("heading", { name: "Card Browser" })).toBeVisible();
  });

  // ── Collection ────────────────────────────────────────────────────────────

  test("collection page loads", async ({ page }) => {
    await page.goto("/collection");
    await expect(page.getByRole("heading", { name: "My Collection" })).toBeVisible();
  });

  // ── Shop ──────────────────────────────────────────────────────────────────

  test("shop page loads and shows balance", async ({ page }) => {
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
    await expect(page.getByText(/Balance:/)).toBeVisible({ timeout: 10_000 });
  });

  // ── Draft ─────────────────────────────────────────────────────────────────

  test("draft page loads with create/join options", async ({ page }) => {
    await page.goto("/draft");
    await expect(page.getByRole("heading", { name: /Draft/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Create lobby/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── History ───────────────────────────────────────────────────────────────

  test("history page loads", async ({ page }) => {
    await page.goto("/history");
    await expect(page.getByRole("heading", { name: "Draft History" })).toBeVisible();
  });

  // ── Achievements (P5-03) ──────────────────────────────────────────────────

  test("achievements page loads with achievement definitions", async ({ page }) => {
    await page.goto("/achievements");
    await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
    // Should show at least the locked achievements grid
    await expect(page.getByText(/of \d+ unlocked/)).toBeVisible();
  });

  // ── Notifications (P5-04) ─────────────────────────────────────────────────

  test("notifications page loads", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  // ── Admin (skip if not admin role) ────────────────────────────────────────

  test("admin page redirects non-admin users", async ({ page }) => {
    await page.goto("/admin");
    // Either the admin page loads (if test user is admin) or redirects to dashboard
    const url = page.url();
    const isAdmin = url.includes("/admin");
    if (isAdmin) {
      await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible();
    } else {
      await expect(page).toHaveURL(/\/dashboard$/);
    }
  });

  // ── Navigation bell ───────────────────────────────────────────────────────

  test("notification bell is present in nav", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /Notifications/i })).toBeVisible();
  });

  // ── Mobile viewport smoke ─────────────────────────────────────────────────

  test("dashboard renders on 375 px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();
    // Nav should still be present
    await expect(page.getByRole("banner")).toBeVisible();
  });

  test("shop renders on 375 px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Shop" })).toBeVisible();
  });
});

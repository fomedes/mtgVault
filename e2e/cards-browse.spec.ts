import { expect, test } from "@playwright/test";
import {
  BASE_URL,
  createE2ESessionCookie,
  hasE2ECredentials,
} from "./helpers/session";

/**
 * Full authenticated browse flow (P1-12): set list → set view → filter →
 * detail modal → DFC flip. Requires real Firebase/Mongo credentials in
 * .env.local plus at least one synced set; skips itself otherwise so the
 * credential-free CI smoke run stays green.
 */

test.describe("card browser (authenticated)", () => {
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

  test("browse a set, filter by rarity, open the card modal", async ({
    page,
  }) => {
    await page.goto("/cards");
    await expect(
      page.getByRole("heading", { name: "Card Browser" }),
    ).toBeVisible();

    const setLinks = page.locator('a[href^="/cards/"]');
    const setCount = await setLinks.count();
    test.skip(setCount === 0, "No sets synced — run pnpm sync:set --all");

    await setLinks.first().click();
    await expect(page.getByLabel("Search card name")).toBeVisible();

    const tiles = page.locator("button[aria-label]").filter({
      has: page.locator("img, [role='img']"),
    });
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });

    // Rarity filter updates the URL (shareable views).
    await page.getByRole("button", { name: "Rare", exact: true }).click();
    await expect(page).toHaveURL(/rarity=rare/);
    await expect(tiles.first()).toBeVisible({ timeout: 15_000 });

    // Open the detail modal and close it again.
    await tiles.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Rulings")).toBeVisible({
      timeout: 15_000,
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("double-faced cards flip in the modal", async ({ page }) => {
    // Find any synced transform card via the API (shares the session cookie).
    const response = await page.request.get(
      `${BASE_URL}/api/cards?layout=transform&pageSize=6`,
    );
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as {
      cards: Array<{ scryfallId: string; name: string; set: string }>;
      total: number;
    };
    test.skip(body.total === 0, "No transform cards synced");

    const dfc = body.cards[0];
    const frontName = dfc.name.split(" // ")[0];
    await page.goto(`/cards/${dfc.set}?name=${encodeURIComponent(frontName)}`);

    const tile = page.locator(`button[aria-label^="${dfc.name}"]`).first();
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await tile.click();

    const flipButton = page.getByRole("button", { name: /flip card/i });
    await expect(flipButton).toBeVisible({ timeout: 15_000 });

    const flipper = page.getByTestId("dfc-flipper");
    const before = await flipper.evaluate(
      (element) => getComputedStyle(element).transform,
    );
    await flipButton.click();
    await expect
      .poll(
        () =>
          flipper.evaluate((element) => getComputedStyle(element).transform),
        { timeout: 5_000 },
      )
      .not.toBe(before);
  });
});

import { expect, test } from "@playwright/test";

// Smoke tests that run with zero Firebase/Mongo credentials: they only
// exercise routing, the auth guard, and login page rendering.

test("root redirects unauthenticated visitors to /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("login page shows the Google sign-in button", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "MTG Vault" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in with google/i }),
  ).toBeVisible();
});

test("dashboard redirects unauthenticated visitors to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

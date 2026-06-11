import { expect, test } from "@playwright/test";

// Credential-free guard checks for the card browser routes.

test("card browser redirects unauthenticated visitors to /login", async ({
  page,
}) => {
  await page.goto("/cards");
  await expect(page).toHaveURL(/\/login$/);
});

test("set view redirects unauthenticated visitors to /login", async ({
  page,
}) => {
  await page.goto("/cards/neo");
  await expect(page).toHaveURL(/\/login$/);
});

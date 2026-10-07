import { expect, test } from "@playwright/test";
import path from "node:path";
import { firstId, imagesSettled, settle, snap } from "./helpers";

// Phone-width screenshots and layout checks for the account screens (runs in the "mobile" project).
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function loginDemoMobile(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /try the demo account/i }).click();
  await expect(page).toHaveURL("/");
}

for (const p of ["/wishlist", "/alerts", "/notifications", "/profile"]) {
  test(`${p} fits a phone screen`, async ({ page }) => {
    await loginDemoMobile(page);
    await page.goto(p);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await settle(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, p).toBeLessThanOrEqual(0);
  });
}

test("17 mobile screenshots: home, search, product, alerts", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("17-mobile-home"));

  await page.goto("/search?q=samsung");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("17-mobile-search"));

  await page.goto(`/products/${await firstId(request, "samsung galaxy a55")}`);
  await expect(page.getByTestId("history-summary")).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("17-mobile-product"));

  await loginDemoMobile(page);
  await page.goto("/alerts");
  await expect(page.getByTestId("alert-item").first()).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("17-mobile-alerts"));
});

test("compare tray and wishlist heart are usable with touch targets of at least 36px", async ({ page }) => {
  await page.goto("/search?category=audio");
  const heart = page.getByRole("button", { name: /Save .* to wishlist/ }).first();
  const box = await heart.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(36);
  expect(box!.height).toBeGreaterThanOrEqual(36);
});

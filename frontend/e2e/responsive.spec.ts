import { expect, test } from "@playwright/test";
import { settle } from "./helpers";

// Runs on a phone-sized viewport (Pixel 7).
const PAGES = ["/", "/login", "/register", "/categories", "/search?q=samsung", "/search?category=mobiles", "/about", "/not-a-page"];

for (const path of PAGES) {
  test(`${path} has no horizontal scroll on mobile`, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("mobile menu opens, shows links and closes on navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Categories" }).click();
  await expect(page).toHaveURL(/\/categories/);
  await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
});

test("login works on mobile", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /try the demo account/i }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: /Log out/ })).toBeVisible();
});

test("filters open in a drawer on mobile and apply to the results", async ({ page }) => {
  await page.goto("/search?q=samsung");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Filters" })).toBeHidden(); // desktop sidebar is hidden
  await page.getByRole("button", { name: /^Filters/ }).click();
  const drawer = page.getByRole("dialog", { name: "Filters" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("checkbox", { name: /AliExpress/ }).click();
  await expect(page).toHaveURL(/platform=aliexpress/);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("button", { name: /^Filters/ })).toContainText("1");
});

test("product cards stack in one column and stay readable", async ({ page }) => {
  await page.goto("/search?category=audio");
  const first = page.getByTestId("product-card").first();
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  expect(box!.width).toBeGreaterThan(280);
});

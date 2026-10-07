import { expect, test } from "@playwright/test";
import { settle } from "./helpers";

// Runs on a phone-sized viewport (Pixel 7).
const PAGES = ["/", "/login", "/register"];

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
  await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
});

test("login works on mobile", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: /try the demo account/i }).click();
  await expect(page).toHaveURL("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: /Log out/ })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import path from "node:path";
import { firstId } from "./helpers";
import { imagesSettled, settle, snap, snapLanding } from "./helpers";

// Dark-mode screenshots for the report (18-dark-*.png). Dark is opt-in, so the saved choice is set before load.
// Run with: npx playwright test e2e/screens-dark.spec.ts --project=desktop
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, name + ".png"), fullPage: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("excomm-theme", "dark"));
});

test("the site is light by default, whatever the OS prefers", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await ctx.close();
});

test("light by default: dark OS, empty or invalid saved theme", async ({ browser }) => {
  for (const saved of [null, "system", "Dark", "garbage"]) {
    const ctx = await browser.newContext({ colorScheme: "dark" });
    const page = await ctx.newPage();
    if (saved) await page.addInitScript((v) => localStorage.setItem("excomm-theme", v), saved);
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(251, 248, 243)");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe("light");
    await ctx.close();
  }
});

test("the toggle switches to dark and the choice is remembered", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/about");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await ctx.close();
});

test("18 dark home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await settle(page);
  await snapLanding(page, OUT, "18-dark-home");
});

test("18 dark search", async ({ page }) => {
  await page.goto("/search?q=samsung");
  await expect(page.getByTestId("product-card").first()).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("18-dark-search"));
});

test("18 dark product", async ({ page, request }) => {
  const id = await firstId(request, "samsung galaxy a55");
  await page.goto("/products/" + id);
  await expect(page.getByTestId("price-chart").locator("svg.recharts-surface").first()).toBeVisible();
  await settle(page);
  await imagesSettled(page);
  await snap(page, shot("18-dark-product"));
});

import { expect, test } from "@playwright/test";
import path from "node:path";
import { imagesSettled, settle, walkPage } from "./helpers";

// Captures report screenshots into docs/screenshots (see docs/screenshots_checklist.md).
// Run with: npx playwright test e2e/screens.spec.ts --project=desktop
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, `${name}.png`), fullPage: true });

test.describe("report screenshots", () => {
  test("01 login", async ({ page }) => {
    await page.goto("/login");
    await settle(page);
    await page.screenshot(shot("01-login"));
  });

  test("02 register", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Password", { exact: true }).fill("Abcdefg1!xyz");
    await settle(page);
    await page.screenshot(shot("02-register"));
  });

  test("03 home", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await settle(page);
    await walkPage(page);
    await imagesSettled(page);
    await page.screenshot(shot("03-home"));
  });

  test("04 categories", async ({ page }) => {
    await page.goto("/categories");
    await expect(page.getByTestId("category-section")).toHaveCount(6);
    await settle(page);
    await page.screenshot(shot("04-categories"));
  });

  test("05 search results", async ({ page }) => {
    await page.goto("/search?q=samsung");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await page.screenshot(shot("05-search"));
  });

  test("06 search with filters applied", async ({ page }) => {
    await page.goto("/search?category=audio&platform=daraz,priceoye&sort=price_asc");
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await page.screenshot(shot("06-search-filters"));
  });

  test("13 about", async ({ page }) => {
    await page.goto("/about");
    await settle(page);
    await page.screenshot(shot("13-about"));
  });

  test("14 not found", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await settle(page);
    await page.screenshot(shot("14-not-found"));
  });
});

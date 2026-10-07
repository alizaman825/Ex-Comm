import { expect, test } from "@playwright/test";
import { snap } from "./helpers";
import path from "node:path";

// Loading, empty and error states (NFR-12). Screenshots go to docs/screenshots for the report.
const OUT = path.resolve(__dirname, "../../docs/screenshots");

test.describe("search page states", () => {
  test("loading: skeletons and a progress message while the search is running", async ({ page }) => {
    await page.route("**/api/search?**", async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto("/search?q=samsung");
    await expect(page.getByRole("status", { name: "Loading products" })).toBeVisible();
    await expect(page.getByTestId("product-skeleton")).toHaveCount(12);
    await expect(page.getByText("Checking Daraz and PriceOye for the latest prices")).toBeVisible();
    await snap(page, { path: path.join(OUT, "state-search-loading.png"), fullPage: true });
    await expect(page.getByTestId("product-card").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("product-skeleton")).toHaveCount(0);
  });

  test("error: failed search shows a retry that recovers", async ({ page }) => {
    let fail = true;
    await page.route("**/api/search?**", (route) =>
      fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "Internal server error" } }) }) : route.continue()
    );
    await page.goto("/search?q=samsung");
    const error = page.locator('[data-state="error"]');
    await expect(error).toContainText("We could not load results");
    await snap(page, { path: path.join(OUT, "state-search-error.png"), fullPage: true });
    fail = false;
    await error.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
    await expect(page.locator('[data-state="error"]')).toHaveCount(0);
  });

  test("error: backend unreachable (network failure) is reported", async ({ page }) => {
    await page.route("**/api/search?**", (route) => route.abort("failed"));
    await page.goto("/search?q=samsung");
    await expect(page.locator('[data-state="error"]')).toBeVisible();
  });

  test("empty: nothing matches", async ({ page }) => {
    await page.goto("/search?q=zzqqxx");
    await expect(page.locator('[data-state="empty"]')).toContainText("No products found");
    await snap(page, { path: path.join(OUT, "state-search-empty.png"), fullPage: true });
  });

  test("empty: filters exclude everything, with a way back", async ({ page }) => {
    await page.goto("/search?q=samsung&minPrice=900000");
    await expect(page.locator('[data-state="empty"]')).toContainText("products match these filters");
    await page.locator('[data-state="empty"]').getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });
});

test.describe("home page states", () => {
  test("one failing section does not break the others", async ({ page }) => {
    await page.route("**/api/products/drops**", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "boom" } }) }));
    await page.goto("/");
    await expect(page.locator('[data-state="error"]').first()).toContainText("Could not load products");
    await expect(page.getByRole("heading", { name: "Trending now" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible(); // trending rail still renders
    await expect(page.getByTestId("category-card")).toHaveCount(6);
  });

  test("loading skeletons appear while rails load", async ({ page }) => {
    await page.route("**/api/products/trending**", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto("/");
    await expect(page.getByRole("status", { name: "Loading Trending now" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Loading Trending now" })).toHaveCount(0, { timeout: 10_000 });
  });

  test("empty rail shows a friendly message", async ({ page }) => {
    await page.route("**/api/products/drops**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ products: [] }) }));
    await page.goto("/");
    await expect(page.locator('[data-state="empty"]').first()).toContainText("Nothing here yet");
  });

  test("categories page: error with retry", async ({ page }) => {
    let fail = true;
    await page.route("**/api/categories", (route) => (fail ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "down" } }) }) : route.continue()));
    await page.goto("/categories");
    await expect(page.locator('[data-state="error"]')).toContainText("Could not load categories");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("category-section")).toHaveCount(6);
  });
});

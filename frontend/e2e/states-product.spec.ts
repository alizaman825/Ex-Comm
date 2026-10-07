import { expect, test, type APIRequestContext } from "@playwright/test";
import path from "node:path";

// Loading, empty and error states for the product and compare pages (NFR-12).
const OUT = path.resolve(__dirname, "../../docs/screenshots");

async function firstId(request: APIRequestContext, query: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(query)}&live=false`);
  return ((await res.json()) as { results: { id: string }[] }).results[0].id;
}

const serverError = { status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "x" } }) };

test.describe("product page states", () => {
  test("loading skeleton while the product loads", async ({ page, request }) => {
    const id = await firstId(request, "galaxy a55");
    await page.route(`**/api/products/${id}`, async (route) => {
      await new Promise((r) => setTimeout(r, 1800));
      await route.continue();
    });
    await page.goto(`/products/${id}`);
    await expect(page.getByRole("status", { name: "Loading product" })).toBeVisible();
    await page.screenshot({ path: path.join(OUT, "state-product-loading.png"), fullPage: true });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Galaxy A55", { timeout: 10_000 });
  });

  test("error with retry when the product request fails", async ({ page, request }) => {
    const id = await firstId(request, "galaxy a55");
    let fail = true;
    await page.route(`**/api/products/${id}`, (route) => (fail ? route.fulfill(serverError) : route.continue()));
    await page.goto(`/products/${id}`);
    await expect(page.locator('[data-state="error"]')).toContainText("We could not load this product");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Galaxy A55");
  });

  test("chart: loading skeleton, empty history, then error with retry", async ({ page, request }) => {
    const id = await firstId(request, "galaxy a55");
    await page.route(`**/api/products/${id}/history**`, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ productId: id, days: 30, series: [], overall: [], summary: null }) });
    });
    await page.goto(`/products/${id}`);
    await expect(page.getByRole("status", { name: "Loading price history" })).toBeVisible();
    await expect(page.getByTestId("price-chart").locator('[data-state="empty"]')).toContainText("No price history yet");
    await page.screenshot({ path: path.join(OUT, "state-chart-empty.png"), fullPage: true });

    await page.unroute(`**/api/products/${id}/history**`);
    let fail = true;
    await page.route(`**/api/products/${id}/history**`, (route) => (fail ? route.fulfill(serverError) : route.continue()));
    await page.getByRole("button", { name: "90 days" }).click();
    await expect(page.getByTestId("price-chart").locator('[data-state="error"]')).toContainText("Could not load price history");
    fail = false;
    await page.getByTestId("price-chart").getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("history-summary")).toBeVisible();
  });

  test("similar products section hides itself when it fails", async ({ page, request }) => {
    const id = await firstId(request, "galaxy a55");
    await page.route(`**/api/products/${id}/similar`, (route) => route.fulfill(serverError));
    await page.goto(`/products/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Galaxy A55");
    await expect(page.getByRole("heading", { name: "Compare with similar products" })).toHaveCount(0);
  });
});

test.describe("compare page states", () => {
  test("loading skeleton, then error with retry", async ({ page, request }) => {
    const a = await firstId(request, "iphone 15 128gb");
    const b = await firstId(request, "galaxy a55");
    let fail = true;
    await page.route("**/api/compare?**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      if (fail) return route.fulfill(serverError);
      return route.continue();
    });
    await page.goto(`/compare?ids=${a},${b}`);
    await expect(page.getByRole("status", { name: "Loading comparison" })).toBeVisible();
    await expect(page.locator('[data-state="error"]')).toContainText("We could not load the comparison");
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByTestId("compare-table")).toBeVisible();
  });
});

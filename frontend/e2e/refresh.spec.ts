import { expect, test } from "@playwright/test";

// The e2e backend runs in DEMO_MODE (no scraping). To exercise the live/cached banner and the refresh
// button, the search responses are replaced through route interception.
const card = (title: string, price: number) => ({
  id: "a".repeat(24), title, brand: null, category: "mobiles", image: null, minPrice: price, maxPrice: price, rating: null, reviewCount: 0, priceChange7d: 0, platforms: ["daraz"],
  offers: [{ listingId: "l1", platform: "daraz", role: "retail", price, priceUsd: null, originalPrice: null, rating: null, reviewCount: 0, inStock: true, url: "https://www.daraz.pk/x", dataSource: "live", lastScrapedAt: new Date().toISOString() }],
});
const body = (source: "live" | "cache", checkedMinutesAgo: number, price: number) => ({
  query: "iphone 15 pro max cover", source, demoMode: false, fetchedAt: new Date(Date.now() - checkedMinutesAgo * 60_000).toISOString(),
  platformStatus: { daraz: { status: "success", relevant: 1, scraped: 40 }, priceoye: { status: "success", relevant: 0, scraped: 24 } },
  total: 1, page: 1, pages: 1, pageSize: 12, results: [card("15 Pro Max Clear Case", price)],
});
const json = (data: unknown) => ({ status: 200, contentType: "application/json", body: JSON.stringify(data) });

test.describe("refresh results from the stores", () => {
  test("an earlier live result says so, and Refresh asks the stores again", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/api/search?**", (route) => {
      const url = route.request().url();
      if (!url.includes("q=iphone")) return route.continue();
      requests.push(url);
      return route.fulfill(json(url.includes("refresh=true") ? body("live", 0, 450) : body("cache", 27, 499)));
    });

    await page.goto("/search?q=iphone 15 pro max cover");
    const banner = page.getByTestId("source-banner");
    await expect(banner).toHaveAttribute("data-source", "cache");
    await expect(banner).toContainText("Live results from the stores, checked 27 minutes ago");
    await expect(page.getByTestId("product-card").first()).toContainText("Rs 499");

    await page.getByTestId("refresh-results").click();
    await expect(banner).toHaveAttribute("data-source", "live");
    await expect(banner).toContainText("checked just now");
    await expect(page.getByTestId("product-card").first()).toContainText("Rs 450"); // the new price
    await expect(page.getByText("Checked the stores: results are up to date")).toBeVisible();

    expect(requests.filter((u) => u.includes("refresh=true"))).toHaveLength(1);
    expect(requests[0]).not.toContain("refresh=true"); // normal searches never force a refresh
  });

  test("while the stores are being checked the button shows progress and cannot be double-clicked", async ({ page }) => {
    await page.route("**/api/search?**", async (route) => {
      const url = route.request().url();
      if (!url.includes("q=iphone")) return route.continue();
      if (url.includes("refresh=true")) await new Promise((r) => setTimeout(r, 1200));
      return route.fulfill(json(url.includes("refresh=true") ? body("live", 0, 450) : body("cache", 27, 499)));
    });
    await page.goto("/search?q=iphone 15 pro max cover");
    await page.getByTestId("refresh-results").click();
    await expect(page.getByRole("button", { name: "Checking the stores…" })).toBeDisabled();
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "live");
  });

  test("a failing refresh keeps the previous results and reports the error", async ({ page }) => {
    await page.route("**/api/search?**", (route) => {
      const url = route.request().url();
      if (!url.includes("q=iphone")) return route.continue();
      if (url.includes("refresh=true")) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "x" } }) });
      return route.fulfill(json(body("cache", 27, 499)));
    });
    await page.goto("/search?q=iphone 15 pro max cover");
    await page.getByTestId("refresh-results").click();
    await expect(page.getByRole("alert").filter({ hasText: "x" })).toBeVisible();
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "cache");
    await expect(page.getByTestId("product-card").first()).toContainText("Rs 499");
    await expect(page.getByTestId("refresh-results")).toBeEnabled();
  });

  test("when the stores cannot be reached the page says why, for each store, and Refresh keeps trying", async ({ page }) => {
    const failed = {
      query: "iphone 15 pro max", source: "fallback", demoMode: false, fetchedAt: null, total: 0, page: 1, pages: 1, pageSize: 12, results: [],
      platformStatus: { daraz: { status: "failed", code: "TIMEOUT", error: "Timed out after 8000 ms" }, priceoye: { status: "skipped", code: "CIRCUIT_OPEN", error: "priceoye is paused" } },
    };
    let refreshCalls = 0;
    await page.route("**/api/search?**", (route) => {
      const url = route.request().url();
      if (!url.includes("q=iphone")) return route.continue();
      if (url.includes("refresh=true")) refreshCalls += 1;
      return route.fulfill(json(failed));
    });
    await page.goto("/search?q=iphone 15 pro max");
    const problems = page.getByTestId("store-problems");
    await expect(problems).toContainText("Daraz took too long to answer");
    await expect(problems).toContainText("PriceOye is paused for a few minutes");

    await page.getByRole("button", { name: "Try the stores again" }).click();
    const toast = page.getByRole("alert").filter({ hasText: "Could not check the stores" });
    await expect(toast).toContainText("Daraz took too long to answer");
    await expect(toast).toContainText("PriceOye is paused");
    expect(refreshCalls).toBe(1);
    await expect(page.getByTestId("refresh-results")).toBeEnabled(); // can be tried again
  });

  test("a store that answered but has no match is not reported as a problem", async ({ page }) => {
    await page.route("**/api/search?**", (route) => {
      if (!route.request().url().includes("q=iphone")) return route.continue();
      return route.fulfill(json({ ...body("live", 0, 450), platformStatus: { daraz: { status: "success", relevant: 1 }, priceoye: { status: "success", relevant: 0 } } }));
    });
    await page.goto("/search?q=iphone 15 pro max cover");
    await expect(page.getByTestId("source-banner")).toHaveAttribute("data-source", "live");
    await expect(page.getByTestId("store-problems")).toHaveCount(0);
  });

  test("demo mode explains itself and offers no refresh", async ({ page }) => {
    await page.goto("/search?q=samsung");
    const banner = page.getByTestId("source-banner");
    await expect(banner).toContainText("Demo mode: live store search is switched off");
    await expect(page.getByTestId("refresh-results")).toHaveCount(0);
  });
});

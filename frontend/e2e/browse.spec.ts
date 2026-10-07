import { expect, test, type Page } from "@playwright/test";

const email = () => `shopper${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
const cards = (page: Page) => page.getByTestId("product-card");
const prices = async (page: Page) => (await page.locator("[data-testid=product-card] .t-price").allTextContents()).map((t) => Number(t.replace(/[^0-9]/g, "")));

async function registerShopper(page: Page) {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Sana Malik");
  await page.getByLabel("Email").fill(email());
  await page.getByLabel("Password", { exact: true }).fill("password1");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("home and categories", () => {
  test("home shows hero search, popular searches, categories and product rails", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Find the best price");
    await expect(page.getByLabel("Popular searches").getByRole("link").first()).toBeVisible();
    await expect(page.getByTestId("category-card")).toHaveCount(6);
    await expect(page.getByRole("heading", { name: "Biggest price drops this week" })).toBeVisible();
    await expect(cards(page).first()).toBeVisible();
    expect(await cards(page).count()).toBe(8); // 4 drops + 4 trending
  });

  test("hero search goes to the results page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search products" }).last().fill("airpods");
    await page.getByRole("button", { name: "Compare prices" }).click();
    await expect(page).toHaveURL(/\/search\?q=airpods/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("airpods");
    await expect(cards(page).first()).toBeVisible();
  });

  test("search bar rejects a 1-character query", async ({ page }) => {
    await page.goto("/");
    const box = page.getByRole("searchbox", { name: "Search products" }).first();
    await box.fill("a");
    await box.press("Enter");
    await expect(page.getByText("Type at least 2 characters to search.")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("categories page lists six categories with preset searches that open filtered results", async ({ page }) => {
    await page.goto("/categories");
    await expect(page.getByTestId("category-section")).toHaveCount(6);
    const audio = page.getByTestId("category-section").filter({ hasText: "Audio" });
    await audio.getByRole("link", { name: "airpods pro" }).click();
    await expect(page).toHaveURL(/q=airpods%20pro&category=audio|q=airpods\+pro&category=audio/);
    await expect(cards(page).first()).toContainText(/AirPods Pro/i);
  });

  test("clicking a category card browses that category", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("category-card").filter({ hasText: "Watches" }).click();
    await expect(page).toHaveURL(/category=watches/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Watches");
    await expect(page.getByTestId("result-count")).toContainText("15 products");
  });
});

test.describe("search results", () => {
  test("shows results with the data-source banner, counts and per-store prices", async ({ page }) => {
    await page.goto("/search?q=samsung");
    await expect(cards(page).first()).toBeVisible();
    const banner = page.getByTestId("source-banner");
    await expect(banner).toHaveAttribute("data-source", "fallback"); // demo mode: saved sample data
    await expect(banner).toContainText("saved sample data");
    await expect(page.getByTestId("result-count")).toContainText("products");
    await expect(cards(page).first().getByRole("list", { name: "Prices by store" })).toBeVisible();
  });

  test("pagination: 15 products in a category span two pages", async ({ page }) => {
    await page.goto("/search?category=mobiles");
    await expect(cards(page)).toHaveCount(12);
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(cards(page)).toHaveCount(3);
    await page.reload();
    await expect(cards(page)).toHaveCount(3); // state lives in the URL
    await page.goBack();
    await expect(cards(page)).toHaveCount(12);
  });

  test("platform filter, price filter validation, sort and clear all", async ({ page }) => {
    await page.goto("/search?q=samsung");
    await expect(cards(page).first()).toBeVisible();
    const total = await cards(page).count();

    await page.getByRole("checkbox", { name: /PriceOye/ }).click();
    await expect(page).toHaveURL(/platform=priceoye/);
    await expect(cards(page).first()).toBeVisible();
    for (const text of await cards(page).allTextContents()) expect(text).toContain("PriceOye");

    // inverted price range is rejected and does not change the URL
    await page.getByLabel("Minimum price (Rs)").fill("90000");
    await page.getByLabel("Maximum price (Rs)").fill("1000");
    await expect(page.getByText("Minimum price cannot be higher than the maximum")).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply price range" })).toBeDisabled();

    await page.getByLabel("Minimum price (Rs)").fill("1000");
    await page.getByLabel("Maximum price (Rs)").fill("30000");
    await page.getByRole("button", { name: "Apply price range" }).click();
    await expect(page).toHaveURL(/minPrice=1000&maxPrice=30000/);
    for (const p of await prices(page)) {
      expect(p).toBeGreaterThanOrEqual(1000);
      expect(p).toBeLessThanOrEqual(30000);
    }

    await page.getByLabel("Sort by").selectOption("price_desc");
    await expect(page).toHaveURL(/sort=price_desc/);
    const sorted = await prices(page);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));

    await page.getByRole("button", { name: "Clear all" }).first().click();
    await expect(page).not.toHaveURL(/platform=|minPrice=/);
    await expect(cards(page)).toHaveCount(total > 12 ? 12 : total);
  });

  test("no results shows an empty state with popular searches", async ({ page }) => {
    await page.goto("/search?q=zzqqxx");
    await expect(page.getByText("No products found for “zzqqxx”")).toBeVisible();
    await expect(page.getByText("Popular searches")).toBeVisible();
    await page.getByRole("link", { name: "iphone 16", exact: true }).click();
    await expect(page).toHaveURL(/q=iphone%2016|q=iphone\+16/);
    await expect(cards(page).first()).toBeVisible();
  });

  test("odd URLs do not break the page", async ({ page }) => {
    await page.goto("/search?q=samsung&sort=bogus&page=-3&minPrice=abc&platform=amazon");
    await expect(cards(page).first()).toBeVisible();
    await page.goto("/search?q=a");
    await expect(page.getByText("Search for at least 2 characters")).toBeVisible();
    await page.goto("/search");
    await expect(page.getByText("What are you looking for?")).toBeVisible();
  });
});

test.describe("compare tray and wishlist on cards", () => {
  test("select up to 4 products, tray persists across pages, 5th is refused", async ({ page }) => {
    await page.goto("/search?category=mobiles");
    const addButtons = page.getByRole("button", { name: "Add to compare" });
    await addButtons.nth(0).click();
    await addButtons.nth(0).click(); // list shifts as buttons turn into "Added"
    const tray = page.getByTestId("compare-tray");
    await expect(tray).toContainText("2 of 4 selected");
    await expect(tray.getByRole("link", { name: /Compare 2/ })).toHaveAttribute("href", /\/compare\?ids=[a-f0-9]{24},[a-f0-9]{24}/);

    await page.goto("/categories");
    await expect(page.getByTestId("compare-tray")).toContainText("2 of 4 selected");

    await page.goto("/search?category=mobiles");
    await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
    await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
    await expect(page.getByTestId("compare-tray")).toContainText("4 of 4 selected");
    await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
    await expect(page.getByText("You can compare up to 4 products")).toBeVisible();
    await expect(page.getByTestId("compare-tray")).toContainText("4 of 4 selected");

    await page.getByRole("button", { name: "Clear comparison selection" }).click();
    await expect(page.getByTestId("compare-tray")).toHaveCount(0);
  });

  test("saving requires login, then works and can be undone", async ({ page }) => {
    await page.goto("/search?q=iphone%2016");
    await page.getByRole("button", { name: /Save .* to wishlist/ }).first().click();
    await expect(page).toHaveURL(/\/login\?next=%2Fsearch/);

    // sign in and come back to the same results
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("Sana Malik");
    await page.getByLabel("Email").fill(email());
    await page.getByLabel("Password", { exact: true }).fill("password1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/search\?q=iphone/);

    const heart = page.getByRole("button", { name: /Save .* to wishlist/ }).first();
    await heart.click();
    await expect(page.getByText(/Saved ".*" to your wishlist/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove .* from wishlist/ }).first()).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Remove .* from wishlist/ }).first().click();
    await expect(page.getByText(/Removed ".*" from your wishlist/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove .* from wishlist/ })).toHaveCount(0);
  });
});

test.describe("static pages", () => {
  test("about explains live vs saved data", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "Where the prices come from" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Saved data" })).toBeVisible();
    await page.goto("/about#how-it-works");
    await expect(page.getByRole("heading", { name: "How it works" })).toBeInViewport();
  });

  test("unknown URLs show the 404 page with search and links", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to the home page" })).toBeVisible();
    await expect(page.getByRole("searchbox").last()).toBeVisible();
  });

  test("logged-in navbar shows wishlist and notification links", async ({ page }) => {
    await registerShopper(page);
    await expect(page.getByRole("link", { name: "Wishlist" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Notifications/ }).first()).toBeVisible();
  });
});

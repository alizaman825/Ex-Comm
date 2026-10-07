import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const email = () => `buyer${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;

async function productId(request: APIRequestContext, query: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(query)}&live=false`);
  const body = await res.json();
  return body.results[0].id as string;
}

/** Click the demo button and wait for the redirect, so later navigation cannot cancel the login. */
async function loginDemo(page: Page, landing: string | RegExp = "/") {
  await page.getByRole("button", { name: /try the demo account/i }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("product page", () => {
  test("shows the product, lowest price, store comparison and chart", async ({ page, request }) => {
    const id = await productId(request, "samsung galaxy a55");
    await page.goto(`/products/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Galaxy A55");
    await expect(page.getByTestId("lowest-price")).toContainText("Rs");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Mobiles");

    const rows = page.getByTestId("offer-row");
    await expect(rows).toHaveCount(3);
    await expect(page.getByTestId("offer-table").getByText("Lowest", { exact: true })).toHaveCount(1);
    await expect(rows.filter({ hasText: "Supplier" })).toHaveCount(1);
    await expect(rows.first().getByText("Saved")).toBeVisible(); // demo mode: saved data

    const chart = page.getByTestId("price-chart");
    await expect(chart.getByTestId("history-summary")).toContainText("Lowest in period");
    await expect(chart.locator("svg.recharts-surface").first()).toBeVisible();
    await expect(chart).toContainText("sample data");
  });

  test("chart range and legend controls work", async ({ page, request }) => {
    const id = await productId(request, "iphone 15 128gb");
    await page.goto(`/products/${id}`);
    const chart = page.getByTestId("price-chart");
    await expect(chart.getByTestId("history-summary")).toContainText("Change, 30 days");

    await chart.getByRole("button", { name: "7 days" }).click();
    await expect(chart.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
    await expect(chart.getByTestId("history-summary")).toContainText("Change, 7 days");

    await chart.getByRole("button", { name: "90 days" }).click();
    await expect(chart.getByTestId("history-summary")).toContainText("Change, 90 days");

    const legend = chart.getByRole("list", { name: "Chart legend" });
    await expect(legend.getByRole("button")).toHaveCount(3);
    await legend.getByRole("button", { name: /Daraz/ }).click();
    await expect(legend.getByRole("button", { name: /Daraz/ })).toHaveAttribute("aria-pressed", "false");
    await expect(chart.locator(".recharts-line")).toHaveCount(2); // hidden series is removed from the chart
  });

  test("clicking a result card opens its product page", async ({ page }) => {
    await page.goto("/search?q=airpods pro");
    await page.getByTestId("product-card").first().getByRole("link").first().click();
    await expect(page).toHaveURL(/\/products\/[a-f0-9]{24}/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/AirPods/i);
  });

  test("shows similar products to compare manually", async ({ page, request }) => {
    const id = await productId(request, "galaxy a55");
    await page.goto(`/products/${id}`);
    await expect(page.getByRole("heading", { name: "Compare with similar products" })).toBeVisible();
    await expect(page.getByTestId("product-card").first()).toBeVisible();
  });

  test("unknown and malformed ids show a friendly not-found state", async ({ page }) => {
    await page.goto(`/products/${"a".repeat(24)}`);
    await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
    await page.goto("/products/not-an-id");
    await expect(page.getByRole("heading", { name: "Product not found" })).toBeVisible();
  });

  test("store links open in a new tab with safe rel attributes", async ({ page, request }) => {
    const id = await productId(request, "airpods pro");
    await page.goto(`/products/${id}`);
    const link = page.getByTestId("offer-row").first().getByRole("link");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

test.describe("wishlist and price alerts on the product page", () => {
  test("wishlist button needs login, then saves and removes", async ({ page, request }) => {
    const id = await productId(request, "sony wh-1000xm5");
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fproducts%2F${id}`));
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("Hira Noor");
    await page.getByLabel("Email").fill(email());
    await page.getByLabel("Password", { exact: true }).fill("password1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${id}`));

    await page.getByRole("button", { name: "Save to wishlist" }).click();
    await expect(page.getByRole("button", { name: "Saved to wishlist" })).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.getByRole("button", { name: "Saved to wishlist" })).toBeVisible();
    await page.getByRole("button", { name: "Saved to wishlist" }).click();
    await expect(page.getByRole("button", { name: "Save to wishlist" })).toBeVisible();
  });

  test("price alert: login required, validation, create, update, already-reached", async ({ page, request }) => {
    const id = await productId(request, "jbl flip 6");
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fproducts%2F${id}`));
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Full name").fill("Alert Tester");
    await page.getByLabel("Email").fill(email());
    await page.getByLabel("Password", { exact: true }).fill("password1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${id}`));

    await page.getByRole("button", { name: "Set price alert" }).click();
    const dialog = page.getByRole("dialog", { name: "Set a price alert" });
    await expect(dialog).toBeVisible();
    const input = dialog.getByLabel("Notify me when the price is");
    await expect(input).not.toHaveValue(""); // suggested 10% below the current price

    await input.fill("");
    await dialog.getByRole("button", { name: "Create alert" }).click();
    await expect(dialog.getByText("Enter the price you want to pay")).toBeVisible();
    await input.fill("-20");
    await dialog.getByRole("button", { name: "Create alert" }).click();
    await expect(dialog.getByText("Target price must be greater than 0")).toBeVisible();
    await input.fill("12abc");
    await dialog.getByRole("button", { name: "Create alert" }).click();
    await expect(dialog.getByText("Enter a number")).toBeVisible();

    await input.fill("5000");
    await dialog.getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByTestId("alert-success")).toContainText("We will notify you");
    await expect(page.getByText("Price alert created")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // same product again: updates instead of duplicating
    await page.getByRole("button", { name: "Set price alert" }).click();
    await page.getByLabel("Notify me when the price is").fill("4000");
    await page.getByRole("dialog").getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByText("Price alert updated")).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();

    // a target above today's price fires immediately
    await page.getByRole("button", { name: "Set price alert" }).click();
    await page.getByLabel("Notify me when the price is").fill("9999999");
    await expect(page.getByText("already been reached")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByTestId("alert-success")).toContainText("already at or below your target");
    await page.getByRole("link", { name: "View my alerts" }).click();
    await expect(page).toHaveURL(/\/alerts/);
  });

  test("the alert dialog closes with Escape and Cancel without saving", async ({ page, request }) => {
    const id = await productId(request, "jbl flip 6");
    await page.goto("/login");
    await loginDemo(page);
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("typing a long target price keeps focus in the field", async ({ page, request }) => {
    const id = await productId(request, "jbl flip 6");
    await page.goto("/login");
    await loginDemo(page);
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    const input = page.getByLabel("Notify me when the price is");
    await input.fill("");
    await input.pressSequentially("123456", { delay: 30 });
    await expect(input).toHaveValue("123456");
  });
});

test.describe("compare view", () => {
  test("one product: stores as columns with the lowest price highlighted", async ({ page, request }) => {
    const id = await productId(request, "samsung galaxy a55");
    await page.goto(`/compare?ids=${id}`);
    const table = page.getByTestId("compare-table");
    await expect(table).toHaveAttribute("data-mode", "platforms");
    await expect(table.getByRole("columnheader")).toHaveCount(4); // empty corner + 3 stores
    await expect(table.getByText("Lowest price")).toHaveCount(1);
    await expect(table.getByRole("rowheader", { name: "Price", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Add a similar product" })).toBeVisible();
  });

  test("several products side by side with a summary, and removal updates the URL", async ({ page, request }) => {
    const a = await productId(request, "iphone 15 128gb");
    const b = await productId(request, "samsung galaxy a55");
    const c = await productId(request, "redmi note 14");
    await page.goto(`/compare?ids=${a},${b},${c}`);
    const table = page.getByTestId("compare-table");
    await expect(table).toHaveAttribute("data-mode", "products");
    await expect(page.getByTestId("compare-summary")).toContainText("Best price");
    await expect(table.getByText("Best price", { exact: true })).toHaveCount(1);
    await expect(table.getByRole("rowheader", { name: /Daraz/ })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: /AliExpress/ })).toContainText("supplier, saved");

    await table.getByRole("button", { name: /Remove .*Redmi Note 14/ }).click();
    await expect(page).toHaveURL(new RegExp(`ids=${a},${b}$`));
    await expect(table.getByRole("columnheader")).toHaveCount(3);
  });

  test("adding a suggested product switches to side-by-side mode", async ({ page, request }) => {
    const id = await productId(request, "samsung galaxy a55");
    await page.goto(`/compare?ids=${id}`);
    await page.getByRole("button", { name: /^Add .* to comparison/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`ids=${id},[a-f0-9]{24}`));
    await expect(page.getByTestId("compare-table")).toHaveAttribute("data-mode", "products");
  });

  test("the compare tray sends selected products here", async ({ page }) => {
    await page.goto("/search?category=audio");
    await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
    await page.getByRole("button", { name: "Add to compare" }).nth(0).click();
    await page.getByTestId("compare-tray").getByRole("link", { name: /Compare 2/ }).click();
    await expect(page).toHaveURL(/\/compare\?ids=/);
    await expect(page.getByTestId("compare-table")).toHaveAttribute("data-mode", "products");
    await page.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(page.getByText("Nothing to compare yet")).toBeVisible();
  });

  test("empty, invalid and oversized selections are handled", async ({ page, request }) => {
    await page.goto("/compare");
    await expect(page.getByText("Nothing to compare yet")).toBeVisible();

    await page.goto("/compare?ids=bogus,123");
    await expect(page.getByText("Those comparison links are not valid")).toBeVisible();

    await page.goto(`/compare?ids=${"a".repeat(24)}`);
    await expect(page.getByText("Some of these products no longer exist")).toBeVisible();

    const ids: string[] = [];
    for (const q of ["iphone 16", "iphone 15 128gb", "galaxy a55", "redmi note 14", "pixel 9"]) ids.push(await productId(request, q));
    await page.goto(`/compare?ids=${ids.join(",")}`);
    await expect(page.getByTestId("compare-table").getByRole("columnheader")).toHaveCount(5); // corner + capped at 4 products
  });
});

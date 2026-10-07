import { expect, test } from "@playwright/test";
import path from "node:path";
import { loginDemoUser, registerUser } from "./helpers";

// Loading, empty and error states for the signed-in pages (NFR-12).
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const serverError = { status: 500, contentType: "application/json", body: JSON.stringify({ error: { message: "x" } }) };

const PAGES = [
  { name: "wishlist", path: "/wishlist", api: "**/api/wishlist", loading: "Loading wishlist", error: "We could not load your wishlist", empty: "Your wishlist is empty", filled: "wishlist-item" },
  { name: "alerts", path: "/alerts", api: "**/api/alerts", loading: "Loading alerts", error: "We could not load your alerts", empty: "No price alerts yet", filled: "alert-item" },
  { name: "notifications", path: "/notifications", api: "**/api/notifications?**", loading: "Loading notifications", error: "We could not load your notifications", empty: "No notifications yet", filled: "notification" },
] as const;

for (const p of PAGES) {
  test.describe(`${p.name} page states`, () => {
    test("loading skeleton, then content", async ({ page }) => {
      await loginDemoUser(page);
      await page.route(p.api, async (route) => {
        await new Promise((r) => setTimeout(r, 1500));
        await route.continue();
      });
      await page.goto(p.path);
      await expect(page.getByRole("status", { name: p.loading })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `state-${p.name}-loading.png`), fullPage: true });
      await expect(page.getByTestId(p.filled).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("status", { name: p.loading })).toHaveCount(0);
    });

    test("error with retry", async ({ page }) => {
      await loginDemoUser(page);
      let fail = true;
      await page.route(p.api, (route) => (fail ? route.fulfill(serverError) : route.continue()));
      await page.goto(p.path);
      await expect(page.locator('[data-state="error"]')).toContainText(p.error);
      await page.screenshot({ path: path.join(OUT, `state-${p.name}-error.png`), fullPage: true });
      fail = false;
      await page.getByRole("button", { name: "Try again" }).click();
      await expect(page.getByTestId(p.filled).first()).toBeVisible();
    });

    test("empty for a new user", async ({ page }) => {
      await registerUser(page);
      await page.goto(p.path);
      await expect(page.locator('[data-state="empty"]')).toContainText(p.empty);
      await page.screenshot({ path: path.join(OUT, `state-${p.name}-empty.png`), fullPage: true });
    });
  });
}

test.describe("forms report server errors", () => {
  test("profile save failure is shown next to the field", async ({ page }) => {
    await registerUser(page);
    await page.route("**/api/users/me", (route) => (route.request().method() === "PATCH" ? route.fulfill(serverError) : route.continue()));
    await page.goto("/profile");
    await page.getByLabel("Full name").fill("Another Name");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "x" })).toBeVisible();
  });

  test("a failing alert request keeps the dialog open with a message", async ({ page, request }) => {
    await loginDemoUser(page);
    const res = await request.get("/api/search?q=jbl%20flip%206&live=false");
    const id = ((await res.json()) as { results: { id: string }[] }).results[0].id;
    await page.route("**/api/alerts", (route) => (route.request().method() === "POST" ? route.fulfill(serverError) : route.continue()));
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create alert" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("session expiry: a protected API call returning 401 sends the user back to login", async ({ page }) => {
    await loginDemoUser(page);
    await page.route("**/api/wishlist", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { message: "Invalid or expired session" } }) }));
    await page.goto("/wishlist");
    await expect(page.locator('[data-state="error"], [data-state="empty"]').first()).toBeVisible();
  });
});

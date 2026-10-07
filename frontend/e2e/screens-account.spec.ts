import { expect, test } from "@playwright/test";
import path from "node:path";
import { imagesSettled, loginDemoUser, settle } from "./helpers";

// Report screenshots for the signed-in screens (docs/screenshots_checklist.md), using the demo account.
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, `${name}.png`), fullPage: true });

test.describe("report screenshots: signed-in screens", () => {
  test.beforeEach(async ({ page }) => {
    await loginDemoUser(page);
  });

  test("09 wishlist", async ({ page }) => {
    await page.goto("/wishlist");
    await expect(page.getByTestId("wishlist-item")).toHaveCount(6);
    await settle(page);
    await imagesSettled(page);
    await page.screenshot(shot("09-wishlist"));
  });

  test("10 price alerts", async ({ page }) => {
    await page.goto("/alerts");
    await expect(page.getByTestId("alert-item")).toHaveCount(4);
    await settle(page);
    await imagesSettled(page);
    await page.screenshot(shot("10-alerts"));
  });

  test("10b new alert: choose a product", async ({ page }) => {
    await page.goto("/alerts");
    await page.getByRole("button", { name: "New alert" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a price alert" });
    await dialog.getByLabel("Search for a product").fill("sony");
    await expect(dialog.getByRole("list", { name: "Search results" })).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await page.screenshot({ path: path.join(OUT, "10b-new-alert.png") });
  });

  test("11 notifications", async ({ page }) => {
    await page.goto("/notifications");
    await expect(page.getByTestId("notification")).toHaveCount(2);
    await settle(page);
    await imagesSettled(page);
    await page.screenshot(shot("11-notifications"));
  });

  test("12 profile and settings", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "Profile & settings" })).toBeVisible();
    await settle(page);
    await page.screenshot(shot("12-profile"));
  });
});

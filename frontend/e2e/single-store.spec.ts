import { expect, test } from "@playwright/test";
import { firstId } from "./helpers";

// Core rule: a product that only one store carries is still a result, and the compare view says so
// instead of hiding it. "Anex AG-6043 Blender" exists on Daraz only in the sample data.
test.describe("a product on a single store", () => {
  test("is found by search and labelled as being on one store only", async ({ page }) => {
    await page.goto("/search?q=anex blender");
    const card = page.getByTestId("product-card").filter({ hasText: "Anex AG-6043 Blender" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Only on Daraz");
    await expect(card.getByRole("list", { name: "Prices by store" }).getByRole("listitem")).toHaveCount(1);
  });

  test("is listed when browsing its category", async ({ page }) => {
    await page.goto("/search?category=home-appliances&pageSize=48");
    await expect(page.getByTestId("result-count")).toContainText("15 products");
    await page.getByRole("button", { name: "Page 2" }).click();
    await expect(page.getByTestId("product-card").filter({ hasText: /Anex|Kenwood|TCL|Haier|TP-Link/ }).first()).toBeVisible();
  });

  test("the compare view shows every store and marks the missing ones as not available", async ({ page, request }) => {
    const id = await firstId(request, "anex blender");
    await page.goto(`/compare?ids=${id}`);
    const table = page.getByTestId("compare-table");
    await expect(table.getByRole("columnheader")).toHaveCount(4); // corner + Daraz + PriceOye + AliExpress
    await expect(table.locator("th[data-missing]")).toHaveCount(2);
    await expect(table.getByText("Not available on PriceOye")).toBeVisible();
    await expect(table.getByText("Not available on AliExpress")).toBeVisible();
    await expect(table.getByRole("link", { name: /Daraz/ })).toBeVisible();
  });

  test("side by side with a product from several stores: missing stores say so", async ({ page, request }) => {
    const single = await firstId(request, "anex blender");
    const multi = await firstId(request, "iphone 15 128gb");
    await page.goto(`/compare?ids=${single},${multi}`);
    const table = page.getByTestId("compare-table");
    await expect(table.getByText("Not available on this store").first()).toBeVisible();
    await expect(table.getByRole("rowheader", { name: /PriceOye/ })).toBeVisible();
  });
});

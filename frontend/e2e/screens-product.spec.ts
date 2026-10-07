import { expect, test, type APIRequestContext } from "@playwright/test";
import path from "node:path";
import { imagesSettled, settle, snap } from "./helpers";

// Report screenshots for the product and compare pages (docs/screenshots_checklist.md).
const OUT = path.resolve(__dirname, "../../docs/screenshots");
const shot = (name: string) => ({ path: path.join(OUT, `${name}.png`), fullPage: true });

async function firstId(request: APIRequestContext, query: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(query)}&live=false`);
  return ((await res.json()) as { results: { id: string }[] }).results[0].id;
}

test.describe("report screenshots: product and compare", () => {
  test("07 product detail with price chart", async ({ page, request }) => {
    const id = await firstId(request, "samsung galaxy a55");
    await page.goto(`/products/${id}`);
    await expect(page.getByTestId("history-summary")).toBeVisible();
    await expect(page.locator(".recharts-line").first()).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await snap(page, shot("07-product"));
  });

  test("07b price alert dialog", async ({ page, request }) => {
    const id = await firstId(request, "samsung galaxy a55");
    await page.goto("/login");
    await page.getByRole("button", { name: /try the demo account/i }).click();
    await expect(page).toHaveURL("/");
    await page.goto(`/products/${id}`);
    await page.getByRole("button", { name: "Set price alert" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await settle(page);
    await snap(page, { path: path.join(OUT, "07b-alert-dialog.png") });
  });

  test("08 compare: products side by side", async ({ page, request }) => {
    const ids = [await firstId(request, "iphone 15 128gb"), await firstId(request, "samsung galaxy a55"), await firstId(request, "redmi note 14")];
    await page.goto(`/compare?ids=${ids.join(",")}`);
    await expect(page.getByTestId("compare-table")).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await snap(page, shot("08-compare"));
  });

  test("08b compare: one product across stores", async ({ page, request }) => {
    const id = await firstId(request, "samsung galaxy a55");
    await page.goto(`/compare?ids=${id}`);
    await expect(page.getByTestId("compare-table")).toBeVisible();
    await settle(page);
    await imagesSettled(page);
    await snap(page, shot("08b-compare-stores"));
  });
});

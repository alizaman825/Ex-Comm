import type { Page } from "@playwright/test";

/** Wait until fonts are loaded and the first paint has settled (networkidle is unreliable with route prefetching). */
export async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}

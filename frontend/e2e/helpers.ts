import type { Page } from "@playwright/test";

/** Wait until fonts are loaded and the first paint has settled (networkidle is unreliable with route prefetching). */
export async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}

/** Wait (up to a few seconds) for product images to load or fail, so screenshots are stable. */
export async function imagesSettled(page: Page, timeout = 6000) {
  await page
    .waitForFunction(() => Array.from(document.images).every((img) => img.complete), undefined, { timeout })
    .catch(() => undefined); // offline: images fail to load and fall back to placeholders
  await page.waitForTimeout(250);
}

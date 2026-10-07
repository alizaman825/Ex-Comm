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

import { expect, type APIRequestContext } from "@playwright/test";

/** Id of the first stored product matching a query (no live scraping). */
export async function firstId(request: APIRequestContext, query: string): Promise<string> {
  const res = await request.get(`/api/search?q=${encodeURIComponent(query)}&live=false`);
  return ((await res.json()) as { results: { id: string }[] }).results[0].id;
}

export const uniqueEmail = (prefix = "user") => `${prefix}${Date.now()}${Math.floor(Math.random() * 10000)}@example.com`;

/** Registers a brand-new user through the UI and waits until the home page shows them signed in. */
export async function registerUser(page: Page, name = "Test Shopper", password = "password1") {
  const email = uniqueEmail();
  await page.goto("/register");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/");
  return { email, password, name };
}

export async function loginDemoUser(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /try the demo account/i }).click();
  await expect(page).toHaveURL("/");
}

/** Scroll down the whole page in steps so scroll-driven scenes and reveals play, then return to the top (for full-page screenshots). */
export async function walkPage(page: Page) {
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(300, Math.floor((page.viewportSize()?.height ?? 800) * 0.6));
  for (let y = 0; y < total; y += step) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(900);
}

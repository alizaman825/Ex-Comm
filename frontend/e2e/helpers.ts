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

/** Local capture date and time, as the report template requires on screenshots. */
export const captureStamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

type ShotOptions = Parameters<Page["screenshot"]>[0];

/**
 * Report screenshot: loads lazy images first (full-page captures do not scroll, so images below the fold
 * would stay blank), waits for them, then stamps the real capture date and time in the corner.
 */
export async function snap(page: Page, options: ShotOptions) {
  await page.evaluate(() => document.querySelectorAll("img[loading=lazy]").forEach((i) => ((i as HTMLImageElement).loading = "eager")));
  if (options && "fullPage" in options && options.fullPage) await walkPage(page); // real scrolling is what makes the browser fetch lazy images
  await page
    .waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0), undefined, { timeout: 20_000 })
    .catch(() => undefined);
  await page.waitForTimeout(300);
  const stamp = captureStamp();
  await page.evaluate((text) => {
    const el = document.createElement("div");
    el.id = "capture-stamp";
    el.textContent = `Captured ${text}`;
    el.style.cssText = "position:absolute;right:10px;top:" + (document.documentElement.scrollHeight - 34) + "px;z-index:99999;font:600 12px/1 system-ui,sans-serif;color:#17140F;background:rgba(255,255,255,.92);padding:6px 10px;border-radius:999px;box-shadow:0 1px 4px rgba(0,0,0,.25)";
    document.body.appendChild(el);
  }, stamp);
  const buf = await page.screenshot(options);
  await page.evaluate(() => document.getElementById("capture-stamp")?.remove());
  return buf;
}

/** Scroll positions (px) that show each landing section at its most complete moment (pinned scenes at the end of their animation). */
export async function landingStops(page: Page): Promise<{ name: string; y: number }[]> {
  return page.evaluate(() => {
    const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + window.scrollY : null);
    const vh = window.innerHeight;
    const out: { name: string; y: number }[] = [{ name: "hero", y: 0 }];
    for (const name of ["compare", "track"]) {
      const el = document.querySelector('[data-scene="' + name + '"]') as HTMLElement | null;
      const t = top(el);
      if (el && t !== null) out.push({ name, y: t + el.offsetHeight - vh - 2 }); // last frame of the pinned scene
    }
    const cats = document.getElementById("home-categories");
    if (cats) out.push({ name: "categories", y: (top(cats) ?? 0) - 140 });
    const sell = document.querySelector('[data-scene="sell"]');
    if (sell) out.push({ name: "sell", y: (top(sell) ?? 0) - 20 });
    const drops = document.querySelector('[aria-label="Deals and trending"]');
    if (drops) out.push({ name: "deals", y: (top(drops) ?? 0) + 40 });
    return out;
  });
}

/** Viewport screenshots of every landing section, scrolled in steps so the scroll animations have played. */
export async function snapLanding(page: Page, outDir: string, prefix: string) {
  const stops = await landingStops(page);
  let n = 1;
  for (const s of stops) {
    const from = await page.evaluate(() => window.scrollY);
    for (let i = 1; i <= 8; i++) {
      await page.evaluate((y) => window.scrollTo(0, y), from + ((s.y - from) * i) / 8);
      await page.waitForTimeout(70);
    }
    await page.waitForTimeout(1400);
    await snap(page, { path: outDir + "/" + prefix + "-" + n++ + "-" + s.name + ".png" });
  }
}

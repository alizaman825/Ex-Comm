// Mega.pk background sync adapter (Phase 2 Part F): background sync only, never on-demand search,
// same pattern as scrapers/telex.js. Honest UA, read-only /sitemap.xml discovery + product-page reads.
//
// Mega.pk's robots.txt (re-checked live, Part F) is an "Allow: / then specific Disallow" file, not an
// explicit allow-list: the base rule for User-agent: * is `Allow: /`, and only these are then carved
// out: /cart/ /checkout/ /login/ /register/ /signup/ /wishlist/ /my/ /account/ /cgi-bin/ /tmp/ /admin/,
// a few broken-URL/script patterns, comparison "-vs-" pages, and - the one this task cares most about -
// query-string search/sort/filter/brand/page/color/size/condition/price params (?q=, ?sort=, ?filter=,
// ?brand=, ?page=, ?color=, ?size=, ?condition=, ?price=). The brief's own example allow-list
// (/product/, /products/, /laptops/, /accessories/...) turned out NOT to match Mega's real catalog URLs,
// which live at category-prefixed paths instead (e.g. /printer_products/462/..., /mouse_products/...,
// /laptopcharger_products/...) - verified against the real sitemap, not assumed. Those paths are not on
// any Disallow list, so they're allowed by the base `Allow: /` rule. assertAllowed() below reflects the
// real file: reject the enumerated Disallow prefixes, reject a comparison page, and - well beyond what's
// strictly required - reject ANY query string at all (never needed, since every URL here comes straight
// from the sitemap with no query string), which trivially satisfies "never request a ?q=/sort/filter/
// brand/page URL" since none of those, or any other query string, is ever let through.
const axios = require('axios');
const { config } = require('../config/env');
const { parsePrice, absoluteUrl } = require('./parse');

const HOST = 'www.mega.pk';
const BASE = `https://${HOST}`;
const SITEMAP_URL = `${BASE}/sitemap.xml`;

class MegaError extends Error {
  constructor(message, { code = 'MEGA_FAILED', status } = {}) {
    super(message);
    this.code = code; // BLOCKED | TIMEOUT | HTTP | PARSE | DISALLOWED | MEGA_FAILED
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Robots.txt's own enumerated Disallow prefixes (re-checked live, Part F - see file header).
const DISALLOWED_PATH_PREFIXES = [
  '/cart/',
  '/checkout/',
  '/login/',
  '/register/',
  '/signup/',
  '/wishlist/',
  '/my/',
  '/account/',
  '/cgi-bin/',
  '/tmp/',
  '/admin/',
];
const DISALLOWED_PATH_RE = /get_cat_url|get_detail_url|get_cat_accessories_url|-vs--|--vs--/i;

// Only the sitemap and product pages on Mega's own canonical host are ever requested, never a query
// string (robots.txt disallows ?q=/?sort=/?filter=/?brand=/?page=/?color=/?size=/?condition=/?price=,
// and nothing here needs any of them - the sitemap already gives a canonical, query-free URL), never
// one of the enumerated disallowed path prefixes, and never another host.
function assertAllowed(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new MegaError(`Not a URL: ${url}`, { code: 'DISALLOWED' });
  }
  const okHost = u.hostname === HOST || u.hostname === 'mega.pk';
  if (!okHost) throw new MegaError(`Refusing disallowed host: ${url}`, { code: 'DISALLOWED' });
  if (u.search) throw new MegaError(`Refusing a query-string URL: ${url}`, { code: 'DISALLOWED' });
  if (DISALLOWED_PATH_PREFIXES.some((p) => u.pathname.startsWith(p))) {
    throw new MegaError(`Refusing disallowed path: ${url}`, { code: 'DISALLOWED' });
  }
  if (DISALLOWED_PATH_RE.test(u.pathname)) throw new MegaError(`Refusing disallowed path: ${url}`, { code: 'DISALLOWED' });
  return u;
}

// GET with exponential backoff on 429/403/5xx, same policy as telex.js. Never spoofs a browser: a
// fixed, honest User-Agent naming this bot and its contact URL.
async function getWithBackoff(url, { attempt = 0 } = {}) {
  assertAllowed(url);
  let res;
  try {
    res = await axios.get(url, {
      timeout: config.megaSync.timeoutMs,
      headers: { 'User-Agent': config.megaSync.userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
      maxRedirects: 3,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new MegaError(err.message, { code: /timeout/i.test(err.message) ? 'TIMEOUT' : 'MEGA_FAILED' });
  }
  if (res.status === 429 || res.status === 403 || (res.status >= 500 && res.status < 600)) {
    if (attempt >= config.megaSync.maxRetries) {
      throw new MegaError(`Blocked by Mega.pk (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
    }
    const retryAfterMs = Number(res.headers?.['retry-after']) * 1000;
    const backoffMs = retryAfterMs > 0 ? retryAfterMs : config.megaSync.minDelayMs * 2 ** attempt;
    await sleep(backoffMs);
    return getWithBackoff(url, { attempt: attempt + 1 });
  }
  if (res.status >= 400) throw new MegaError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
  return res;
}

function parseSitemapIndex(xml) {
  const locs = [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.filter((u) => /sitemap-products/.test(u));
}

function parseProductSitemap(xml) {
  const locs = [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.filter((u) => /\.html$/.test(u));
}

async function discoverProductSitemaps() {
  const res = await getWithBackoff(SITEMAP_URL);
  return parseSitemapIndex(res.data);
}

async function discoverProductUrls(sitemapUrl) {
  const res = await getWithBackoff(sitemapUrl);
  return parseProductSitemap(res.data);
}

// Launch categories only (owner decision, Phase 2 Part F brief): phones, laptops, audio, watches,
// GPUs, home appliances - the same six launch categories backend/src/services/categories.js classifies
// into app-wide (mobiles/laptops/audio/watches/home-appliances), plus GPUs (not one of the app's six
// categories, but explicitly named in the brief - modelled on telex.js's own GPU terms).
const LAUNCH_CATEGORY_RE =
  /\b(phone|smartphone|mobile|iphone|galaxy|redmi|infinix|tecno|vivo|oppo|realme|honor|poco|laptop|notebook|macbook|ultrabook|chromebook|thinkpad|ideapad|vivobook|elitebook|graphics card|video card|\bgpu\b|geforce|radeon|\brtx\b|\bgtx\b|earbuds?|earphones?|headphones?|headset|airpods|\bbuds\b|speaker|soundbar|\btws\b|\bwatch\b|smartwatch|fitness band|amazfit|garmin|fitbit|g-?shock|air fryer|vacuum|blender|inverter|washing machine|\bled tv\b|microwave|refrigerator|\bfridge\b|\bkettle\b|geyser|\bheater\b|purifier)\b/i;
const isLaunchCategory = (title) => LAUNCH_CATEGORY_RE.test(String(title || ''));

// Parses a Mega.pk product page's schema.org Product JSON-LD block (unlike Telex, Mega's pages carry
// a clean <script type="application/ld+json"> Product block with name/productID/image/offers.price/
// offers.priceCurrency/offers.availability - no og:price meta tags needed). Throws (PARSE) rather than
// silently storing junk when no usable Product block is found.
function parseProductPage(html, url) {
  const text = String(html);
  const blocks = [...text.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let data = null;
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      if (parsed && parsed['@type'] === 'Product' && parsed.offers) {
        data = parsed;
        break;
      }
    } catch {
      // not valid/relevant JSON - try the next block
    }
  }
  if (!data) throw new MegaError('Unexpected Mega.pk product page (possible layout change)', { code: 'PARSE' });
  const title = data.name;
  const price = parsePrice(data.offers.price);
  if (!title || !price) throw new MegaError('Unexpected Mega.pk product page (possible layout change)', { code: 'PARSE' });
  const availability = String(data.offers.availability || '');
  const inStock = availability ? /InStock|LimitedAvailability|PreOrder/i.test(availability) : true;
  const productId = data.productID || (String(url).match(/_products\/(\d+)\//) || [])[1] || url;
  return {
    platform: 'mega',
    externalId: String(productId),
    title: String(title).trim(),
    url: absoluteUrl(data.url || url, BASE) || url,
    image: data.image ? absoluteUrl(data.image, BASE) : null,
    price,
    originalPrice: null,
    currency: data.offers.priceCurrency || 'PKR',
    inStock,
    role: 'retail',
  };
}

async function fetchProductPage(url) {
  const res = await getWithBackoff(url);
  return parseProductPage(res.data, url);
}

module.exports = {
  name: 'mega',
  label: 'Mega.pk',
  MegaError,
  assertAllowed,
  parseSitemapIndex,
  parseProductSitemap,
  parseProductPage,
  isLaunchCategory,
  discoverProductSitemaps,
  discoverProductUrls,
  fetchProductPage,
  getWithBackoff,
};

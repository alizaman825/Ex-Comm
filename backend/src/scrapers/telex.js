// Telex.pk (Telemart) adapter: background sync only, never on-demand search. Honest UA, respects
// read-only /sitemap.xml discovery and /products/{handle} browsing per telex.pk/agents.md and
// robots.txt (verified live, Phase 2A Step 1 - see project memory excomm-telex-step1-liveTest).
// No JSON-LD on these pages: price/stock are read from og:price:amount/og:price:currency and the
// embedded Shopify product JSON's "available" field instead.
const axios = require('axios');
const { config } = require('../config/env');
const { parsePrice, absoluteUrl } = require('./parse');

const HOST = 'www.telex.pk';
const BASE = `https://${HOST}`;
const SITEMAP_URL = `${BASE}/sitemap.xml`;

class TelexError extends Error {
  constructor(message, { code = 'TELEX_FAILED', status } = {}) {
    super(message);
    this.code = code; // BLOCKED | TIMEOUT | HTTP | PARSE | DISALLOWED | TELEX_FAILED
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Only the sitemap and public product pages on Telex's own canonical host are ever requested - never
// the search, cart, checkout or account paths robots.txt disallows, and never another host.
function assertAllowed(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new TelexError(`Not a URL: ${url}`, { code: 'DISALLOWED' });
  }
  const okHost = u.hostname === HOST || u.hostname === 'telex.pk';
  const okPath = u.pathname === '/sitemap.xml' || /^\/sitemap_[a-z0-9_]+\.xml$/.test(u.pathname) || u.pathname.startsWith('/products/');
  if (!okHost || !okPath) throw new TelexError(`Refusing disallowed URL: ${url}`, { code: 'DISALLOWED' });
  return u;
}

// GET with exponential backoff on 429/403/5xx (agents.md: "back off on 429 ... and respect Retry-After").
// Never spoofs a browser: a fixed, honest User-Agent naming this bot and its contact URL.
async function getWithBackoff(url, { attempt = 0 } = {}) {
  assertAllowed(url);
  let res;
  try {
    res = await axios.get(url, {
      timeout: config.telexSync.timeoutMs,
      headers: { 'User-Agent': config.telexSync.userAgent, 'Accept-Language': 'en-US,en;q=0.9' },
      maxRedirects: 3,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new TelexError(err.message, { code: /timeout/i.test(err.message) ? 'TIMEOUT' : 'TELEX_FAILED' });
  }
  if (res.status === 429 || res.status === 403 || (res.status >= 500 && res.status < 600)) {
    if (attempt >= config.telexSync.maxRetries) {
      throw new TelexError(`Blocked by Telex (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
    }
    const retryAfterMs = Number(res.headers?.['retry-after']) * 1000;
    const backoffMs = retryAfterMs > 0 ? retryAfterMs : config.telexSync.minDelayMs * 2 ** attempt;
    await sleep(backoffMs);
    return getWithBackoff(url, { attempt: attempt + 1 });
  }
  if (res.status >= 400) throw new TelexError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
  return res;
}

// Sitemap index -> product sub-sitemap URLs only (ignores the page/collection sitemaps listed
// alongside them: nothing there is a product).
function parseSitemapIndex(xml) {
  const locs = [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.filter((u) => /sitemap_products_/.test(u));
}

// One product sub-sitemap -> product page URLs.
function parseProductSitemap(xml) {
  const locs = [...String(xml).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return locs.filter((u) => /\/products\//.test(u));
}

async function discoverProductSitemaps() {
  const res = await getWithBackoff(SITEMAP_URL);
  return parseSitemapIndex(res.data);
}

async function discoverProductUrls(sitemapUrl) {
  const res = await getWithBackoff(sitemapUrl);
  return parseProductSitemap(res.data);
}

// Launch categories only (owner decision, Phase 2A brief): phones, laptops, GPUs and similar
// electronics. The sitemap carries no category, so this is checked on the fetched title.
const LAUNCH_CATEGORY_RE =
  /\b(phone|smartphone|mobile|iphone|galaxy|redmi|infinix|tecno|vivo|oppo|realme|laptop|notebook|macbook|ultrabook|chromebook|graphics card|video card|\bgpu\b|geforce|radeon|\brtx\b|\bgtx\b|processor|motherboard|\bram\b|\bssd\b|power supply|\bpsu\b)\b/i;
const isLaunchCategory = (title) => LAUNCH_CATEGORY_RE.test(String(title || ''));

// Parses a Shopify product page. Throws (PARSE) rather than silently storing junk when the title or
// price cannot be read.
function parseProductPage(html, url) {
  const text = String(html);
  const title = (text.match(/<meta property="og:title" content="([^"]*)"/) || [])[1];
  const priceStr = (text.match(/<meta property="og:price:amount" content="([^"]*)"/) || [])[1];
  const currency = (text.match(/<meta property="og:price:currency" content="([^"]*)"/) || [])[1] || 'PKR';
  const image = (text.match(/<meta property="og:image" content="([^"]*)"/) || [])[1];
  const price = parsePrice(priceStr);
  if (!title || !price) throw new TelexError('Unexpected Telex product page (possible layout change)', { code: 'PARSE' });
  const availableMatches = [...text.matchAll(/"available":(true|false)/g)];
  const inStock = availableMatches.length ? availableMatches.some((m) => m[1] === 'true') : !/out of stock|sold out/i.test(text);
  const handle = (String(url).match(/\/products\/([a-zA-Z0-9-]+)/) || [])[1] || url;
  return {
    platform: 'telex',
    externalId: handle,
    title: title.trim(),
    url: absoluteUrl(url, BASE) || url,
    image: image ? absoluteUrl(image, BASE) : null,
    price,
    originalPrice: null,
    currency,
    inStock,
    role: 'retail',
  };
}

async function fetchProductPage(url) {
  const res = await getWithBackoff(url);
  return parseProductPage(res.data, url);
}

module.exports = {
  name: 'telex',
  label: 'Telex.pk',
  TelexError,
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

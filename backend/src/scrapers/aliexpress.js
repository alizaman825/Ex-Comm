// AliExpress adapter (supplier source). The search page embeds its result list as JSON
// ("itemList":{"content":[...]}) with prices already in PKR, so no browser is needed.
// It is NOT part of the default live search: it only runs when the user asks ("Check on AliExpress"),
// because AliExpress is slow and can block automated requests at any time.
const axios = require('axios');
const { config } = require('../config/env');
const { ScrapeError, USER_AGENT } = require('./http');
const { unlockHtml } = require('./brightdata');

const BASE = 'https://www.aliexpress.com';
const TIMEOUT_MS = 25000;
const MARKER = '"itemList":{"content":';
const BACKSLASH = 92;

// Returns the JSON array that starts right after `marker`, found by matching brackets (string aware).
function extractArray(html, marker) {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const start = at + marker.length;
  if (html[start] !== '[') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch.charCodeAt(0) === BACKSLASH) escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

const asUrl = (u) => (u ? (String(u).startsWith('//') ? `https:${u}` : String(u)) : null);

function parseRating(it) {
  const raw = it.evaluation && (it.evaluation.starRating ?? it.evaluation.rating);
  const n = Number(raw);
  return n > 0 && n <= 5 ? Math.round(n * 10) / 10 : null;
}

// Parses the search page HTML into normalized listings (PKR prices).
function parse(html) {
  const raw = extractArray(String(html || ''), MARKER);
  if (!raw) throw new ScrapeError('AliExpress did not return a result list (blocked or layout change)', { code: 'BLOCKED' });
  let items;
  try {
    items = JSON.parse(raw);
  } catch {
    throw new ScrapeError('AliExpress result list could not be read', { code: 'PARSE' });
  }
  const out = [];
  for (const it of items) {
    const id = it.productId || it.redirectedId;
    const title = it.title && (it.title.displayTitle || it.title.seoTitle);
    const sale = it.prices && it.prices.salePrice;
    if (!id || !title || !sale || !(Number(sale.minPrice) > 0)) continue;
    if (sale.currencyCode && sale.currencyCode !== 'PKR') continue; // only prices already in rupees
    const price = Math.round(Number(sale.minPrice));
    const original = it.prices.originalPrice && Math.round(Number(it.prices.originalPrice.minPrice));
    out.push({
      platform: 'aliexpress',
      role: 'supplier',
      externalId: String(id),
      title: String(title).trim(),
      url: `${BASE}/item/${id}.html`,
      image: asUrl(it.image && it.image.imgUrl),
      price,
      originalPrice: original && original > price ? original : null,
      currency: 'PKR',
      rating: parseRating(it),
      reviewCount: Number((it.trade && String(it.trade.tradeDesc || '').replace(/[^0-9]/g, '')) || 0) || 0,
      inStock: true,
    });
  }
  return out;
}

function searchUrl(query) {
  return `${BASE}/wholesale?${new URLSearchParams({ SearchText: query }).toString()}`;
}

// Direct request (works until AliExpress blocks this IP, which it can do at any time).
async function fetchDirect(query) {
  let res;
  try {
    res = await axios.get(searchUrl(query), {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) throw new ScrapeError(`Timed out after ${TIMEOUT_MS} ms`, { code: 'TIMEOUT' });
    throw new ScrapeError(err.message);
  }
  if (res.status === 403 || res.status === 429) throw new ScrapeError(`Blocked by AliExpress (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
  if (res.status >= 400) throw new ScrapeError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
  return res.data;
}

async function search(query) {
  // Routed through Bright Data's Web Unlocker when configured (BRIGHTDATA_API_KEY + BRIGHTDATA_ZONE),
  // so a block only changes how the page is fetched - the parser below is unchanged either way.
  const html = config.brightdata.apiKey && config.brightdata.zone ? await unlockHtml(searchUrl(query)) : await fetchDirect(query);
  const out = parse(html);
  out.meta = { total: out.length, pageSize: out.length };
  return out;
}

// Supplier listings are not re-fetched by the price job.
const canRefetch = () => false;
const fetchListing = async () => {
  throw new ScrapeError('AliExpress listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'aliexpress', label: 'AliExpress', search, parse, extractArray, canRefetch, fetchListing };

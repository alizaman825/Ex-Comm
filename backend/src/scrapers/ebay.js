// eBay adapter (supplier/international reference source). Uses eBay's official Browse API via
// OAuth2 client-credentials - a real authenticated API call, not scraping - so it behaves the same in
// any environment (local or deployed). Like AliExpress, it is not part of the default live search
// (international shipping/customs apply), so the user asks for it via "Check on eBay"; prices come back
// in USD, converted to PKR by the caller (services/ebayCheck.js) before they are stored.
const axios = require('axios');
const { config } = require('../config/env');
const { ScrapeError } = require('./http');

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

let cachedToken = null; // { token, expiresAt }: an application token is valid for about 2 hours

function resetToken() {
  cachedToken = null;
}

async function getToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token;
  const { clientId, clientSecret } = config.ebay;
  if (!clientId || !clientSecret) throw new ScrapeError('eBay is not configured (EBAY_CLIENT_ID / EBAY_CLIENT_SECRET)', { code: 'CONFIG' });
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let res;
  try {
    res = await axios.post(TOKEN_URL, `grant_type=client_credentials&scope=${encodeURIComponent(SCOPE)}`, {
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: config.scraper.timeoutMs,
      validateStatus: () => true,
    });
  } catch (err) {
    throw new ScrapeError(`eBay authorization failed: ${err.message}`, { code: 'AUTH' });
  }
  if (res.status !== 200 || !res.data || !res.data.access_token) {
    throw new ScrapeError(`eBay authorization failed (HTTP ${res.status})`, { code: 'AUTH', status: res.status });
  }
  cachedToken = { token: res.data.access_token, expiresAt: Date.now() + res.data.expires_in * 1000 };
  return cachedToken.token;
}

// Normalizes one Browse API item summary. Returns null for anything we cannot price or link to.
function mapItem(it) {
  const price = it.price && Number(it.price.value);
  if (!it.itemId || !it.title || !(price > 0)) return null;
  if (it.price.currency && it.price.currency !== 'USD') return null; // only USD is converted to PKR
  return {
    platform: 'ebay',
    role: 'supplier',
    externalId: String(it.itemId),
    title: String(it.title).trim(),
    url: it.itemWebUrl,
    image: (it.image && it.image.imageUrl) || (it.thumbnailImages && it.thumbnailImages[0] && it.thumbnailImages[0].imageUrl) || null,
    priceUsd: Math.round(price * 100) / 100,
    rating: null, // the Browse API search response has no seller/item rating
    reviewCount: 0,
    inStock: true,
  };
}

async function search(query) {
  const token = await getToken();
  let res;
  try {
    res = await axios.get(SEARCH_URL, {
      params: { q: query, limit: 30 },
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': config.ebay.marketplaceId, Accept: 'application/json' },
      timeout: config.scraper.timeoutMs,
      validateStatus: () => true,
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) throw new ScrapeError(`Timed out after ${config.scraper.timeoutMs} ms`, { code: 'TIMEOUT' });
    throw new ScrapeError(err.message);
  }
  if (res.status === 401) {
    resetToken();
    throw new ScrapeError('eBay rejected the request (token expired or invalid)', { code: 'AUTH', status: 401 });
  }
  if (res.status === 403 || res.status === 429) throw new ScrapeError(`Blocked by eBay (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
  if (res.status >= 400) {
    const detail = res.data && res.data.errors && res.data.errors[0] && res.data.errors[0].message;
    throw new ScrapeError(`HTTP ${res.status}${detail ? `: ${detail}` : ''}`, { code: 'HTTP', status: res.status });
  }

  const items = (res.data && res.data.itemSummaries) || [];
  const out = items.map(mapItem).filter(Boolean);
  out.meta = { total: (res.data && res.data.total) || out.length, pageSize: out.length };
  return out;
}

// Supplier listings are not re-fetched by the price job (same as AliExpress).
const canRefetch = () => false;
const fetchListing = async () => {
  throw new ScrapeError('eBay listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'ebay', label: 'eBay', search, mapItem, getToken, resetToken, canRefetch, fetchListing };

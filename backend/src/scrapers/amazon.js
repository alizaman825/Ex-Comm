// Amazon adapter (supplier/international reference source), via Bright Data's pre-built Amazon Scraper
// API (dataset "Amazon Products Search": gd_lwdb4vjm1ehb499uxs - keyword search). Amazon blocks direct
// scraping aggressively from any datacenter IP (Render, Vercel, AWS...), so this goes through Bright
// Data's managed proxy/anti-bot network instead of a direct request - the same reason eBay uses an
// official API rather than scraping. Collection is asynchronous and can take up to a minute or so; the
// user asks for it ("Check on Amazon"), the same on-demand pattern as AliExpress and eBay. Prices come
// back in USD and are converted to PKR by the caller (services/amazonCheck.js).
//
// NOTE: the exact field names Bright Data returns for this dataset (title/asin/price/...) were sourced
// from Bright Data's public examples, not a live response (docs.brightdata.com was unreachable from this
// environment). mapItem() tries the common aliases defensively; verify against a real response once
// BRIGHTDATA_API_KEY is set and adjust the field names here if Bright Data's schema differs.
const { config } = require('../config/env');
const { collectDataset } = require('./brightdata');
const { ScrapeError } = require('./http');

const DATASET_ID = 'gd_lwdb4vjm1ehb499uxs';
const SITE = 'https://www.amazon.com';

function parsePriceUsd(rec) {
  const raw = rec.initial_price ?? rec.final_price ?? rec.price;
  const n = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
  return n > 0 ? Math.round(n * 100) / 100 : null;
}

// Normalizes one Amazon Scraper API record. Returns null for anything we cannot price or link to.
function mapItem(rec) {
  const asin = rec.asin || rec.product_id || rec.asin_code;
  const title = rec.title || rec.name;
  const priceUsd = parsePriceUsd(rec);
  const url = rec.url || (asin ? `${SITE}/dp/${asin}` : null);
  if (!asin || !title || !priceUsd || !url) return null;
  const rating = Number(rec.rating);
  return {
    platform: 'amazon',
    role: 'supplier',
    externalId: String(asin),
    title: String(title).trim(),
    url,
    image: rec.image_url || rec.image || null,
    priceUsd,
    rating: rating > 0 && rating <= 5 ? rating : null,
    reviewCount: Number(rec.reviews_count ?? rec.ratings_total ?? 0) || 0,
    inStock: rec.availability ? !/unavailable|out of stock/i.test(String(rec.availability)) : true,
  };
}

async function search(query) {
  const records = await collectDataset(DATASET_ID, { keyword: query, url: SITE, pages_to_search: 1 }, { pollTimeoutMs: config.brightdata.pollTimeoutMs });
  const out = records.map(mapItem).filter(Boolean);
  out.meta = { total: out.length, pageSize: out.length };
  return out;
}

// Supplier listings are not re-fetched by the price job (same as AliExpress and eBay).
const canRefetch = () => false;
const fetchListing = async () => {
  throw new ScrapeError('Amazon listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'amazon', label: 'Amazon', search, mapItem, canRefetch, fetchListing };

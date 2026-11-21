const { Category, Product, SearchCache, Listing } = require('../models');
const scrapers = require('../scrapers');
const { config } = require('../config/env');
const { memoize } = require('../utils/memoCache');

// Phase 2 Part E (E6): see products.controller.js's cacheableFor for why this is safe re: hard limit 8 -
// a cached response is never shown as fresher than it was when generated, only reused for a few seconds.
function cacheableFor(res, seconds) {
  res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 4}`);
}

// GET /api/categories: the six categories with their search presets and product counts.
async function listCategories(_req, res) {
  const categories = await memoize('categories', config.homeCache.ttlMs, async () => {
    const [cats, counts] = await Promise.all([
      Category.find().sort({ sortOrder: 1 }).lean(),
      Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ]);
    const countOf = Object.fromEntries(counts.map((c) => [c._id, c.count]));
    return cats.map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      keywords: c.keywords,
      productCount: countOf[c.slug] || 0,
    }));
  });
  cacheableFor(res, 60); // product counts change slowly - longer TTL than the price-bearing endpoints below
  res.json({ categories });
}

const PLATFORM_META = [
  { id: 'daraz', label: 'Daraz', role: 'retail', site: 'https://www.daraz.pk' },
  { id: 'priceoye', label: 'PriceOye', role: 'retail', site: 'https://priceoye.pk' },
  // Telex (Phase 2A): a background sync, not a live-on-search adapter - `live` below is always false
  // for it, since it is never in config.scraper.livePlatforms.
  { id: 'telex', label: 'Telex.pk', role: 'retail', site: 'https://www.telex.pk' },
  { id: 'aliexpress', label: 'AliExpress', role: 'supplier', site: 'https://www.aliexpress.com' },
  { id: 'ebay', label: 'eBay', role: 'supplier', site: 'https://www.ebay.com' },
];

// GET /api/platforms: supported stores and whether each can be scraped live right now.
// `listingCount`/`hasListings` are computed from real Listing documents (never hardcoded) so the
// frontend can hide a store with nothing currently listed, and the home page can state an accurate
// store count (C4) instead of a fixed number that drifts out of date as stores are added/removed.
async function listPlatforms(_req, res) {
  // Circuit-breaker state changes in real time (a store can trip/recover mid-window) and must never be
  // served stale, so only the slow-changing listing counts are memoized - the live part is read fresh
  // on every call.
  const circuits = Object.fromEntries(scrapers.platformStatus().map((s) => [s.platform, s]));
  const countOf = await memoize('platformListingCounts', config.homeCache.ttlMs, async () => {
    const counts = await Listing.aggregate([{ $group: { _id: '$platform', count: { $sum: 1 } } }]);
    return Object.fromEntries(counts.map((c) => [c._id, c.count]));
  });
  cacheableFor(res, 10); // short: circuit/lastError below is live, so the response as a whole shouldn't be reused long
  res.json({
    demoMode: config.demoMode,
    platforms: PLATFORM_META.map((p) => ({
      ...p,
      live: !config.demoMode && scrapers.livePlatforms().includes(p.id),
      circuit: circuits[p.id]?.circuit || null,
      retryAt: circuits[p.id]?.retryAt || null,
      lastError: circuits[p.id]?.lastError || null,
      lastSuccessAt: circuits[p.id]?.lastSuccessAt || null,
      listingCount: countOf[p.id] || 0,
      hasListings: Boolean(countOf[p.id]),
    })),
  });
}

// GET /api/search/trending: most-searched queries (from the search cache).
async function trending(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  const trending = await memoize(`searchTrending:${limit}`, config.homeCache.ttlMs, async () => {
    const rows = await SearchCache.find({ hits: { $gt: 0 }, query: { $exists: true }, 'productIds.0': { $exists: true } })
      .sort({ hits: -1, lastSearchedAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((r) => ({ query: r.query, hits: r.hits, results: (r.productIds || []).length }));
  });
  cacheableFor(res, 30);
  res.json({ trending });
}

module.exports = { listCategories, listPlatforms, trending };

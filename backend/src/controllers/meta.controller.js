const { Category, Product, SearchCache } = require('../models');
const scrapers = require('../scrapers');
const { config } = require('../config/env');

// GET /api/categories: the six categories with their search presets and product counts.
async function listCategories(_req, res) {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ sortOrder: 1 }).lean(),
    Product.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const countOf = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      icon: c.icon,
      keywords: c.keywords,
      productCount: countOf[c.slug] || 0,
    })),
  });
}

const PLATFORM_META = [
  { id: 'daraz', label: 'Daraz', role: 'retail', site: 'https://www.daraz.pk' },
  { id: 'priceoye', label: 'PriceOye', role: 'retail', site: 'https://priceoye.pk' },
  { id: 'aliexpress', label: 'AliExpress', role: 'supplier', site: 'https://www.aliexpress.com' },
  { id: 'ebay', label: 'eBay', role: 'supplier', site: 'https://www.ebay.com' },
];

// GET /api/platforms: supported stores and whether each can be scraped live right now.
function listPlatforms(_req, res) {
  const circuits = Object.fromEntries(scrapers.platformStatus().map((s) => [s.platform, s]));
  res.json({
    demoMode: config.demoMode,
    platforms: PLATFORM_META.map((p) => ({
      ...p,
      live: !config.demoMode && scrapers.livePlatforms().includes(p.id),
      circuit: circuits[p.id]?.circuit || null,
      retryAt: circuits[p.id]?.retryAt || null,
      lastError: circuits[p.id]?.lastError || null,
      lastSuccessAt: circuits[p.id]?.lastSuccessAt || null,
    })),
  });
}

// GET /api/search/trending: most-searched queries (from the search cache).
async function trending(req, res) {
  const limit = Math.min(Number(req.query.limit) || 10, 20);
  const rows = await SearchCache.find({ hits: { $gt: 0 }, query: { $exists: true }, 'productIds.0': { $exists: true } })
    .sort({ hits: -1, lastSearchedAt: -1 })
    .limit(limit)
    .lean();
  res.json({ trending: rows.map((r) => ({ query: r.query, hits: r.hits, results: (r.productIds || []).length })) });
}

module.exports = { listCategories, listPlatforms, trending };

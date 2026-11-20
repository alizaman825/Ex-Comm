const { z } = require('zod');
const { Product, Listing, PriceHistory, Wishlist, Alert } = require('../models');
const AppError = require('../utils/AppError');
const search = require('../services/search');
const { resolveCategory } = require('../services/categories');
const { excludeSeededInProd, realHistoryFilter, excludeStaleInProd } = require('../services/publicData');
const { statusOf } = require('../services/priceStatus');
const { config } = require('../config/env');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const idParams = z.object({ id: objectId });

const listQuerySchema = z.object({
  // Default stays small for the homepage rails; 300 is a sensible cap for the sitemap's bulk request
  // (/api/products/trending), well under the full catalog (~2000 products).
  limit: z.coerce.number().int().min(1).max(300).default(10),
  category: z.string().trim().max(60).optional(),
});
const historyQuerySchema = z.object({ days: z.enum(['7', '30', '90']).default('30').transform(Number) });
const compareQuerySchema = z.object({
  ids: z
    .string()
    .transform((s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))])
    .pipe(z.array(objectId).min(1, 'Provide at least one product id').max(4, 'You can compare up to 4 products')),
});

const day = (d) => d.toISOString().slice(0, 10);

function categoryFilter(category) {
  return category ? { category: resolveCategory(category) || '__none__' } : {};
}

async function cardsFor(products) {
  if (!products.length) return [];
  const listings = await Listing.find(excludeStaleInProd(excludeSeededInProd({ productId: { $in: products.map((p) => p._id) } }))).lean();
  const by = new Map();
  for (const l of listings) {
    const k = String(l.productId);
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(l);
  }
  return products.map((p) => search.toCard(p, by.get(String(p._id)) || []));
}

async function loadProduct(id) {
  const product = await Product.findById(id).lean();
  if (!product) throw new AppError(404, 'Product not found');
  return product;
}

const fullListing = (l) => ({
  id: String(l._id),
  platform: l.platform,
  role: l.role || 'retail',
  title: l.title,
  url: l.url,
  image: l.image || null,
  price: l.price,
  priceUsd: l.priceUsd || null,
  originalPrice: l.originalPrice || null,
  discountPct: l.originalPrice && l.originalPrice > l.price ? Math.round((1 - l.price / l.originalPrice) * 100) : 0,
  currency: l.currency,
  rating: l.rating || null,
  reviewCount: l.reviewCount || 0,
  inStock: l.inStock,
  dataSource: l.dataSource,
  lastScrapedAt: l.lastScrapedAt,
  // Replaces the old always-"Live"/"Saved" badge (PLAN.md item 3): checked_recently | stale |
  // unavailable | check_failed | unknown, computed fresh from lastScrapedAt/inStock/lastCheckFailedAt.
  status: statusOf(l),
  sellerName: l.sellerName || null,
  sellerLocation: l.sellerLocation || null,
  condition: l.condition || 'unknown',
  conditionLabel: l.conditionLabel || null,
  multiVariant: Boolean(l.multiVariant),
});

// A product whose freshest in-stock retail offer was last checked within the freshness window.
// Nothing recent enough to trust is treated the same as out of stock for the home page's sake: if the
// background sync stalls (e.g. the host spun down), a rail should go quiet rather than keep showing a
// price/availability nobody has confirmed in days.
function isFreshEnough(card) {
  const retail = card.offers.filter((o) => o.role !== 'supplier' && o.inStock && o.lastScrapedAt);
  if (!retail.length) return false;
  const newest = Math.max(...retail.map((o) => new Date(o.lastScrapedAt).getTime()));
  return Date.now() - newest <= config.home.freshnessHours * 60 * 60 * 1000;
}

// A product with nothing currently in stock anywhere, or nothing checked recently enough to trust,
// shouldn't lead a promotional rail (home page trending/drops); fetch extra candidates and drop them.
async function availableCardsFor(pool, limit) {
  const cards = await cardsFor(pool);
  return cards
    .filter((c) => c.offers.some((o) => o.inStock))
    .filter(isFreshEnough)
    .slice(0, limit);
}

// GET /api/products/trending: most popular, in-stock products.
async function trending(req, res) {
  const { limit, category } = req.validQuery;
  const pool = await Product.find(categoryFilter(category)).sort({ popularity: -1, reviewCount: -1 }).limit(limit * 3).lean();
  res.json({ products: await availableCardsFor(pool, limit) });
}

// GET /api/products/drops: biggest price drops over the last 7 days, in-stock only, and only products
// with enough real history behind the number (owner decision, 2026-11-20: >=5 real observations over
// >=7 days - services/productStats.js's dealEligible). Expect very few results while the catalog is
// still mostly unverified history; an empty list here is the frontend's cue to hide the section rather
// than back-fill it with unverified data.
async function drops(req, res) {
  const { limit, category } = req.validQuery;
  const pool = await Product.find({ ...categoryFilter(category), priceChange7d: { $lt: 0 }, dealEligible: true })
    .sort({ priceChange7d: 1 })
    .limit(limit * 3)
    .lean();
  res.json({ products: await availableCardsFor(pool, limit) });
}

// GET /api/products/:id: product with every listing (and the user's wishlist/alert state if signed in).
async function getProduct(req, res) {
  const product = await loadProduct(req.params.id);
  const listings = await Listing.find(excludeStaleInProd(excludeSeededInProd({ productId: product._id }))).sort({ price: 1 }).lean();
  const [card] = await cardsFor([product]);
  const out = { ...card, retailMinPrice: product.retailMinPrice || null, supplierMinPrice: product.supplierMinPrice || null, listings: listings.map(fullListing) };
  if (req.user) {
    const [wish, alerts] = await Promise.all([
      Wishlist.exists({ userId: req.user._id, productId: product._id }),
      Alert.countDocuments({ userId: req.user._id, productId: product._id, active: true }),
    ]);
    out.inWishlist = Boolean(wish);
    out.activeAlerts = alerts;
  }
  res.json({ product: out });
}

// GET /api/products/:id/history?days=7|30|90: daily lowest price per platform, plus an overall series.
async function getHistory(req, res) {
  const product = await loadProduct(req.params.id);
  const { days } = req.validQuery;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // PLAN.md item 1/5: in production, a chart or "N observations" count built from simulated/unverified
  // points would overstate how much real history actually backs it - only real scrapes count there.
  // Outside production the seed catalog's honestly-simulated history is left alone (realHistoryFilter).
  const rows = await PriceHistory.find(realHistoryFilter({ productId: product._id, scrapedAt: { $gte: since } })).sort({ scrapedAt: 1 }).lean();
  const listings = await Listing.find({ productId: product._id }).select('platform role').lean();
  const roleOf = Object.fromEntries(listings.map((l) => [l.platform, l.role || 'retail']));

  const perPlatform = new Map(); // platform -> Map(day -> min price)
  for (const r of rows) {
    if (!perPlatform.has(r.platform)) perPlatform.set(r.platform, new Map());
    const m = perPlatform.get(r.platform);
    const d = day(r.scrapedAt);
    m.set(d, Math.min(m.get(d) ?? Infinity, r.price));
  }
  const series = [...perPlatform.entries()].map(([platform, m]) => ({
    platform,
    role: roleOf[platform] || 'retail',
    points: [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price })),
  }));

  // Overall = cheapest retail price per day (suppliers are shown as their own series).
  const overall = new Map();
  for (const s of series.filter((x) => x.role !== 'supplier')) {
    for (const p of s.points) overall.set(p.date, Math.min(overall.get(p.date) ?? Infinity, p.price));
  }
  const overallPoints = [...overall.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, price]) => ({ date, price }));
  const prices = overallPoints.map((p) => p.price);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const lowIdx = prices.length ? prices.indexOf(Math.min(...prices)) : -1;
  const sortedPrices = [...prices].sort((a, b) => a - b);
  const median = sortedPrices.length
    ? sortedPrices.length % 2
      ? sortedPrices[(sortedPrices.length - 1) / 2]
      : Math.round((sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2)
    : null;
  const daysSpan = overallPoints.length > 1
    ? Math.round((new Date(overallPoints[overallPoints.length - 1].date) - new Date(overallPoints[0].date)) / (24 * 60 * 60 * 1000))
    : 0;

  res.json({
    productId: String(product._id),
    days,
    series,
    overall: overallPoints,
    // PLAN.md item 5: a second, history-based savings figure is only meaningful (and only ever shown)
    // once there's enough real data behind it - the frontend gates on observations/daysSpan itself.
    summary: prices.length
      ? {
          current: last,
          lowest: prices[lowIdx],
          lowestDate: overallPoints[lowIdx].date,
          highest: Math.max(...prices),
          average: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
          median,
          changePct: Math.round(((last - first) / first) * 1000) / 10,
          observations: rows.length,
          daysSpan,
        }
      : null,
  });
}

// GET /api/products/:id/similar: other products in the same family - same category, and same brand when
// known - never a different model number pulled in just because it shares a non-model word. (PLAN.md
// item 5: the old version stripped every digit from the title before searching, so "iPhone 15 Pro Max"
// and "iPhone 17 Pro Max" matched each other - a different, much pricier/cheaper model shown as "similar"
// with its own truthful-but-misleading "Best price" badge.)
async function similar(req, res) {
  const product = await loadProduct(req.params.id);
  const filter = { _id: { $ne: product._id }, ...categoryFilter(product.category) };
  if (product.brand) filter.brand = product.brand;
  const pool = await Product.find(filter).sort({ popularity: -1 }).limit(8).lean();
  res.json({ products: await cardsFor(pool) });
}

// GET /api/compare?ids=a,b,c: side-by-side data for 1 product (stores as columns) or up to 4 products.
async function compare(req, res) {
  const { ids } = req.validQuery;
  const products = await Product.find({ _id: { $in: ids } }).lean();
  if (products.length !== ids.length) throw new AppError(404, 'One or more products were not found');
  const ordered = ids.map((id) => products.find((p) => String(p._id) === id));
  const listings = await Listing.find(excludeStaleInProd(excludeSeededInProd({ productId: { $in: ids } }))).sort({ price: 1 }).lean();

  const columns = ordered.map((p) => {
    const mine = listings.filter((l) => String(l.productId) === String(p._id));
    return { ...search.toCard(p, mine), listings: mine.map(fullListing) };
  });

  const retail = listings.filter((l) => l.inStock && l.role !== 'supplier');
  const cheapest = retail.length ? retail.reduce((a, b) => (b.price < a.price ? b : a)) : null;
  const rated = listings.filter((l) => l.rating);
  const best = rated.length ? rated.reduce((a, b) => ((b.rating * 1e6 + b.reviewCount) > (a.rating * 1e6 + a.reviewCount) ? b : a)) : null;

  res.json({
    mode: ids.length === 1 ? 'platforms' : 'products',
    products: columns,
    cheapest: cheapest && { productId: String(cheapest.productId), listingId: String(cheapest._id), platform: cheapest.platform, price: cheapest.price },
    bestRated: best && { productId: String(best.productId), listingId: String(best._id), platform: best.platform, rating: best.rating },
  });
}

module.exports = {
  trending, drops, getProduct, getHistory, similar, compare,
  idParams, listQuerySchema, historyQuerySchema, compareQuerySchema, cardsFor, objectId,
};

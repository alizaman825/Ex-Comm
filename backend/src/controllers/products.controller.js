const { z } = require('zod');
const { Product, Listing, PriceHistory, Wishlist, Alert } = require('../models');
const AppError = require('../utils/AppError');
const search = require('../services/search');
const { parseQuery } = require('../services/relevance');
const { significantTokens } = require('../services/matching');
const { resolveCategory } = require('../services/categories');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const idParams = z.object({ id: objectId });

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(10),
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
  const listings = await Listing.find({ productId: { $in: products.map((p) => p._id) } }).lean();
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
});

// GET /api/products/trending: most popular products.
async function trending(req, res) {
  const { limit, category } = req.validQuery;
  const products = await Product.find(categoryFilter(category)).sort({ popularity: -1, reviewCount: -1 }).limit(limit).lean();
  res.json({ products: await cardsFor(products) });
}

// GET /api/products/drops: biggest price drops over the last 7 days.
async function drops(req, res) {
  const { limit, category } = req.validQuery;
  const products = await Product.find({ ...categoryFilter(category), priceChange7d: { $lt: 0 } })
    .sort({ priceChange7d: 1 })
    .limit(limit)
    .lean();
  res.json({ products: await cardsFor(products) });
}

// GET /api/products/:id: product with every listing (and the user's wishlist/alert state if signed in).
async function getProduct(req, res) {
  const product = await loadProduct(req.params.id);
  const listings = await Listing.find({ productId: product._id }).sort({ price: 1 }).lean();
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
  const rows = await PriceHistory.find({ productId: product._id, scrapedAt: { $gte: since } }).sort({ scrapedAt: 1 }).lean();
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

  res.json({
    productId: String(product._id),
    days,
    series,
    overall: overallPoints,
    summary: prices.length
      ? {
          current: last,
          lowest: prices[lowIdx],
          lowestDate: overallPoints[lowIdx].date,
          highest: Math.max(...prices),
          average: Math.round(prices.reduce((s, p) => s + p, 0) / prices.length),
          changePct: Math.round(((last - first) / first) * 1000) / 10,
        }
      : null,
  });
}

// GET /api/products/:id/similar: suggestions for manual comparison when automatic matching found few stores.
async function similar(req, res) {
  const product = await loadProduct(req.params.id);
  const tokens = significantTokens(`${product.brand || ''} ${product.title}`).filter((t) => !/[0-9]/.test(t)).slice(0, 3);
  const found = await search.localSearch(parseQuery(tokens.join(' ')), { category: product.category });
  const others = found.filter((p) => String(p._id) !== String(product._id)).slice(0, 8);
  res.json({ products: await cardsFor(others) });
}

// GET /api/compare?ids=a,b,c: side-by-side data for 1 product (stores as columns) or up to 4 products.
async function compare(req, res) {
  const { ids } = req.validQuery;
  const products = await Product.find({ _id: { $in: ids } }).lean();
  if (products.length !== ids.length) throw new AppError(404, 'One or more products were not found');
  const ordered = ids.map((id) => products.find((p) => String(p._id) === id));
  const listings = await Listing.find({ productId: { $in: ids } }).sort({ price: 1 }).lean();

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

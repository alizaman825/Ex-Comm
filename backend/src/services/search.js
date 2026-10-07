// Search: cache-first, then live scrape (Daraz + PriceOye), falling back to stored/sample data.
// Result `source`: 'live' (scraped now), 'cache' (fresh cache), 'fallback' (live failed/skipped, stored data shown).
const { config } = require('../config/env');
const { Product, Listing, SearchCache } = require('../models');
const scrapers = require('../scrapers');
const { normalizeText, searchKeyOf } = require('./matching');
const { resolveCategory } = require('./categories');
const { parseQuery, isRelevant, relevanceScore } = require('./relevance');
const { ingestListings } = require('./ingest');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inflight = new Map();

const queryKeyOf = (q) => normalizeText(q).split(' ').filter(Boolean).sort().join(' ');

function withTimeout(promise, ms, fallback) {
  let timer;
  return Promise.race([promise, new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); })]).finally(() =>
    clearTimeout(timer)
  );
}

// Products already stored that answer the query, ordered by relevance (or popularity when no query).
async function localSearch(parsed, { category } = {}) {
  const filter = {};
  if (category) filter.category = resolveCategory(category) || '__none__';
  if (parsed.tokens.length) {
    // Compare against the compact key so "wh-1000xm5" and "wh1000xm5" both find "Sony WH-1000XM5".
    // isRelevant() below does the precise check.
    filter.$and = parsed.tokens.map((t) => ({ searchKey: new RegExp(escapeRegex(searchKeyOf(t)), 'i') }));
  }
  let docs = await Product.find(filter).limit(300).lean();
  if (parsed.tokens.length) {
    docs = docs
      .filter((p) => isRelevant(parsed, `${p.brand || ''} ${p.title}`))
      .map((p) => ({ p, score: relevanceScore(parsed, `${p.brand || ''} ${p.title}`) }))
      .sort((a, b) => b.score - a.score || (b.p.popularity || 0) - (a.p.popularity || 0))
      .map((x) => x.p);
  } else {
    docs.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  }
  return docs;
}

async function liveScrapeAndIngest(query, parsed) {
  const platforms = scrapers.livePlatforms();
  const pending = scrapers.scrapeAll(query, platforms);
  const timedOut = Object.fromEntries(
    platforms.map((p) => [p, { platform: p, status: 'failed', listings: [], error: 'Search time budget exceeded', ms: config.search.liveBudgetMs }])
  );
  const results = await withTimeout(pending, config.search.liveBudgetMs, timedOut);

  const platformStatus = {};
  const toIngest = [];
  for (const [platform, r] of Object.entries(results)) {
    const relevant = r.listings.filter((l) => isRelevant(parsed, l.title)).slice(0, config.search.maxIngestPerPlatform);
    platformStatus[platform] = {
      status: r.status,
      scraped: r.listings.length,
      relevant: relevant.length,
      ms: r.ms,
      ...(r.error ? { error: r.error } : {}),
    };
    toIngest.push(...relevant);
  }
  if (toIngest.length) await ingestListings(toIngest);
  const anySuccess = Object.values(platformStatus).some((s) => s.status === 'success');
  return { platformStatus, anySuccess };
}

// Decide where data comes from and refresh the DB if needed. Returns { source, platformStatus, fetchedAt }.
async function prepareData(query, parsed, { live = true } = {}) {
  const queryKey = queryKeyOf(query);
  const cached = await SearchCache.findOne({ queryKey });
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < config.search.cacheTtlMs;
  if (fresh) return { source: 'cache', platformStatus: cached.platformStatus, fetchedAt: cached.fetchedAt, cached };
  if (!live || config.demoMode) {
    return { source: 'fallback', platformStatus: cached?.platformStatus || {}, fetchedAt: cached?.fetchedAt || null, cached };
  }

  if (!inflight.has(queryKey)) {
    inflight.set(queryKey, liveScrapeAndIngest(query, parsed).finally(() => inflight.delete(queryKey)));
  }
  const { platformStatus, anySuccess } = await inflight.get(queryKey);
  if (anySuccess) return { source: 'live', platformStatus, fetchedAt: new Date(), cached, store: true };
  return { source: 'fallback', platformStatus, fetchedAt: cached?.fetchedAt || null, cached };
}

// Cheapest in-stock offer per platform, shaped for product cards.
function offersFor(listings) {
  const best = new Map();
  for (const l of listings) {
    const cur = best.get(l.platform);
    const better = !cur || (l.inStock && !cur.inStock) || (l.inStock === cur.inStock && l.price < cur.price);
    if (better) best.set(l.platform, l);
  }
  return [...best.values()]
    .sort((a, b) => a.price - b.price)
    .map((l) => ({
      listingId: String(l._id),
      platform: l.platform,
      role: l.role || 'retail',
      priceUsd: l.priceUsd || null,
      price: l.price,
      originalPrice: l.originalPrice || null,
      rating: l.rating || null,
      reviewCount: l.reviewCount || 0,
      inStock: l.inStock,
      url: l.url,
      dataSource: l.dataSource,
      lastScrapedAt: l.lastScrapedAt,
    }));
}

function toCard(product, listings) {
  const offers = offersFor(listings);
  return {
    id: String(product._id),
    title: product.title,
    brand: product.brand || null,
    category: product.category || null,
    image: product.image || listings.find((l) => l.image)?.image || null,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    rating: product.rating || null,
    reviewCount: product.reviewCount || 0,
    priceChange7d: product.priceChange7d || 0,
    platforms: product.platforms,
    offers,
  };
}

const SORTS = {
  relevance: null,
  price_asc: (a, b) => a.minPrice - b.minPrice,
  price_desc: (a, b) => b.minPrice - a.minPrice,
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount,
  discount: (a, b) => a.priceChange7d - b.priceChange7d,
};

// params: { q, category, platform[], minPrice, maxPrice, minRating, sort, page, pageSize, live }
async function search(params) {
  const { q = '', category, platform, minPrice, maxPrice, minRating, sort = 'relevance', page = 1, pageSize = 12, live = true } = params;
  const parsed = parseQuery(q);

  let meta = { source: 'fallback', platformStatus: {}, fetchedAt: null };
  let cached = null;
  if (parsed.tokens.length) {
    meta = await prepareData(q, parsed, { live });
    cached = meta.cached;
  }

  const products = await localSearch(parsed, { category });
  const listingsByProduct = new Map();
  if (products.length) {
    const all = await Listing.find({ productId: { $in: products.map((p) => p._id) } }).lean();
    for (const l of all) {
      const k = String(l.productId);
      if (!listingsByProduct.has(k)) listingsByProduct.set(k, []);
      listingsByProduct.get(k).push(l);
    }
  }

  // Filters apply to the offers of the selected platforms.
  const wanted = platform && platform.length ? new Set(platform) : null;
  let cards = [];
  for (const p of products) {
    let listings = listingsByProduct.get(String(p._id)) || [];
    if (wanted) listings = listings.filter((l) => wanted.has(l.platform));
    if (minPrice !== undefined) listings = listings.filter((l) => l.price >= minPrice);
    if (maxPrice !== undefined) listings = listings.filter((l) => l.price <= maxPrice);
    if (minRating !== undefined) listings = listings.filter((l) => (l.rating || 0) >= minRating);
    if (!listings.length) continue;
    const card = toCard(p, listings);
    if (wanted || minPrice !== undefined || maxPrice !== undefined || minRating !== undefined) {
      // Headline price = the retail listings that matched (supplier prices only headline when nothing else matched).
      const retail = listings.filter((l) => l.role !== 'supplier');
      const headline = retail.length ? retail : listings;
      card.minPrice = Math.min(...headline.map((l) => l.price));
      card.maxPrice = Math.max(...headline.map((l) => l.price));
    }
    cards.push(card);
  }
  if (SORTS[sort]) cards.sort(SORTS[sort]);

  const total = cards.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  cards = cards.slice((page - 1) * pageSize, page * pageSize);

  // Remember the query (for the cache and the trending list).
  if (parsed.tokens.length) {
    const queryKey = queryKeyOf(q);
    const update = { $set: { query: q.trim().toLowerCase(), lastSearchedAt: new Date() }, $inc: { hits: 1 } };
    if (meta.source === 'live') {
      update.$set = { ...update.$set, source: 'live', platformStatus: meta.platformStatus, fetchedAt: meta.fetchedAt, productIds: products.map((p) => p._id) };
    } else if (!cached) {
      update.$set = { ...update.$set, source: meta.source, platformStatus: meta.platformStatus, fetchedAt: new Date(0), productIds: [] };
    }
    await SearchCache.updateOne({ queryKey }, update, { upsert: true });
  }

  return {
    query: q,
    source: meta.source,
    fetchedAt: meta.fetchedAt,
    platformStatus: meta.platformStatus,
    total,
    page,
    pages,
    pageSize,
    results: cards,
  };
}

module.exports = { search, localSearch, queryKeyOf, toCard, offersFor };

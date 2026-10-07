// Search: cache-first, then live scrape (Daraz + PriceOye), falling back to stored/sample data.
// Result `source`: 'live' (scraped now), 'cache' (fresh cache), 'fallback' (live failed/skipped, stored data shown).
const { config } = require('../config/env');
const { Product, Listing, SearchCache } = require('../models');
const { gatherAll } = require('./gather');
const { normalizeText, searchKeyOf } = require('./matching');
const { resolveCategory } = require('./categories');
const { parseQuery, isRelevantAny, bestScore, TOKEN_SYNONYMS } = require('./relevance');
const { ingestListings } = require('./ingest');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const inflight = new Map();

const queryKeyOf = (q) => normalizeText(q).split(' ').filter(Boolean).sort().join(' ');

// Database pre-filter pattern for one query token. It must accept everything isRelevant() could accept
// (that function does the precise check), so it mirrors its tolerances:
//  - spacing/hyphens/dots are ignored (compact key),
//  - a plural query word also matches the singular ("headphones" ~ "headphone"),
//  - "15 inch" also matches "15.6 inch" (compact key "156in"),
//  - equivalent words ("laptop" ~ "macbook") match each other.
// A brand named only through its product line ("Galaxy" for Samsung) is handled by the precise check; the
// pre-filter requires only ONE of the non-model words, so it cannot exclude those.
function tokenPattern(t) {
  const alternatives = [escapeRegex(searchKeyOf(t))];
  if (/^[0-9]+in$/.test(t)) alternatives.push(`${t.slice(0, -2)}[0-9]*in`);
  if (t.length > 3 && t.endsWith('s')) alternatives.push(escapeRegex(searchKeyOf(t.slice(0, -1))));
  for (const alt of TOKEN_SYNONYMS[t] || []) alternatives.push(escapeRegex(searchKeyOf(alt)));
  return new RegExp(alternatives.join('|'), 'i');
}

// Products already stored that answer the query, ordered by relevance (or popularity when no query).
// A product matches when ANY of its names does (its title or the title of any store listing), so a
// product is never lost because its shortened display title dropped a word. Nothing here depends on
// how many stores carry the product.
async function localSearch(parsed, { category } = {}) {
  const filter = {};
  if (category) filter.category = resolveCategory(category) || '__none__';
  const browsing = parsed.tokens.length === 0;
  if (!browsing) {
    // Cheap pre-filter on the compact key (so "wh-1000xm5" and "wh1000xm5" both find "Sony WH-1000XM5"):
    // all model tokens, and at least one of the other words. Accessory words are only a preference, so
    // they are not required here. isRelevantAny() below does the precise check.
    const key = tokenPattern;
    const must = parsed.model.map((t) => ({ searchKey: key(t) }));
    const some = parsed.words.length ? [{ $or: parsed.words.map((t) => ({ searchKey: key(t) })) }] : [];
    const only = !must.length && !some.length ? parsed.tokens.map((t) => ({ searchKey: key(t) })) : [];
    filter.$and = [...must, ...some, ...only];
  }
  // Browsing sorts in the database before limiting, so the most popular products are never cut off.
  const docs = await Product.find(filter)
    .sort(browsing ? { popularity: -1 } : undefined)
    .limit(browsing ? 2000 : 1500)
    .lean();
  if (browsing) return docs;

  const names = (p) => [`${p.brand || ''} ${p.title}`, ...(p.altTitles || [])];
  return docs
    .filter((p) => isRelevantAny(parsed, names(p)))
    .map((p) => ({ p, score: bestScore(parsed, names(p)) }))
    .sort((x, y) => y.score - x.score || (y.p.popularity || 0) - (x.p.popularity || 0))
    .map((x) => x.p);
}

async function liveScrapeAndIngest(query) {
  const { platformStatus, listings, anySuccess } = await gatherAll(query);
  if (listings.length) await ingestListings(listings);
  return { platformStatus, anySuccess, found: listings.length };
}

// Decide where data comes from and refresh the DB if needed. Returns { source, platformStatus, fetchedAt }.
async function prepareData(query, parsed, { live = true, refresh = false } = {}) {
  const queryKey = queryKeyOf(query);
  const cached = await SearchCache.findOne({ queryKey });
  // A search that found nothing is only remembered briefly: stores change, and a miss must not hide a product for hours.
  const ttl = cached && cached.productIds && cached.productIds.length ? config.search.cacheTtlMs : config.search.emptyCacheTtlMs;
  // refresh = the user asked to check the stores again, so an earlier result is never reused
  const fresh = !refresh && cached && Date.now() - cached.fetchedAt.getTime() < ttl;
  if (fresh) return { source: 'cache', platformStatus: cached.platformStatus, fetchedAt: cached.fetchedAt, cached };
  if (!live || config.demoMode) {
    return { source: 'fallback', platformStatus: cached?.platformStatus || {}, fetchedAt: cached?.fetchedAt || null, cached };
  }

  if (!inflight.has(queryKey)) {
    inflight.set(queryKey, liveScrapeAndIngest(query).finally(() => inflight.delete(queryKey)));
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
  const { q = '', category, platform, minPrice, maxPrice, minRating, sort = 'relevance', page = 1, pageSize = 12, live = true, refresh = false } = params;
  const parsed = parseQuery(q);

  let meta = { source: 'fallback', platformStatus: {}, fetchedAt: null };
  let cached = null;
  if (parsed.tokens.length) {
    meta = await prepareData(q, parsed, { live, refresh });
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
    demoMode: config.demoMode, // true: live scraping is switched off, only saved data is shown
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

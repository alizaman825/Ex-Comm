// Turns scraped listings into stored data, in bulk (a fixed number of database queries per batch, however
// many listings it holds).
//
// Grouping rules:
//  - The same product on DIFFERENT stores is grouped into one product (title normalization + fuzzy match),
//    so it can be compared.
//  - Two listings on the SAME store are never merged into one listing: a store that shows 40 results
//    gives 40 listing rows. On most stores, only one of those rows can attach to a given product (one
//    listing per store per product). On a MULTI_SELLER_PLATFORMS store (Daraz), several different
//    sellers' rows can all attach to the same product as separate offers - see docs/MULTI_SELLER_PLAN.md.
//  - A listing that is already stored keeps its product (its identity does not depend on re-matching).
const mongoose = require('mongoose');
const { Product, Listing, PriceHistory } = require('../models');
const { analyzeTitle, findBestMatch, searchKeyOf } = require('./matching');
const { refreshProductsStats } = require('./productStats');
const { classify } = require('./categories');

const HISTORY_MIN_GAP_MS = 12 * 60 * 60 * 1000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keyOf = (l) => `${l.platform}|${l.externalId}`;

// "Samsung Galaxy A55 5G - 8GB 256GB - 6.6" Display - PTA Approved" -> "Samsung Galaxy A55 5G"
function cleanTitle(title) {
  const full = String(title).replace(/\s*\|\|\s*/g, ' | ').replace(/\s+/g, ' ').trim();
  const cut = full.split(/\s+[-|–]\s+|\s*\(/)[0].trim();
  // Keep the short form only when it still names the product (>= 3 words); generic titles keep more.
  const chosen = cut.split(' ').length >= 3 ? cut : full.replace(/\s*[|]\s*$/, '');
  return chosen.slice(0, 90).trim();
}

function capitalize(s) {
  return s ? s.replace(/(^|[\s-])([a-z])/g, (_m, a, b) => a + b.toUpperCase()) : s;
}

// Adds a price-history point when the price changed or the last point is old.
async function appendHistory(listing, price, now, { force = false } = {}) {
  const last = await PriceHistory.findOne({ listingId: listing._id }).sort({ scrapedAt: -1 }).lean();
  if (force || !last || last.price !== price || now - last.scrapedAt > HISTORY_MIN_GAP_MS) {
    await PriceHistory.create({ listingId: listing._id, productId: listing.productId, platform: listing.platform, price, scrapedAt: now });
    return true;
  }
  return false;
}

const listingFields = (l, now) => ({
  role: l.role || 'retail',
  title: l.title,
  url: l.url,
  image: l.image || undefined,
  price: l.price,
  originalPrice: l.originalPrice || undefined,
  priceUsd: l.priceUsd || undefined,
  currency: l.currency || 'PKR',
  rating: l.rating || undefined,
  reviewCount: l.reviewCount || 0,
  inStock: l.inStock !== false,
  sellerId: l.sellerId || undefined,
  sellerName: l.sellerName || undefined,
  sellerLocation: l.sellerLocation || undefined,
  seeded: false,
  dataSource: 'live',
  lastScrapedAt: now,
});

// Platforms where several sellers can list the same product at different prices (docs/MULTI_SELLER_PLAN.md).
// A different seller is allowed to attach as another offer; only the SAME seller's own listing (a
// re-scrape) still counts as "already have this store". Everywhere else, one listing per store stands.
const MULTI_SELLER_PLATFORMS = new Set(['daraz']);

// listings: normalized scraper output. Returns
//   { productIds, productIdByListing, listingCount }
// where productIdByListing[i] is the product of listings[i] (so callers can keep the stores' own order).
async function ingestListings(listings) {
  const now = new Date();
  const items = [];
  const seenInput = new Set();
  for (const l of listings) {
    if (seenInput.has(keyOf(l))) continue;
    seenInput.add(keyOf(l));
    items.push(l);
  }
  if (!items.length) return { productIds: [], productIdByListing: [], listingCount: 0 };

  // 1. listings that are already stored keep their product
  const platforms = [...new Set(items.map((l) => l.platform))];
  const existingDocs = await Listing.find({
    $or: platforms.map((p) => ({ platform: p, externalId: { $in: items.filter((l) => l.platform === p).map((l) => l.externalId) } })),
  }).lean();
  const existing = new Map(existingDocs.map((d) => [keyOf(d), d]));
  const fresh = items.filter((l) => !existing.has(keyOf(l)));

  const resolved = new Map(); // listing key -> product id (string)
  for (const l of items) if (existing.has(keyOf(l))) resolved.set(keyOf(l), String(existing.get(keyOf(l)).productId));

  // 2. candidate products for the new listings: same match key, or same brand (one query each)
  const analyzed = new Map(fresh.map((l) => [keyOf(l), analyzeTitle(l.title)]));
  const matchKeys = [...new Set([...analyzed.values()].map((a) => a.key))];
  const brands = [...new Set([...analyzed.values()].map((a) => a.brand).filter(Boolean))];
  const [exactProducts, ...brandGroups] = await Promise.all([
    matchKeys.length ? Product.find({ matchKey: { $in: matchKeys } }).select('title brand matchKey').lean() : [],
    ...brands.map((b) => Product.find({ brand: new RegExp(`^${escapeRegex(b)}$`, 'i') }).select('title brand matchKey').limit(600).lean()),
  ]);

  const products = new Map(); // id -> { _id, title, brand, matchKey, analyzed }
  const byKey = new Map();
  const byBrand = new Map();
  const register = (p) => {
    const id = String(p._id);
    if (products.has(id)) return;
    const entry = { _id: id, title: p.title, brand: p.brand, matchKey: p.matchKey, analyzed: analyzeTitle(p.title) };
    products.set(id, entry);
    if (p.matchKey) byKey.set(p.matchKey, id);
    const b = (p.brand || '_').toLowerCase();
    if (!byBrand.has(b)) byBrand.set(b, []);
    byBrand.get(b).push(id);
  };
  [...exactProducts, ...brandGroups.flat()].forEach(register);

  // the listings those candidates already have (to enforce "one listing per store per product", except
  // where several sellers can legitimately share a store - MULTI_SELLER_PLATFORMS)
  const listingsByProduct = new Map();
  if (products.size) {
    const have = await Listing.find({ productId: { $in: [...products.keys()] } }).select('productId platform externalId seeded').lean();
    for (const h of have) {
      const k = String(h.productId);
      if (!listingsByProduct.has(k)) listingsByProduct.set(k, []);
      listingsByProduct.get(k).push({ platform: h.platform, externalId: h.externalId, seeded: Boolean(h.seeded), _id: h._id });
    }
  }
  const sameStoreTaken = (pid, platform, externalId) => {
    const have = listingsByProduct.get(pid) || [];
    if (MULTI_SELLER_PLATFORMS.has(platform)) {
      return have.some((x) => x.platform === platform && !x.seeded && x.externalId === externalId);
    }
    return have.some((x) => x.platform === platform && !x.seeded);
  };

  // 3. decide the product of every new listing, in memory
  const newProducts = [];
  const adopt = new Map(); // listing key -> seeded listing id it takes over (keeps the sample price history)
  for (const l of fresh) {
    const a = analyzed.get(keyOf(l));
    let pid = null;
    const exactId = byKey.get(a.key);
    if (exactId && !sameStoreTaken(exactId, l.platform, l.externalId)) pid = exactId;
    if (!pid) {
      const pool = (byBrand.get((a.brand || '_').toLowerCase()) || []).filter((id) => !sameStoreTaken(id, l.platform, l.externalId));
      const best = findBestMatch(a, pool.map((id) => products.get(id)));
      if (best) pid = best.candidate._id;
    }
    if (pid) {
      const seeded = (listingsByProduct.get(pid) || []).find((x) => x.platform === l.platform && x.seeded && !x.taken);
      if (seeded) {
        seeded.taken = true;
        adopt.set(keyOf(l), seeded._id);
      }
    } else {
      const id = String(new mongoose.Types.ObjectId());
      const title = cleanTitle(l.title);
      const brand = capitalize(a.brand || l.brand || '') || undefined;
      // two different listings can normalise to the same key; the key must stay unique
      const matchKey = byKey.has(a.key) ? `${a.key}~${l.platform}~${l.externalId}` : a.key;
      newProducts.push({ _id: id, title, matchKey, brand, category: classify(l.title, l.category) || undefined, searchKey: searchKeyOf(brand, title), image: l.image || undefined });
      register({ _id: id, title, brand, matchKey });
      pid = id;
    }
    if (!listingsByProduct.has(pid)) listingsByProduct.set(pid, []);
    listingsByProduct.get(pid).push({ platform: l.platform, externalId: l.externalId, seeded: false });
    resolved.set(keyOf(l), pid);
  }

  // 4. write: new products, then every listing in one bulk write
  if (newProducts.length) {
    try {
      await Product.insertMany(newProducts, { ordered: false });
    } catch (err) {
      if (err.code !== 11000 && !(err.writeErrors && err.writeErrors.every((e) => e.code === 11000))) throw err;
      // another request created the same key meanwhile: use the stored product instead
      const stored = await Product.find({ matchKey: { $in: newProducts.map((p) => p.matchKey) } }).select('matchKey').lean();
      const idOfKey = new Map(stored.map((s) => [s.matchKey, String(s._id)]));
      for (const p of newProducts) {
        const real = idOfKey.get(p.matchKey);
        if (real && real !== p._id) for (const [k, v] of resolved) if (v === p._id) resolved.set(k, real);
      }
    }
  }

  const ops = items.map((l) => {
    const k = keyOf(l);
    const fields = listingFields(l, now);
    if (existing.has(k)) return { updateOne: { filter: { _id: existing.get(k)._id }, update: { $set: fields } } };
    if (adopt.has(k)) return { updateOne: { filter: { _id: adopt.get(k) }, update: { $set: { ...fields, productId: resolved.get(k), externalId: l.externalId } } } };
    return { updateOne: { filter: { platform: l.platform, externalId: l.externalId }, update: { $set: { ...fields, productId: resolved.get(k) } }, upsert: true } };
  });
  await Listing.bulkWrite(ops, { ordered: false });

  // 5. price history: a point for every new listing, and for stored ones whose price changed (or is stale)
  const stored = await Listing.find({ $or: platforms.map((p) => ({ platform: p, externalId: { $in: items.filter((l) => l.platform === p).map((l) => l.externalId) } })) })
    .select('platform externalId productId')
    .lean();
  const storedByKey = new Map(stored.map((d) => [keyOf(d), d]));
  const lastPoints = await PriceHistory.aggregate([
    { $match: { listingId: { $in: stored.map((d) => d._id) } } },
    { $sort: { scrapedAt: -1 } },
    { $group: { _id: '$listingId', price: { $first: '$price' }, at: { $first: '$scrapedAt' } } },
  ]);
  const lastOf = new Map(lastPoints.map((p) => [String(p._id), p]));
  const points = [];
  for (const l of items) {
    const doc = storedByKey.get(keyOf(l));
    if (!doc) continue;
    const last = lastOf.get(String(doc._id));
    if (!last || last.price !== l.price || now - last.at > HISTORY_MIN_GAP_MS) {
      points.push({ listingId: doc._id, productId: doc.productId, platform: l.platform, price: l.price, scrapedAt: now });
    }
  }
  if (points.length) await PriceHistory.insertMany(points, { ordered: false });

  // 6. denormalized product fields, in bulk
  const touched = [...new Set(items.map((l) => (storedByKey.get(keyOf(l)) ? String(storedByKey.get(keyOf(l)).productId) : resolved.get(keyOf(l)))))];
  await refreshProductsStats(touched);

  const productIdByListing = listings.map((l) => (storedByKey.get(keyOf(l)) ? String(storedByKey.get(keyOf(l)).productId) : resolved.get(keyOf(l))));
  return { productIds: touched, productIdByListing, listingCount: items.length };
}

module.exports = { ingestListings, cleanTitle, appendHistory };

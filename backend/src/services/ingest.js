// Turns scraped listings into stored data: group into products (title normalization + fuzzy match),
// upsert listings, append price-history points, refresh product stats.
const { Product, Listing, PriceHistory } = require('../models');
const { analyzeTitle, findBestMatch, searchKeyOf } = require('./matching');
const { refreshProductStats } = require('./productStats');
const { classify } = require('./categories');

const HISTORY_MIN_GAP_MS = 12 * 60 * 60 * 1000;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// Find the product a listing belongs to (exact key, then fuzzy among same-brand/similar products).
async function findProduct(listing, analyzed, cache) {
  const exact = await Product.findOne({ matchKey: analyzed.key });
  if (exact) return exact;

  let candidates;
  if (analyzed.brand) {
    candidates = await Product.find({ brand: new RegExp(`^${escapeRegex(analyzed.brand)}$`, 'i') }).limit(300).lean();
  } else {
    candidates = await Product.find({ $text: { $search: analyzed.tokens.join(' ') } }).limit(100).lean();
  }
  const withAnalysis = candidates.map((c) => {
    if (!cache.has(String(c._id))) cache.set(String(c._id), analyzeTitle(c.title));
    return { ...c, analyzed: cache.get(String(c._id)) };
  });
  const best = findBestMatch(analyzed, withAnalysis);
  return best ? Product.findById(best.candidate._id) : null;
}

async function createProduct(listing, analyzed) {
  try {
    return await Product.findOneAndUpdate(
      { matchKey: analyzed.key },
      {
        $setOnInsert: {
          title: cleanTitle(listing.title),
          matchKey: analyzed.key,
          brand: capitalize(analyzed.brand || listing.brand || '') || undefined,
          category: classify(listing.title, listing.category) || undefined,
          searchKey: searchKeyOf(capitalize(analyzed.brand || listing.brand || ''), cleanTitle(listing.title)),
          image: listing.image || undefined,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    if (err.code === 11000) return Product.findOne({ matchKey: analyzed.key });
    throw err;
  }
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

async function saveListing(product, l, now) {
  const fields = {
    productId: product._id,
    title: l.title,
    url: l.url,
    image: l.image || undefined,
    price: l.price,
    originalPrice: l.originalPrice || undefined,
    currency: l.currency || 'PKR',
    rating: l.rating || undefined,
    reviewCount: l.reviewCount || 0,
    inStock: l.inStock !== false,
    seeded: false,
    dataSource: 'live',
    lastScrapedAt: now,
  };

  let doc = await Listing.findOne({ platform: l.platform, externalId: l.externalId });
  if (!doc) {
    // Adopt a sample (seeded) listing for the same product + platform so its price history is kept.
    doc = await Listing.findOne({ productId: product._id, platform: l.platform, seeded: true });
    if (doc) doc.externalId = l.externalId;
  }
  if (!doc) doc = new Listing({ platform: l.platform, externalId: l.externalId });
  const isNew = doc.isNew;
  Object.assign(doc, fields);
  await doc.save();

  await appendHistory(doc, l.price, now, { force: isNew });
  return doc;
}

// listings: normalized scraper output. Returns { productIds, listingCount }.
async function ingestListings(listings) {
  const now = new Date();
  const analysisCache = new Map();
  const touched = new Set();
  let count = 0;

  for (const l of listings) {
    const analyzed = analyzeTitle(l.title);
    // eslint-disable-next-line no-await-in-loop
    let product = await findProduct(l, analyzed, analysisCache);
    // eslint-disable-next-line no-await-in-loop
    if (!product) product = await createProduct(l, analyzed);
    // eslint-disable-next-line no-await-in-loop
    await saveListing(product, l, now);
    touched.add(String(product._id));
    count += 1;
  }
  for (const id of touched) {
    // eslint-disable-next-line no-await-in-loop
    await refreshProductStats(id);
  }
  return { productIds: [...touched], listingCount: count };
}

module.exports = { ingestListings, cleanTitle, appendHistory };

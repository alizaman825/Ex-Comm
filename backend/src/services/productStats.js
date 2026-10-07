const { Product, Listing, PriceHistory } = require('../models');
const { searchKeyOf } = require('./matching');

const DAY = 24 * 60 * 60 * 1000;

const isSupplier = (l) => l.role === 'supplier';

const MAX_ALT_TITLES = 12;
// Distinct listing titles, so a product can be found by any name a store gives it.
const altTitlesOf = (listings) => [...new Set(listings.map((l) => l.title))].slice(0, MAX_ALT_TITLES);

// In-stock listings if there are any, otherwise all of them (so an out-of-stock product still shows a price).
const preferInStock = (list) => {
  const inStock = list.filter((l) => l.inStock);
  return inStock.length ? inStock : list;
};

// Pure: the denormalized product fields for one product, from its listings.
// `pastPrice` maps listingId -> that listing's latest price as of 7 days ago.
//
// The headline price (minPrice / maxPrice / lowestPlatform / priceChange7d) is the *retail* price a shopper
// pays locally (Daraz, PriceOye). The supplier price (AliExpress, before shipping and customs) is kept
// separately in supplierMinPrice, and only becomes the headline for products with no retail listing.
function computeStats(product, listings, pastPrice) {
  if (!listings.length) {
    return { listingCount: 0, platforms: [], minPrice: null, maxPrice: null, retailMinPrice: null, supplierMinPrice: null, altTitles: [] };
  }
  const retail = listings.filter((l) => !isSupplier(l));
  const supplier = listings.filter(isSupplier);
  const headline = preferInStock(retail.length ? retail : supplier);
  const retailPool = retail.length ? preferInStock(retail) : [];
  const supplierPool = supplier.length ? preferInStock(supplier) : [];

  const cheapest = headline.reduce((a, b) => (b.price < a.price ? b : a));
  const prices = headline.map((l) => l.price);
  const minPrice = Math.min(...prices);

  const rated = listings.filter((l) => l.rating);
  const weight = (l) => Math.max(l.reviewCount || 1, 1);
  const rating = rated.length ? Math.round((rated.reduce((s, l) => s + l.rating * weight(l), 0) / rated.reduce((s, l) => s + weight(l), 0)) * 10) / 10 : null;

  const past = headline.map((l) => pastPrice.get(String(l._id))).filter((p) => p !== undefined);
  const pastMin = past.length ? Math.min(...past) : null;
  const altTitles = altTitlesOf(listings);
  const fields = {
    minPrice,
    maxPrice: Math.max(...prices),
    retailMinPrice: retailPool.length ? Math.min(...retailPool.map((l) => l.price)) : null,
    supplierMinPrice: supplierPool.length ? Math.min(...supplierPool.map((l) => l.price)) : null,
    lowestPlatform: cheapest.platform,
    platforms: [...new Set(listings.map((l) => l.platform))].sort(),
    listingCount: listings.length,
    rating,
    reviewCount: listings.reduce((s, l) => s + (l.reviewCount || 0), 0),
    priceChange7d: pastMin ? Math.round(((minPrice - pastMin) / pastMin) * 1000) / 10 : 0,
    altTitles,
    searchKey: searchKeyOf(product.brand, product.title, ...altTitles),
  };
  if (!product.image) {
    const image = listings.find((l) => l.image)?.image;
    if (image) fields.image = image;
  }
  return fields;
}

// Recompute the denormalized fields of many products with a fixed number of queries (listings, history,
// products, one bulk write), however many products there are.
async function refreshProductsStats(productIds) {
  const ids = [...new Set(productIds.map(String))];
  if (!ids.length) return;
  const [listings, products] = await Promise.all([
    Listing.find({ productId: { $in: ids } }).lean(),
    Product.find({ _id: { $in: ids } }).select('brand title image').lean(),
  ]);
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const past = await PriceHistory.aggregate([
    { $match: { listingId: { $in: listings.map((l) => l._id) }, scrapedAt: { $lte: weekAgo } } },
    { $sort: { scrapedAt: -1 } },
    { $group: { _id: '$listingId', price: { $first: '$price' } } },
  ]);
  const pastPrice = new Map(past.map((p) => [String(p._id), p.price]));
  const byProduct = new Map();
  for (const l of listings) {
    const k = String(l.productId);
    if (!byProduct.has(k)) byProduct.set(k, []);
    byProduct.get(k).push(l);
  }
  const ops = products.map((p) => ({
    updateOne: { filter: { _id: p._id }, update: { $set: computeStats(p, byProduct.get(String(p._id)) || [], pastPrice) } },
  }));
  if (ops.length) await Product.bulkWrite(ops, { ordered: false });
}

const refreshProductStats = (productId) => refreshProductsStats([productId]);

// Adds alt titles and the compact search key to products stored before they existed (cheap, runs at startup).
async function backfillSearchKeys() {
  const missing = await Product.find({ altTitles: { $exists: false } }).select('title brand').lean();
  if (!missing.length) return 0;
  const grouped = await Listing.aggregate([
    { $match: { productId: { $in: missing.map((p) => p._id) } } },
    { $group: { _id: '$productId', titles: { $addToSet: '$title' } } },
  ]);
  const titlesOf = new Map(grouped.map((g) => [String(g._id), g.titles.slice(0, MAX_ALT_TITLES)]));
  await Product.bulkWrite(
    missing.map((p) => {
      const altTitles = titlesOf.get(String(p._id)) || [];
      return { updateOne: { filter: { _id: p._id }, update: { $set: { altTitles, searchKey: searchKeyOf(p.brand, p.title, ...altTitles) } } } };
    })
  );
  return missing.length;
}

module.exports = { computeStats, refreshProductStats, refreshProductsStats, backfillSearchKeys };

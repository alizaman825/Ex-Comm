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

// Recompute denormalized product fields (prices, platforms, rating, 7-day change) from its listings.
//
// The headline price (minPrice / maxPrice / lowestPlatform / priceChange7d) is the *retail* price a shopper
// pays locally (Daraz, PriceOye). The supplier price (AliExpress, before shipping and customs) is kept
// separately in supplierMinPrice, and only becomes the headline for products with no retail listing.
async function refreshProductStats(productId) {
  const listings = await Listing.find({ productId }).lean();
  if (!listings.length) {
    await Product.updateOne({ _id: productId }, { listingCount: 0, platforms: [], minPrice: null, maxPrice: null, retailMinPrice: null, supplierMinPrice: null });
    return;
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
  const reviewCount = listings.reduce((s, l) => s + (l.reviewCount || 0), 0);

  // Each headline listing's latest price as of 7 days ago, compared with today's minimum.
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const past = await PriceHistory.aggregate([
    { $match: { listingId: { $in: headline.map((l) => l._id) }, scrapedAt: { $lte: weekAgo } } },
    { $sort: { scrapedAt: -1 } },
    { $group: { _id: '$listingId', price: { $first: '$price' } } },
  ]);
  const pastMin = past.length ? Math.min(...past.map((p) => p.price)) : null;
  const priceChange7d = pastMin ? Math.round(((minPrice - pastMin) / pastMin) * 1000) / 10 : 0;

  const product = await Product.findById(productId);
  if (!product) return;
  Object.assign(product, {
    minPrice,
    maxPrice: Math.max(...prices),
    retailMinPrice: retailPool.length ? Math.min(...retailPool.map((l) => l.price)) : null,
    supplierMinPrice: supplierPool.length ? Math.min(...supplierPool.map((l) => l.price)) : null,
    lowestPlatform: cheapest.platform,
    platforms: [...new Set(listings.map((l) => l.platform))].sort(),
    listingCount: listings.length,
    rating,
    reviewCount,
    priceChange7d,
    altTitles: altTitlesOf(listings),
  });
  product.searchKey = searchKeyOf(product.brand, product.title, ...product.altTitles);
  if (!product.image) product.image = listings.find((l) => l.image)?.image;
  await product.save();
}

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

module.exports = { refreshProductStats, backfillSearchKeys };

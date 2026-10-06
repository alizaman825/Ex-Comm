const { Product, Listing, PriceHistory } = require('../models');

const DAY = 24 * 60 * 60 * 1000;

// Recompute denormalized product fields (min/max price, platforms, rating, 7-day change) from its listings.
async function refreshProductStats(productId) {
  const listings = await Listing.find({ productId }).lean();
  const inStock = listings.filter((l) => l.inStock);
  const priced = inStock.length ? inStock : listings;
  if (!priced.length) {
    await Product.updateOne({ _id: productId }, { listingCount: 0, platforms: [], minPrice: null, maxPrice: null });
    return;
  }

  const cheapest = priced.reduce((a, b) => (b.price < a.price ? b : a));
  const prices = priced.map((l) => l.price);
  const rated = listings.filter((l) => l.rating);
  const reviewCount = listings.reduce((s, l) => s + (l.reviewCount || 0), 0);
  const rating = rated.length
    ? Math.round((rated.reduce((s, l) => s + l.rating * Math.max(l.reviewCount || 1, 1), 0) /
        rated.reduce((s, l) => s + Math.max(l.reviewCount || 1, 1), 0)) * 10) / 10
    : null;

  // Lowest price per listing as of 7 days ago, compared with today's minimum.
  const weekAgo = new Date(Date.now() - 7 * DAY);
  const past = await PriceHistory.aggregate([
    { $match: { productId: cheapest.productId, scrapedAt: { $lte: weekAgo } } },
    { $sort: { scrapedAt: -1 } },
    { $group: { _id: '$listingId', price: { $first: '$price' } } },
  ]);
  const pastMin = past.length ? Math.min(...past.map((p) => p.price)) : null;
  const minPrice = Math.min(...prices);
  const priceChange7d = pastMin ? Math.round(((minPrice - pastMin) / pastMin) * 1000) / 10 : 0;

  const product = await Product.findById(productId);
  if (!product) return;
  Object.assign(product, {
    minPrice,
    maxPrice: Math.max(...prices),
    lowestPlatform: cheapest.platform,
    platforms: [...new Set(listings.map((l) => l.platform))].sort(),
    listingCount: listings.length,
    rating,
    reviewCount,
    priceChange7d,
  });
  if (!product.image) product.image = listings.find((l) => l.image)?.image;
  await product.save();
}

module.exports = { refreshProductStats };

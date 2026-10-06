const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

// A product groups listings of the same item across platforms (see services/matching.js).
const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    matchKey: { type: String, required: true, unique: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true, index: true },
    image: String,
    // Denormalized from listings by services/productStats.js
    minPrice: Number,
    maxPrice: Number,
    retailMinPrice: Number, // cheapest Daraz/PriceOye listing
    supplierMinPrice: Number, // cheapest AliExpress listing (PKR)
    lowestPlatform: { type: String, enum: [...PLATFORMS, null] },
    platforms: [{ type: String, enum: PLATFORMS }],
    listingCount: { type: Number, default: 0 },
    rating: Number,
    reviewCount: { type: Number, default: 0 },
    priceChange7d: { type: Number, default: 0 }, // % change of minPrice vs 7 days ago (negative = drop)
    popularity: { type: Number, default: 0 }, // wishlists + alerts + search hits
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', brand: 'text', category: 'text' }, { weights: { title: 5, brand: 3, category: 1 } });
productSchema.index({ minPrice: 1 });
productSchema.index({ popularity: -1 });
productSchema.plugin(toJSON);

module.exports = mongoose.model('Product', productSchema);

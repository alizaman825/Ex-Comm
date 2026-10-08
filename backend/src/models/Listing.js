const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

// One product offer on one platform.
const listingSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    role: { type: String, enum: ['retail', 'supplier'], default: 'retail' }, // aliexpress = supplier
    platform: { type: String, enum: PLATFORMS, required: true },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    image: String,
    price: { type: Number, required: true, min: 0 },
    originalPrice: Number,
    priceUsd: Number, // supplier listings keep the original USD price
    currency: { type: String, default: 'PKR' },
    rating: Number,
    reviewCount: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    seeded: { type: Boolean, default: false }, // true = sample data, not scraped
    dataSource: { type: String, enum: ['live', 'saved'], default: 'live' }, // shown as a badge in the UI
    lastScrapedAt: Date,
    // Marketplace platforms (Daraz, and eBay once confirmed) can have several sellers listing the same
    // product at different prices - see docs/MULTI_SELLER_PLAN.md. Unset on platforms with one seller.
    sellerId: String,
    sellerName: String,
    sellerLocation: String,
  },
  { timestamps: true }
);

listingSchema.index({ platform: 1, externalId: 1 }, { unique: true });
listingSchema.plugin(toJSON);

module.exports = mongoose.model('Listing', listingSchema);

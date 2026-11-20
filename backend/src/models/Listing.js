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
    // Set (without touching price/inStock/etc) when a re-check attempt failed after lastScrapedAt, so
    // price-status can show "check failed" instead of silently keeping the old data under a "Live" badge.
    // See services/priceStatus.js.
    lastCheckFailedAt: Date,
    // Marketplace platforms (Daraz, and eBay once confirmed) can have several sellers listing the same
    // product at different prices - see docs/MULTI_SELLER_PLAN.md. Unset on platforms with one seller.
    sellerId: String,
    sellerName: String,
    sellerLocation: String,
    // Set on eBay listings (Browse API returns item condition for every result). Other platforms leave
    // this at the default: PriceOye/Daraz only list new items, so there is nothing to flag there.
    condition: { type: String, enum: ['new', 'refurbished', 'used', 'unknown'], default: 'unknown' },
    conditionLabel: String, // eBay's own wording ("Seller refurbished", "For parts or not working", ...)
    // True when the listed price is the cheapest of several buyer-selectable variations (size/colour/...),
    // so the actual checkout price can be higher than what is shown here.
    multiVariant: { type: Boolean, default: false },
  },
  { timestamps: true }
);

listingSchema.index({ platform: 1, externalId: 1 }, { unique: true });
listingSchema.plugin(toJSON);

module.exports = mongoose.model('Listing', listingSchema);

const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

// One product offer on one platform.
const listingSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    externalId: { type: String, required: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    image: String,
    price: { type: Number, required: true, min: 0 },
    originalPrice: Number,
    currency: { type: String, default: 'PKR' },
    rating: Number,
    reviewCount: { type: Number, default: 0 },
    inStock: { type: Boolean, default: true },
    seeded: { type: Boolean, default: false }, // true = sample data, not scraped
    lastScrapedAt: Date,
  },
  { timestamps: true }
);

listingSchema.index({ platform: 1, externalId: 1 }, { unique: true });
listingSchema.plugin(toJSON);

module.exports = mongoose.model('Listing', listingSchema);

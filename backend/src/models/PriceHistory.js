const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

const priceHistorySchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  platform: { type: String, enum: PLATFORMS, required: true },
  price: { type: Number, required: true },
  scrapedAt: { type: Date, required: true, default: Date.now },
  // 'real' = a genuine scrape (live search or a scheduled job); 'simulated' = simulate mode's fabricated
  // demo move; 'unverified' = a point written before this field existed, with no proof either way (see
  // config.priceHistory.verifiedCutoff). Charts, deals, "lowest price" and alerts must only trust 'real'.
  source: { type: String, enum: ['real', 'simulated', 'unverified'], default: 'unverified' },
});

priceHistorySchema.index({ listingId: 1, scrapedAt: -1 });
priceHistorySchema.index({ productId: 1, scrapedAt: -1 });
priceHistorySchema.plugin(toJSON);

module.exports = mongoose.model('PriceHistory', priceHistorySchema, 'pricehistory');

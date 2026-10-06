const mongoose = require('mongoose');
const { toJSON, PLATFORMS } = require('./plugins');

const scrapeLogSchema = new mongoose.Schema(
  {
    platform: { type: String, enum: PLATFORMS, required: true },
    query: String,
    kind: { type: String, enum: ['search', 'price-check'], default: 'search' },
    status: { type: String, enum: ['success', 'partial', 'failed', 'skipped'], required: true },
    itemCount: { type: Number, default: 0 },
    durationMs: Number,
    error: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

scrapeLogSchema.index({ platform: 1, createdAt: -1 });
scrapeLogSchema.plugin(toJSON);

module.exports = mongoose.model('ScrapeLog', scrapeLogSchema);

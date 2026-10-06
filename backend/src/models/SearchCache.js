const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const searchCacheSchema = new mongoose.Schema({
  queryKey: { type: String, required: true, unique: true },
  query: String,
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  source: { type: String, enum: ['live', 'cache', 'fallback'] },
  // e.g. { daraz: { status: 'success', count: 40, ms: 900 }, priceoye: { status: 'failed', error: 'timeout' } }
  platformStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
  fetchedAt: { type: Date, required: true, default: Date.now },
});

searchCacheSchema.plugin(toJSON);

module.exports = mongoose.model('SearchCache', searchCacheSchema);

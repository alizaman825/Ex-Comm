const mongoose = require('mongoose');
const { toJSON } = require('./plugins');

const searchCacheSchema = new mongoose.Schema({
  queryKey: { type: String, required: true, unique: true },
  query: String,
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  source: { type: String, enum: ['live', 'cache', 'fallback'] },
  // e.g. { daraz: { status: 'success', count: 40, ms: 900 }, priceoye: { status: 'failed', error: 'timeout' } }
  platformStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Live searches: how far into each store's results we have loaded, e.g.
  // { daraz: { nextPage: 3, loaded: 80, total: 4063, pageSize: 40, exhausted: false, status: 'success' } }
  platformState: mongoose.Schema.Types.Mixed,
  hits: { type: Number, default: 0 }, // times searched; drives trending searches
  lastSearchedAt: Date,
  fetchedAt: { type: Date, required: true, default: Date.now },
});

searchCacheSchema.plugin(toJSON);

module.exports = mongoose.model('SearchCache', searchCacheSchema);

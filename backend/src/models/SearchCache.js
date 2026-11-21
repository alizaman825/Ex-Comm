const mongoose = require('mongoose');
const { toJSON } = require('./plugins');
const { config } = require('../config/env');

const searchCacheSchema = new mongoose.Schema({
  queryKey: { type: String, required: true, unique: true },
  query: String,
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  // Subset of productIds whose matching listing passed relevance.js's strict isRelevant() check (PLAN.md
  // item 4). The rest (same products, loose/ranking-only matches) are shown collapsed as "Other models".
  relevantProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  source: { type: String, enum: ['live', 'cache', 'fallback'] },
  // e.g. { daraz: { status: 'success', count: 40, ms: 900 }, priceoye: { status: 'failed', error: 'timeout' } }
  platformStatus: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Live searches: how far into each store's results we have loaded, e.g.
  // { daraz: { nextPage: 3, loaded: 80, total: 4063, pageSize: 40, exhausted: false, status: 'success' } }
  platformState: mongoose.Schema.Types.Mixed,
  hits: { type: Number, default: 0 }, // times searched; drives trending searches
  lastSearchedAt: Date,
  // The largest `need` (limit) a live request has ever actually tried to satisfy for this query (Phase 3
  // Part B, 2026-11-21). Lets ensureLoaded tell a plain reload (same or smaller need than we've already
  // tried and come up short on - nothing more to find right now, serve the cache) apart from a genuine
  // "Show more" ask (a bigger need than we've ever pursued - worth a real, blocking attempt at more pages).
  // Without it, a narrow query (few real matches) reran a full live round-trip on every single reload.
  lastNeed: { type: Number, default: 0 },
  fetchedAt: { type: Date, required: true, default: Date.now },
});

// Phase 2 Part E (E5): this collection already IS the persistent (Mongo-backed) cache layer - it survives
// Render's free-tier spin-downs, unlike an in-memory cache would. This index just prunes entries nobody
// has searched in a long time (config.search.cacheRetentionDays), so the collection - and therefore every
// search's lookup - doesn't grow forever on a long-running deployment. An entry still inside its normal
// freshness/stale-while-revalidate window is always far younger than this and is never affected.
searchCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: config.search.cacheRetentionDays * 24 * 60 * 60 });
searchCacheSchema.plugin(toJSON);

module.exports = mongoose.model('SearchCache', searchCacheSchema);

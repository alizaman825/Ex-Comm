// PLAN.md item 1d: seeded/sample listings must never appear as real commercial data in production
// (public search, deals, trending, comparisons, product pages). Gated to production only so local dev
// and the documented demo flow (CLAUDE.md: `npm run seed`, demo login) still show the seed catalog -
// the live site is the only place this must be enforced.
const { config } = require('../config/env');

// Merge into a Mongoose filter for any Listing query that feeds a public-facing response.
function excludeSeededInProd(filter = {}) {
  return config.isProd ? { ...filter, seeded: { $ne: true } } : filter;
}

// PLAN.md item 1: a 'cheapest'/7-day-change/history calculation must only trust source: 'real'
// PriceHistory points in production. The seed catalog's history is honestly simulated (seed/seed.js
// generates a plausible series around a real anchor price - it was never a real time series), so in
// development/test/demo it's left untouched rather than filtered to nothing, the same non-prod carve-out
// excludeSeededInProd already gives seeded listings.
function realHistoryFilter(filter = {}) {
  return config.isProd ? { ...filter, source: 'real' } : filter;
}

// A listing counts toward a product's headline price ("cheapest", deals, alerts) when it's been checked
// recently enough to trust (services/priceStatus.js), OR - outside production only - when it's seeded
// demo/test data, which is never continuously re-scraped and so would otherwise always read as stale.
function isHeadlineEligible(listing, isTrustworthy, now) {
  return isTrustworthy(listing, now) || (!config.isProd && Boolean(listing.seeded));
}

// A listing not re-checked in over config.listingMaxAgeDays never appears in public results, cheapest,
// deals or alerts in production (owner decision, 2026-11-20) - it stays in the database and reappears
// once refreshed. Same non-prod carve-out as the rest of this file: the seed catalog is never
// continuously re-scraped, so this would otherwise hide it entirely outside production.
function excludeStaleInProd(filter = {}) {
  if (!config.isProd) return filter;
  const cutoff = new Date(Date.now() - config.listingMaxAgeDays * 24 * 60 * 60 * 1000);
  return { ...filter, $or: [{ lastScrapedAt: { $exists: false } }, { lastScrapedAt: { $gte: cutoff } }] };
}

module.exports = { excludeSeededInProd, realHistoryFilter, isHeadlineEligible, excludeStaleInProd };

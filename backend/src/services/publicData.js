// PLAN.md item 1d: seeded/sample listings must never appear as real commercial data in production
// (public search, deals, trending, comparisons, product pages). Gated to production only so local dev
// and the documented demo flow (CLAUDE.md: `npm run seed`, demo login) still show the seed catalog -
// the live site is the only place this must be enforced.
const { config } = require('../config/env');

// Merge into a Mongoose filter for any Listing query that feeds a public-facing response.
function excludeSeededInProd(filter = {}) {
  return config.isProd ? { ...filter, seeded: { $ne: true } } : filter;
}

module.exports = { excludeSeededInProd };

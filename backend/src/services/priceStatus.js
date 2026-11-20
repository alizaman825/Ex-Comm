// Price status (Phase 1, PLAN.md item 3): what a shopper should be told about how fresh a listing's
// price is, instead of a "Live" badge that never resets. Six states:
//  - saved_reference: AliExpress only (owner decision, 2026-11-20) - it's a kept reference price, never
//    "checked recently" no matter how fresh, and never eligible for cheapest/deals/alerts.
//  - checked_recently: scraped within that platform's recentHours window, in stock, no later failure.
//  - stale: scraped, but longer ago than recentHours (within staleHours).
//  - unavailable: last check found it out of stock.
//  - check_failed: a re-check attempted after the last successful scrape failed (lastCheckFailedAt is
//    newer than lastScrapedAt). The failed check itself never touched price/inStock - see jobs/priceCheck.js.
//  - unknown: never scraped, or scraped so long ago (beyond staleHours) that it is not worth calling "stale".
const { config } = require('../config/env');

const STATUSES = ['saved_reference', 'checked_recently', 'stale', 'unavailable', 'check_failed', 'unknown'];

const windowFor = (platform) => config.priceStatus.windows[platform] || config.priceStatus.default;

function statusOf(listing, now = Date.now()) {
  if (listing.platform === 'aliexpress') return 'saved_reference';
  const checkedAt = listing.lastScrapedAt ? new Date(listing.lastScrapedAt).getTime() : null;
  const failedAt = listing.lastCheckFailedAt ? new Date(listing.lastCheckFailedAt).getTime() : null;
  if (!checkedAt) return 'unknown';
  if (failedAt && failedAt > checkedAt) return 'check_failed';
  if (listing.inStock === false) return 'unavailable';
  const ageHours = (now - checkedAt) / (60 * 60 * 1000);
  const { recentHours, staleHours } = windowFor(listing.platform);
  if (ageHours <= recentHours) return 'checked_recently';
  if (ageHours <= staleHours) return 'stale';
  return 'unknown';
}

// Only a listing currently in this state is trustworthy enough to be called "cheapest", feed a deal, or
// trigger a price alert (PLAN.md item 3: "Stale, failed and unknown listings are excluded from cheapest,
// deals and alerts.", extended 2026-11-20 to make AliExpress's saved_reference never trustworthy either).
const isTrustworthy = (listing, now = Date.now()) => statusOf(listing, now) === 'checked_recently';

// A listing older than config.listingMaxAgeDays is never shown in public results, cheapest, deals or
// alerts (owner decision, 2026-11-20) - it stays in the database and reappears once refreshed. Checked
// separately from isTrustworthy because "too old to show at all" and "not fresh enough to call cheapest"
// are different thresholds (30 days vs. each store's staleHours).
function isTooOldToShow(listing, now = Date.now()) {
  if (!listing.lastScrapedAt) return false; // never-scraped is "unknown", not "too old" - different problem
  const ageDays = (now - new Date(listing.lastScrapedAt).getTime()) / (24 * 60 * 60 * 1000);
  return ageDays > config.listingMaxAgeDays;
}

module.exports = { STATUSES, statusOf, isTrustworthy, isTooOldToShow };

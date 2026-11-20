// Price status (Phase 1, PLAN.md item 3): what a shopper should be told about how fresh a listing's
// price is, instead of a "Live" badge that never resets. Five states:
//  - checked_recently: scraped within config.priceStatus.recentHours, in stock, no later failure.
//  - stale: scraped, but longer ago than recentHours (within staleHours).
//  - unavailable: last check found it out of stock.
//  - check_failed: a re-check attempted after the last successful scrape failed (lastCheckFailedAt is
//    newer than lastScrapedAt). The failed check itself never touched price/inStock - see jobs/priceCheck.js.
//  - unknown: never scraped, or scraped so long ago (beyond staleHours) that it is not worth calling "stale".
const { config } = require('../config/env');

const STATUSES = ['checked_recently', 'stale', 'unavailable', 'check_failed', 'unknown'];

function statusOf(listing, now = Date.now()) {
  const checkedAt = listing.lastScrapedAt ? new Date(listing.lastScrapedAt).getTime() : null;
  const failedAt = listing.lastCheckFailedAt ? new Date(listing.lastCheckFailedAt).getTime() : null;
  if (!checkedAt) return 'unknown';
  if (failedAt && failedAt > checkedAt) return 'check_failed';
  if (listing.inStock === false) return 'unavailable';
  const ageHours = (now - checkedAt) / (60 * 60 * 1000);
  if (ageHours <= config.priceStatus.recentHours) return 'checked_recently';
  if (ageHours <= config.priceStatus.staleHours) return 'stale';
  return 'unknown';
}

// Only a listing currently in this state is trustworthy enough to be called "cheapest", feed a deal, or
// trigger a price alert (PLAN.md item 3: "Stale, failed and unknown listings are excluded from cheapest,
// deals and alerts.").
const isTrustworthy = (listing, now = Date.now()) => statusOf(listing, now) === 'checked_recently';

module.exports = { STATUSES, statusOf, isTrustworthy };

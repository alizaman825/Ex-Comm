// Scheduled price check: re-scrape tracked products (wishlisted or with an active alert), store new
// prices in the history, then fire price alerts. Mode 'simulate' nudges stored prices instead of
// scraping, for demos without internet access.
const { Wishlist, Alert, Listing, JobRun } = require('../models');
const { config } = require('../config/env');
const scrapers = require('../scrapers');
const { appendHistory } = require('../services/ingest');
const { refreshProductStats } = require('../services/productStats');
const { evaluateProductAlerts } = require('../services/alerts');

let running = false;
const isRunning = () => running;

async function trackedProductIds() {
  const [wished, alerted] = await Promise.all([Wishlist.distinct('productId'), Alert.distinct('productId', { active: true })]);
  return [...new Set([...wished, ...alerted].map(String))];
}

// Demo mode: random price moves (mostly small drops) so alerts can be shown without scraping.
function simulatedPrice(price) {
  const roll = Math.random();
  const factor = roll < 0.65 ? 1 - (0.03 + Math.random() * 0.09) : 1 + Math.random() * 0.03;
  return Math.max(1, Math.round(factor * price));
}

async function checkListing(listing, mode, now, summary) {
  summary.listingsChecked += 1;

  if (mode === 'simulate') {
    const price = simulatedPrice(listing.price);
    if (price !== listing.price) {
      listing.price = price;
      listing.lastScrapedAt = now;
      await listing.save();
      await appendHistory(listing, price, now, { force: true });
      summary.pricesChanged += 1;
    }
    return;
  }

  const r = await scrapers.fetchCurrentListing(listing);
  if (r.status === 'skipped') {
    summary.skipped += 1;
    return;
  }
  if (r.status === 'unlinked') {
    summary.unlinked += 1;
    return;
  }
  if (r.status !== 'success') {
    summary.failures += 1;
    return;
  }
  if (!r.listing) {
    summary.notFound += 1; // the platform no longer shows a matching offer
    return;
  }
  const fresh = r.listing;
  const changed = fresh.price !== listing.price;
  Object.assign(listing, {
    price: fresh.price,
    originalPrice: fresh.originalPrice || undefined,
    rating: fresh.rating || listing.rating,
    reviewCount: fresh.reviewCount || listing.reviewCount,
    inStock: fresh.inStock !== false,
    lastScrapedAt: now,
    dataSource: 'live',
    seeded: false,
  });
  await listing.save();
  await appendHistory(listing, fresh.price, now, { force: changed });
  if (changed) summary.pricesChanged += 1;
}

// Returns { status, summary } or { status: 'skipped', reason } when another run is in progress.
async function runPriceCheck({ mode = 'live', trigger = 'schedule' } = {}) {
  if (running) return { status: 'skipped', reason: 'A price check is already running' };
  running = true;
  const startedAt = new Date();
  const summary = { products: 0, listingsChecked: 0, pricesChanged: 0, alertsTriggered: 0, failures: 0, skipped: 0, notFound: 0, unlinked: 0, truncated: false };
  let status = 'success';
  let error;

  try {
    const productIds = await trackedProductIds();
    summary.products = productIds.length;
    if (!productIds.length) {
      status = 'skipped';
      summary.note = 'No tracked products (no wishlists or active alerts)';
    } else {
      // Retail listings on platforms we can scrape; suppliers are saved data (live adapter arrives with T13).
      const platforms = mode === 'simulate' ? undefined : scrapers.livePlatforms();
      const filter = { productId: { $in: productIds }, role: { $ne: 'supplier' }, ...(platforms ? { platform: { $in: platforms } } : {}) };
      let listings = await Listing.find(filter).sort({ lastScrapedAt: 1 }); // stalest first
      if (mode === 'live') {
        // Only listings linked to a real store item can be re-fetched; sample data stays as it is.
        const linked = listings.filter((l) => scrapers.canRefetch(l));
        summary.unlinked = listings.length - linked.length;
        listings = linked;
      }
      if (listings.length > config.jobs.maxListingsPerRun) {
        listings = listings.slice(0, config.jobs.maxListingsPerRun);
        summary.truncated = true;
      }

      const touched = new Set();
      for (const listing of listings) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await checkListing(listing, mode, startedAt, summary);
          touched.add(String(listing.productId));
        } catch (err) {
          summary.failures += 1;
          console.error('Price check failed for a listing:', err.message);
        }
      }
      for (const id of touched) {
        // eslint-disable-next-line no-await-in-loop
        await refreshProductStats(id);
      }
      // Alerts are evaluated for every tracked product, even when scraping was skipped or failed.
      for (const id of productIds) {
        // eslint-disable-next-line no-await-in-loop
        summary.alertsTriggered += (await evaluateProductAlerts(id)).length;
      }
      const attempted = summary.listingsChecked - summary.skipped;
      if (!summary.listingsChecked && summary.unlinked) {
        status = 'skipped';
        summary.note = 'Tracked listings are sample data without a store link; use simulate mode for demos';
      } else if (summary.skipped && summary.skipped === summary.listingsChecked) status = 'skipped';
      else if (summary.failures && summary.failures >= attempted) status = 'failed';
      else if (summary.failures) status = 'partial';
    }
  } catch (err) {
    status = 'failed';
    error = err.message;
    console.error('Price check failed:', err);
  } finally {
    running = false;
  }

  const durationMs = Date.now() - startedAt.getTime();
  const run = await JobRun.create({ name: 'price-check', mode, trigger, status, startedAt, durationMs, summary, error });
  return { status, summary, durationMs, runId: String(run._id) };
}

module.exports = { runPriceCheck, isRunning, trackedProductIds };

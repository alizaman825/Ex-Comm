// Scraper registry: runs platform adapters through their polite queues and logs every attempt.
const mongoose = require('mongoose');
const { config } = require('../config/env');
const { PoliteQueue } = require('./politeQueue');
const { ScrapeLog } = require('../models');

const adapters = {
  daraz: require('./daraz'),
  priceoye: require('./priceoye'),
};

const queues = Object.fromEntries(Object.keys(adapters).map((name) => [name, new PoliteQueue(name)]));

function livePlatforms() {
  return config.scraper.livePlatforms.filter((p) => adapters[p]);
}

async function log(entry) {
  if (mongoose.connection.readyState !== 1) return; // e.g. CLI scripts without a DB
  try {
    await ScrapeLog.create(entry);
  } catch {
    /* logging must never break a scrape */
  }
}

// Scrape one platform. Never throws: returns { platform, status, listings, error, ms }.
async function scrapePlatform(platform, query, { kind = 'search', page = 1 } = {}) {
  const started = Date.now();
  if (config.demoMode) {
    return { platform, status: 'skipped', listings: [], error: 'Demo mode: live scraping disabled', ms: 0 };
  }
  const adapter = adapters[platform];
  if (!adapter) return { platform, status: 'skipped', listings: [], error: 'No live adapter', ms: 0 };

  try {
    const listings = await queues[platform].run(() => adapter.search(query, { page }));
    const ms = Date.now() - started;
    await log({ platform, query, kind, status: 'success', itemCount: listings.length, durationMs: ms });
    return { platform, status: 'success', listings, ms };
  } catch (err) {
    const ms = Date.now() - started;
    const status = err.code === 'CIRCUIT_OPEN' ? 'skipped' : 'failed';
    await log({ platform, query, kind, status, itemCount: 0, durationMs: ms, error: `${err.code || 'ERROR'}: ${err.message}` });
    return { platform, status, listings: [], error: err.message, code: err.code, ms };
  }
}

// Scrape several platforms in parallel (each platform still runs its own requests one at a time).
async function scrapeAll(query, platforms = livePlatforms(), opts) {
  const results = await Promise.all(platforms.map((p) => scrapePlatform(p, query, opts)));
  return Object.fromEntries(results.map((r) => [r.platform, r]));
}

// Price check: re-fetch one stored listing by its own store id / product URL (no searching, no fuzzy
// matching). Never throws: { platform, status, listing, error, ms } where status is
// success (listing is null when the store no longer shows the item), skipped, failed or unlinked.
async function fetchCurrentListing(listing) {
  const platform = listing.platform;
  const adapter = adapters[platform];
  const started = Date.now();
  if (config.demoMode) return { platform, status: 'skipped', listing: null, error: 'Demo mode: live scraping disabled', ms: 0 };
  if (!adapter || !adapter.canRefetch(listing)) {
    return { platform, status: 'unlinked', listing: null, error: 'Listing has no store link (sample data)', ms: 0 };
  }
  const query = listing.url || listing.externalId;
  try {
    const fresh = await queues[platform].run(() => adapter.fetchListing(listing));
    const ms = Date.now() - started;
    await log({ platform, query, kind: 'price-check', status: 'success', itemCount: fresh ? 1 : 0, durationMs: ms });
    return { platform, status: 'success', listing: fresh, ms };
  } catch (err) {
    const ms = Date.now() - started;
    const status = err.code === 'CIRCUIT_OPEN' ? 'skipped' : 'failed';
    await log({ platform, query, kind: 'price-check', status, itemCount: 0, durationMs: ms, error: `${err.code || 'ERROR'}: ${err.message}` });
    return { platform, status, listing: null, error: err.message, code: err.code, ms };
  }
}

// True when the stored listing points at a real store item that can be re-fetched.
function canRefetch(listing) {
  const adapter = adapters[listing.platform];
  return Boolean(adapter && adapter.canRefetch && adapter.canRefetch(listing));
}

// Closes the circuit breaker of the given stores so the next request is actually sent.
function closeCircuits(platforms = Object.keys(queues)) {
  for (const p of platforms) if (queues[p]) queues[p].closeCircuit();
}

function platformStatus() {
  return Object.values(queues).map((q) => q.status());
}

module.exports = { adapters, queues, livePlatforms, scrapePlatform, scrapeAll, fetchCurrentListing, canRefetch, closeCircuits, platformStatus };

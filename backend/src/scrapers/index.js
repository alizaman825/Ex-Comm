// Scraper registry: runs platform adapters through their polite queues and logs every attempt.
const mongoose = require('mongoose');
const { config } = require('../config/env');
const { PoliteQueue } = require('./politeQueue');
const { ScrapeLog } = require('../models');
const { analyzeTitle, findBestMatch } = require('../services/matching');

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
async function scrapePlatform(platform, query, { kind = 'search' } = {}) {
  const started = Date.now();
  if (config.demoMode) {
    return { platform, status: 'skipped', listings: [], error: 'Demo mode: live scraping disabled', ms: 0 };
  }
  const adapter = adapters[platform];
  if (!adapter) return { platform, status: 'skipped', listings: [], error: 'No live adapter', ms: 0 };

  try {
    const listings = await queues[platform].run(() => adapter.search(query));
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

// Price check: find the current offer for a stored listing by searching its title.
async function fetchCurrentListing(listing) {
  const result = await scrapePlatform(listing.platform, listing.title, { kind: 'price-check' });
  if (result.status !== 'success') return { ...result, listing: null };
  const exact = result.listings.find((l) => l.externalId === listing.externalId);
  if (exact) return { ...result, listing: exact };
  const best = findBestMatch(analyzeTitle(listing.title), result.listings);
  return { ...result, listing: best ? best.candidate : null };
}

function platformStatus() {
  return Object.values(queues).map((q) => q.status());
}

module.exports = { adapters, queues, livePlatforms, scrapePlatform, scrapeAll, fetchCurrentListing, platformStatus };

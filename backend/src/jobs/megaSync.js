// Mega.pk background sync (Phase 2 Part F): discovers products via /sitemap.xml and reads each product
// page read-only, per the live-rechecked robots.txt (see scrapers/mega.js header). Off by default
// (SYNC_MEGA_ENABLED) - owner decision: unlike Telex (an already-trusted, previously-approved source
// with an explicit agents.md invitation), Mega is a brand-new, never-before-hit site, so the kill switch
// stays off until ali explicitly turns it on, even though the schedule file exists and is wired up the
// same way. Same shape as jobs/telexSync.js throughout (progress in settings.megaSync, exact matchKey
// matching only, real observation timestamps only).
const { Product, Listing, Setting, JobRun } = require('../models');
const { config } = require('../config/env');
const mega = require('../scrapers/mega');
const { analyzeTitle, searchKeyOf } = require('../services/matching');
const { classify } = require('../services/categories');
const { appendHistory } = require('../services/ingest');
const { refreshProductsStats } = require('../services/productStats');

const STATE_KEY = 'megaSync';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;
const isRunning = () => running;

function politeDelay() {
  const { minDelayMs, maxDelayMs } = config.megaSync;
  return minDelayMs + Math.random() * Math.max(0, maxDelayMs - minDelayMs);
}

// Exact-model matching only, same rule as telexSync.js: a Mega listing merges into an existing product
// only when its normalized title produces the SAME matchKey. Anything less confident stays its own,
// unmatched product rather than risk attaching a Mega offer to the wrong device - reuses the one
// existing matching pipeline (services/matching.js), not a separate/weaker path.
async function matchOrCreateProduct(found) {
  const a = analyzeTitle(found.title);
  const existing = await Product.findOne({ matchKey: a.key });
  if (existing) return existing;
  const category = classify(found.title) || undefined;
  return Product.create({
    title: found.title,
    matchKey: a.key,
    brand: a.brand || undefined,
    category,
    searchKey: searchKeyOf(a.brand, found.title),
    image: found.image || undefined,
  });
}

async function storeProduct(found, now) {
  const product = await matchOrCreateProduct(found);
  let listing = await Listing.findOne({ platform: 'mega', externalId: found.externalId });
  const changed = !listing || listing.price !== found.price;
  if (!listing) listing = new Listing({ productId: product._id, platform: 'mega', role: 'retail', externalId: found.externalId });
  Object.assign(listing, {
    productId: product._id,
    title: found.title,
    url: found.url,
    image: found.image || undefined,
    price: found.price,
    originalPrice: found.originalPrice || undefined,
    currency: found.currency || 'PKR',
    inStock: found.inStock !== false,
    seeded: false,
    dataSource: 'live',
    lastScrapedAt: now,
  });
  await listing.save();
  // Price history: only ever 'real', at the actual observation time - never simulated or backfilled
  // (hard limit 5).
  await appendHistory(listing, found.price, now, { force: changed, source: 'real' });
  await refreshProductsStats([product._id]);
  return product;
}

async function loadState() {
  const row = await Setting.findOne({ key: STATE_KEY }).lean();
  return (row && row.value) || { sitemaps: [], sitemapIndex: 0, visited: {}, sitemapsDiscoveredAt: null };
}

async function saveState(state) {
  await Setting.set(STATE_KEY, state);
}

// Refreshes the list of product sub-sitemaps at most once a day (the index itself rarely changes).
async function ensureSitemaps(state) {
  const dayMs = 24 * 60 * 60 * 1000;
  if (state.sitemaps.length && state.sitemapsDiscoveredAt && Date.now() - new Date(state.sitemapsDiscoveredAt).getTime() < dayMs) {
    return state;
  }
  const sitemaps = await mega.discoverProductSitemaps();
  return { ...state, sitemaps, sitemapIndex: 0, sitemapsDiscoveredAt: new Date().toISOString() };
}

// Returns { status, summary, ... } or { status: 'skipped', reason }.
async function runMegaSync({ trigger = 'schedule' } = {}) {
  if (!config.megaSync.enabled) return { status: 'skipped', reason: 'Mega sync is disabled (SYNC_MEGA_ENABLED is not true)' };
  if (running) return { status: 'skipped', reason: 'A Mega sync is already running' };
  if (config.demoMode) return { status: 'skipped', reason: 'Demo mode: live scraping disabled' };
  running = true;
  const startedAt = new Date();
  const summary = { pagesFetched: 0, matched: 0, created: 0, skippedCategory: 0, skippedParse: 0, blocked: 0 };
  let status = 'success';
  let error;
  let stopped = false;
  try {
    let state = await loadState();
    state = await ensureSitemaps(state);
    const maxPages = config.megaSync.maxPagesPerRun;

    while (!stopped && summary.pagesFetched < maxPages && state.sitemapIndex < state.sitemaps.length) {
      const sitemapUrl = state.sitemaps[state.sitemapIndex];
      let productUrls;
      try {
        // eslint-disable-next-line no-await-in-loop
        productUrls = await mega.discoverProductUrls(sitemapUrl);
      } catch (err) {
        summary.blocked += 1;
        error = err.message;
        stopped = true;
        break;
      }
      const visitedSet = new Set(state.visited[sitemapUrl] || []);
      for (const url of productUrls) {
        if (stopped || summary.pagesFetched >= maxPages) break;
        if (visitedSet.has(url)) continue;
        // eslint-disable-next-line no-await-in-loop
        await sleep(politeDelay());
        let found;
        try {
          // eslint-disable-next-line no-await-in-loop
          found = await mega.fetchProductPage(url);
        } catch (err) {
          if (err.code === 'BLOCKED') {
            // Immediate stop for the run, per the brief - never keep hammering a store that refused us.
            summary.blocked += 1;
            error = err.message;
            stopped = true;
            break;
          }
          summary.skippedParse += 1;
          visitedSet.add(url);
          continue;
        }
        summary.pagesFetched += 1;
        visitedSet.add(url);
        if (!mega.isLaunchCategory(found.title)) {
          summary.skippedCategory += 1;
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const existedBefore = await Product.exists({ matchKey: analyzeTitle(found.title).key });
        // eslint-disable-next-line no-await-in-loop
        await storeProduct(found, new Date());
        if (existedBefore) summary.matched += 1;
        else summary.created += 1;
      }
      state.visited[sitemapUrl] = [...visitedSet];
      if (visitedSet.size >= productUrls.length) state.sitemapIndex += 1; // this sub-sitemap is fully visited
      // eslint-disable-next-line no-await-in-loop
      await saveState(state);
    }
    if (stopped) status = summary.pagesFetched ? 'partial' : 'failed';
  } catch (err) {
    status = 'failed';
    error = err.message;
    console.error('Mega sync failed:', err);
  } finally {
    running = false;
  }
  const durationMs = Date.now() - startedAt.getTime();
  const run = await JobRun.create({ name: 'mega-sync', mode: 'live', trigger, status, startedAt, durationMs, summary, error });
  return { status, summary, durationMs, runId: String(run._id) };
}

module.exports = { runMegaSync, isRunning, politeDelay };

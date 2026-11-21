// Telex.pk background sync (Phase 2A): discovers products via /sitemap.xml and reads each product
// page read-only, per telex.pk/agents.md. Off by default (SYNC_TELEX_ENABLED) until the owner turns
// it on. Progress (which sub-sitemaps/products have been visited) lives in settings.telexSync so a
// run picks up where the last one stopped, the same pattern as jobs/catalogSync.js.
const { Product, Listing, Setting, JobRun } = require('../models');
const { config } = require('../config/env');
const telex = require('../scrapers/telex');
const { analyzeTitle, searchKeyOf, findBestMatch } = require('../services/matching');
const { classify } = require('../services/categories');
const { appendHistory } = require('../services/ingest');
const { refreshProductsStats } = require('../services/productStats');

const STATE_KEY = 'telexSync';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let running = false;
const isRunning = () => running;

function politeDelay() {
  const { minDelayMs, maxDelayMs } = config.telexSync;
  return minDelayMs + Math.random() * Math.max(0, maxDelayMs - minDelayMs);
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PRICE_FLOOR_RATIO = 0.4; // same bar as services/ingest.js: a price this far under the product's
// known lowest is more likely a different, cheaper item than a real price for the same model.
const priceImplausible = (price, product) => {
  const ref = product && (product.minPrice ?? product.retailMinPrice);
  return Boolean(ref) && price < ref * PRICE_FLOOR_RATIO;
};

// A Telex listing merges into an existing product when its normalized title produces the SAME exact
// matchKey (fast path), OR - Phase 3 Part C, 2026-11-21 live-site review - when services/matching.js's
// fuzzy brand + similarity match (the same one services/ingest.js uses for Daraz/PriceOye) finds one.
// Exact-key-only was the original design (Phase 2A), but it meant a Telex listing whose title merely
// phrased storage/spec words differently from the stored product ("Apple iPhone 18 Pro" vs Telex's
// "...18 Pro 256GB PTA Approved With Official Warranty") silently became its own second, never-matched
// product instead of showing up as another store on the product everyone already sees.
// Returns { product, matched }: matched is false only when a brand new product had to be created.
async function matchOrCreateProduct(found) {
  const a = analyzeTitle(found.title);
  const exact = await Product.findOne({ matchKey: a.key }).select('title brand matchKey minPrice retailMinPrice').lean();
  if (exact && !priceImplausible(found.price, exact)) return { product: exact, matched: true };

  if (a.brand) {
    const candidates = await Product.find({ brand: new RegExp(`^${escapeRegex(a.brand)}$`, 'i') })
      .select('title brand matchKey minPrice retailMinPrice')
      .limit(600)
      .lean();
    const pool = candidates.filter((c) => !priceImplausible(found.price, c));
    const best = findBestMatch(a, pool);
    if (best) return { product: best.candidate, matched: true };
  }

  const category = classify(found.title) || undefined;
  const product = await Product.create({
    title: found.title,
    matchKey: a.key,
    brand: a.brand || undefined,
    category,
    searchKey: searchKeyOf(a.brand, found.title),
    image: found.image || undefined,
  });
  return { product, matched: false };
}

async function storeProduct(found, now) {
  const { product, matched } = await matchOrCreateProduct(found);
  let listing = await Listing.findOne({ platform: 'telex', externalId: found.externalId });
  const changed = !listing || listing.price !== found.price;
  if (!listing) listing = new Listing({ productId: product._id, platform: 'telex', role: 'retail', externalId: found.externalId });
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
  // Price history: only ever 'real', at the actual observation time - never simulated or backfilled.
  await appendHistory(listing, found.price, now, { force: changed, source: 'real' });
  await refreshProductsStats([product._id]);
  return { product, matched };
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
  const sitemaps = await telex.discoverProductSitemaps();
  return { ...state, sitemaps, sitemapIndex: 0, sitemapsDiscoveredAt: new Date().toISOString() };
}

// Returns { status, summary, ... } or { status: 'skipped', reason }.
async function runTelexSync({ trigger = 'schedule' } = {}) {
  if (!config.telexSync.enabled) return { status: 'skipped', reason: 'Telex sync is disabled (SYNC_TELEX_ENABLED is not true)' };
  if (running) return { status: 'skipped', reason: 'A Telex sync is already running' };
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
    const maxPages = config.telexSync.maxPagesPerRun;

    while (!stopped && summary.pagesFetched < maxPages && state.sitemapIndex < state.sitemaps.length) {
      const sitemapUrl = state.sitemaps[state.sitemapIndex];
      let productUrls;
      try {
        // eslint-disable-next-line no-await-in-loop
        productUrls = await telex.discoverProductUrls(sitemapUrl);
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
          found = await telex.fetchProductPage(url);
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
        if (!telex.isLaunchCategory(found.title)) {
          summary.skippedCategory += 1;
          continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const { matched } = await storeProduct(found, new Date());
        if (matched) summary.matched += 1;
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
    console.error('Telex sync failed:', err);
  } finally {
    running = false;
  }
  const durationMs = Date.now() - startedAt.getTime();
  const run = await JobRun.create({ name: 'telex-sync', mode: 'live', trigger, status, startedAt, durationMs, summary, error });
  return { status, summary, durationMs, runId: String(run._id) };
}

module.exports = { runTelexSync, isRunning, politeDelay, storeProduct };

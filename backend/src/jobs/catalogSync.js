// Background catalog sync: keeps the sample catalog's store listings real and current without a burst of
// requests (Daraz answers about a hundred searches in a few minutes with a captcha page). Each run handles a
// small batch of (catalog item, store) tasks, oldest first:
//   - the item has a store listing linked to a real product page -> re-fetched by that link (1 request)
//   - otherwise -> the store is searched by the item's title and a confident match (catalogMatch) is stored
//     with its real product URL and price
// Progress lives in settings.catalogSync, so restarts continue where the last run stopped. A refused request
// ends the run; the next scheduled run tries again later.
const { Product, Listing, PriceHistory, Setting, JobRun } = require('../models');
const { config } = require('../config/env');
const scrapers = require('../scrapers');
const catalog = require('../seed/catalog');
const { analyzeTitle, searchKeyOf, significantTokens } = require('../services/matching');
const { pick } = require('../services/catalogMatch');
const { resolveCategory, classify } = require('../services/categories');
const { appendHistory } = require('../services/ingest');
const { refreshProductsStats } = require('../services/productStats');

const PLATFORM_OF = { d: 'daraz', p: 'priceoye', a: 'aliexpress' };
const HOUR = 60 * 60 * 1000;
const STATE_KEY = 'catalogSync';

let running = false;
const isRunning = () => running;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every (item, store) the catalog says exists, limited to the configured stores.
function allTasks() {
  const stores = new Set(config.catalogSync.platforms);
  return catalog.flatMap((item) => [...item.on].map((code) => ({ item, platform: PLATFORM_OF[code] })).filter((t) => stores.has(t.platform)));
}

const taskKey = (t) => `${t.item.t}|${t.platform}`;

// Never-checked tasks first (catalog order), then the longest-ago checked. A match is refreshed after
// refreshHours, a miss is retried after retryHours.
function dueTasks(state, now) {
  const { refreshHours, retryHours } = config.catalogSync;
  const due = [];
  allTasks().forEach((t, i) => {
    const s = state[taskKey(t)];
    if (!s) {
      due.push({ ...t, order: -1, i });
      return;
    }
    const at = new Date(s.at).getTime();
    if (now - at >= (s.ok ? refreshHours : retryHours) * HOUR) due.push({ ...t, order: at, i });
  });
  return due.sort((a, b) => a.order - b.order || a.i - b.i);
}

const fieldsOf = (l, now) => ({
  title: l.title,
  url: l.url,
  image: l.image || undefined,
  price: l.price,
  originalPrice: l.originalPrice || undefined,
  currency: l.currency || 'PKR',
  rating: l.rating || undefined,
  reviewCount: l.reviewCount || 0,
  inStock: l.inStock !== false,
  seeded: false,
  dataSource: 'live',
  lastScrapedAt: now,
});

async function ensureProduct(item, found) {
  const key = analyzeTitle(item.t).key;
  const existing = await Product.findOne({ $or: [{ matchKey: key }, { title: item.t }] });
  if (existing) return existing;
  return Product.create({
    title: item.t,
    matchKey: key,
    brand: item.b,
    category: resolveCategory(item.c) || classify(item.t),
    searchKey: searchKeyOf(item.b, item.t),
    image: found.image || undefined,
  });
}

// Stores the matched listing for the item, replacing a stale or sample listing of the same store.
// Resolves to null when the store item already belongs to another product.
async function storeMatch(item, found, now) {
  const product = await ensureProduct(item, found);
  const role = found.role || 'retail';
  const clash = await Listing.findOne({ platform: found.platform, externalId: found.externalId });
  if (clash && String(clash.productId) !== String(product._id)) return null;
  let listing = clash || (await Listing.findOne({ productId: product._id, platform: found.platform, role }));
  const changed = !listing || listing.price !== found.price;
  if (!listing) listing = new Listing({ productId: product._id, platform: found.platform, role });
  else if (listing.externalId !== found.externalId) await PriceHistory.deleteMany({ listingId: listing._id }); // another store item: its history is not ours
  Object.assign(listing, fieldsOf(found, now), { externalId: found.externalId });
  await listing.save();
  await appendHistory(listing, found.price, now, { force: changed });
  await refreshProductsStats([product._id]);
  return product;
}

// One task. Resolves to { ok } or { blocked, error } when the store refused the request.
async function runTask(task, now, summary) {
  const { item, platform } = task;
  const product = await Product.findOne({ title: item.t }).select('_id').lean();
  const stored = product && (await Listing.findOne({ productId: product._id, platform }));

  // 1. a listing already linked to a real product page: re-fetch it by its link
  if (stored && scrapers.canRefetch(stored)) {
    const r = await scrapers.fetchCurrentListing(stored);
    if (r.status !== 'success') return { blocked: true, error: r.error };
    if (r.listing) {
      const changed = r.listing.price !== stored.price;
      Object.assign(stored, fieldsOf(r.listing, now));
      await stored.save();
      await appendHistory(stored, r.listing.price, now, { force: changed });
      summary.refreshed += 1;
      if (changed) summary.pricesChanged += 1;
    } else {
      stored.inStock = false; // the store no longer lists it
      stored.lastScrapedAt = now;
      await stored.save();
      summary.gone += 1;
    }
    await refreshProductsStats([stored.productId]);
    return { ok: Boolean(r.listing) };
  }

  // 2. look the item up in the store's search
  const po = platform !== 'priceoye' && product ? await Listing.findOne({ productId: product._id, platform: 'priceoye' }).select('price').lean() : null;
  const row = po ? { priceoye: { price: po.price } } : undefined;
  let found = null;
  for (const q of [...new Set([item.t, significantTokens(item.t).slice(0, 4).join(' ')])]) {
    // eslint-disable-next-line no-await-in-loop
    const r = await scrapers.scrapePlatform(platform, q, { kind: 'catalog-sync' });
    if (r.status !== 'success') return { blocked: true, error: r.error };
    found = pick(item, r.listings, row);
    if (found) break;
  }
  if (!found || !(await storeMatch(item, found, now))) {
    summary.noMatch += 1;
    return { ok: false };
  }
  summary.matched += 1;
  return { ok: true };
}

// Returns { status, summary, ... } or { status: 'skipped', reason }.
async function runCatalogSync({ batch = config.catalogSync.batch, trigger = 'schedule' } = {}) {
  if (running) return { status: 'skipped', reason: 'A catalog sync is already running' };
  if (config.demoMode) return { status: 'skipped', reason: 'Demo mode: live scraping disabled' };
  running = true;
  const startedAt = new Date();
  const summary = { tasks: 0, matched: 0, refreshed: 0, pricesChanged: 0, noMatch: 0, gone: 0, blocked: 0, remaining: 0 };
  let status = 'success';
  let error;
  try {
    const stateRow = await Setting.findOne({ key: STATE_KEY }).lean();
    const state = (stateRow && stateRow.value) || {};
    const due = dueTasks(state, startedAt.getTime());
    summary.remaining = Math.max(0, due.length - batch);
    const refused = new Set(); // stores that refused a request in this run: skipped until the next run
    let handled = 0;
    for (const task of due) {
      if (handled >= batch) break;
      if (refused.has(task.platform)) continue;
      let result;
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await runTask(task, new Date(), summary);
      } catch (err) {
        console.error('Catalog sync task failed:', err.message);
        summary.blocked += 1;
        error = err.message;
        refused.add(task.platform);
        continue;
      }
      if (result.blocked) {
        summary.blocked += 1;
        error = result.error;
        refused.add(task.platform); // stop asking this store; the next scheduled run tries again
        continue;
      }
      handled += 1;
      summary.tasks += 1;
      state[taskKey(task)] = { at: new Date().toISOString(), ok: result.ok };
      // eslint-disable-next-line no-await-in-loop
      await Setting.set(STATE_KEY, state);
      // eslint-disable-next-line no-await-in-loop
      await sleep(config.catalogSync.pauseMs);
    }
    if (!due.length) status = 'skipped';
    else if (summary.blocked) status = summary.tasks ? 'partial' : 'failed';
  } catch (err) {
    status = 'failed';
    error = err.message;
    console.error('Catalog sync failed:', err);
  } finally {
    running = false;
  }
  const durationMs = Date.now() - startedAt.getTime();
  const run = await JobRun.create({ name: 'catalog-sync', mode: 'live', trigger, status, startedAt, durationMs, summary, error });
  return { status, summary, durationMs, runId: String(run._id) };
}

// Progress for monitoring: tasks with a result, matches, and tasks due now.
async function catalogSyncProgress() {
  const stateRow = await Setting.findOne({ key: STATE_KEY }).lean();
  const state = (stateRow && stateRow.value) || {};
  const tasks = allTasks();
  const has = (t) => state[taskKey(t)];
  return { total: tasks.length, checked: tasks.filter(has).length, matched: tasks.filter((t) => has(t) && has(t).ok).length, due: dueTasks(state, Date.now()).length };
}

module.exports = { runCatalogSync, isRunning, catalogSyncProgress, dueTasks };

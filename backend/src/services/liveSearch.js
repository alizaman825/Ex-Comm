// Live search: mirrors what the stores themselves return for the query. Nothing is dropped - but since
// PLAN.md item 4, a product whose matching listing fails the strict relevance check (isRelevant) is no
// longer ranked alongside real matches: it is kept, in order, in a separate "other models" group
// (relevantProductIds vs productIds on the cache doc) so the main results are never polluted by a wrong
// model number ranked up by the old ranking-only ordering (e.g. "iphone 15 pro max" returning "iPhone 18
// Pro Max" first - see AUDIT.md section 4a).
//
// Results are loaded page by page from every store (Daraz 40 per page, PriceOye 24), stored in the database
// (so products can be compared, charted, wishlisted and alerted on) and remembered as one ordered list per
// query. More pages are loaded only when the caller asks for more results than are loaded so far.
// Within each newly loaded batch the best matches are ranked first (ranking only, inside each group).
const { config } = require('../config/env');
const scrapers = require('../scrapers');
const { SearchCache } = require('../models');
const { relevanceScore, isRelevant } = require('./relevance');
const { ingestListings } = require('./ingest');

const MAX_STORE_PAGE = 100; // Daraz serves roughly 100 pages per query
const MAX_ROUNDS = 3; // store pages loaded per request, so one request cannot run away

const locks = new Map(); // one load at a time per query (a second click must not repeat the first)

const newState = () => ({ nextPage: 1, loaded: 0, total: null, pageSize: null, approximate: false, exhausted: false, status: 'pending' });

function serialize(fn, key) {
  const run = (locks.get(key) || Promise.resolve()).then(fn, fn);
  locks.set(key, run.catch(() => {}));
  return run;
}

// Ordered unique product ids of a batch ingested in `order`.
const uniqueInOrder = (ids, already) => {
  const seen = new Set(already);
  return ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
};

function describe(platforms, state, ms = {}) {
  return Object.fromEntries(
    platforms.map((p) => {
      const s = state[p];
      return [p, {
        status: s.status === 'success' ? 'success' : s.status === 'skipped' ? 'skipped' : s.status === 'pending' ? 'success' : 'failed',
        scraped: s.loaded,
        relevant: s.loaded, // kept for older clients: every loaded result is shown
        loaded: s.loaded,
        total: s.total,
        approximate: s.approximate || undefined,
        exhausted: s.exhausted,
        ms: ms[p],
        ...(s.error ? { error: s.error, code: s.code || 'ERROR' } : {}),
      }];
    })
  );
}

/**
 * Makes sure at least `need` relevant results are loaded for the query (or every store is exhausted /
 * failing). Resolves with { productIds, otherProductIds, platformStatus, estimatedTotal, storesHaveMore,
 * fetchedNow, fetchedAt, anySuccess }. `productIds` only ever holds products with at least one listing
 * that passed isRelevant(); `otherProductIds` holds the rest, in the order they were found (close/loose
 * matches - e.g. a different storage size or a listing with no recognisable model number at all - shown
 * collapsed as "Other models", never ranked above a real match).
 */
function ensureLoaded(query, parsed, { need, refresh = false, key, platforms = scrapers.livePlatforms() }) {
  return serialize(async () => {
    const started = Date.now();
    const doc = await SearchCache.findOne({ queryKey: key });
    const ttl = doc && doc.productIds && doc.productIds.length ? config.search.cacheTtlMs : config.search.emptyCacheTtlMs;
    const reusable = Boolean(doc && doc.platformState && !refresh && Date.now() - doc.fetchedAt.getTime() < ttl);

    // An explicit refresh also lets a paused store through again: the user is asking us to try now.
    if (refresh) scrapers.closeCircuits(platforms);

    const state = reusable ? JSON.parse(JSON.stringify(doc.platformState)) : {};
    for (const p of platforms) if (!state[p]) state[p] = newState();
    let ids = reusable ? doc.productIds.map(String) : [];
    let relevantIds = new Set(reusable ? (doc.relevantProductIds || []).map(String) : []);
    const fetchedAt = reusable ? doc.fetchedAt : new Date();
    const ms = {};
    const failedNow = new Set();
    let fetchedNow = false;

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const wantMore = round === 0 ? !reusable || relevantIds.size < need : relevantIds.size < need;
      const active = platforms.filter((p) => !state[p].exhausted && !failedNow.has(p));
      if (!wantMore || !active.length) break;
      if (round > 0 && Date.now() - started > config.search.liveBudgetMs / 2) break; // keep within the time budget

      const results = await Promise.all(active.map((p) => scrapers.scrapePlatform(p, query, { page: state[p].nextPage })));
      fetchedNow = true;
      const batch = [];
      for (const r of results) {
        const s = state[r.platform];
        ms[r.platform] = (ms[r.platform] || 0) + (r.ms || 0);
        if (r.status !== 'success') {
          s.status = r.status;
          s.error = r.error;
          s.code = r.code;
          failedNow.add(r.platform);
          continue;
        }
        s.status = 'success';
        delete s.error;
        delete s.code;
        const meta = r.meta || {};
        s.pageSize = meta.pageSize || s.pageSize || r.listings.length;
        s.total = meta.total ?? s.total ?? r.listings.length;
        s.approximate = Boolean(meta.approximate);
        s.loaded += r.listings.length;
        s.nextPage += 1;
        if (!r.listings.length || (s.nextPage - 1) * (s.pageSize || 1) >= s.total || s.nextPage > MAX_STORE_PAGE) s.exhausted = true;
        batch.push(...r.listings);
      }
      if (batch.length) {
        // rank the best matches first within this batch (nothing is dropped); ties keep the stores' own order
        const ranked = batch.map((l, i) => ({ l, i, score: relevanceScore(parsed, l.title) })).sort((a, b) => b.score - a.score || a.i - b.i).map((x) => x.l);
        const relevantFlags = ranked.map((l) => isRelevant(parsed, l.title));
        const { productIdByListing } = await ingestListings(ranked);
        ids = ids.concat(uniqueInOrder(productIdByListing, ids));
        productIdByListing.forEach((pid, i) => {
          if (pid && relevantFlags[i]) relevantIds.add(String(pid));
        });
      }
    }

    // stores added on demand (AliExpress) keep their entry; they are not part of the ordinary live search
    const platformStatus = describe(Object.keys(state), state, ms);
    const relevantProductIds = ids.filter((id) => relevantIds.has(id));
    await SearchCache.updateOne(
      { queryKey: key },
      { $set: { query: query.trim().toLowerCase(), productIds: ids, relevantProductIds, platformState: state, platformStatus, source: 'live', fetchedAt } },
      { upsert: true }
    );

    const anySuccess = platforms.some((p) => state[p].status === 'success');
    const estimatedTotal = platforms.reduce((sum, p) => sum + (state[p].total ?? state[p].loaded ?? 0), 0);
    const storesHaveMore = platforms.some((p) => state[p].status === 'success' && !state[p].exhausted);
    const otherProductIds = ids.filter((id) => !relevantIds.has(id));
    return { productIds: relevantProductIds, otherProductIds, platformStatus, estimatedTotal, storesHaveMore, fetchedNow, fetchedAt, anySuccess };
  }, key);
}

module.exports = { ensureLoaded, MAX_ROUNDS };

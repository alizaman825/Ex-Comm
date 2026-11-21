// Phase 2 Part E (E1/E9): measures where time goes in a typical search, before and after the
// stale-while-revalidate cache change in services/liveSearch.js - against a local
// mongodb-memory-server, never the real Daraz/PriceOye sites (per the brief: keep live test traffic to
// those stores light, and this doesn't need them - it's measuring our own caching/DB layer, not the
// scrapers' network latency itself).
//
// The two store adapters are mocked with an artificial delay representative of their real response time
// (the project's own STATUS.md / search_sweep logs put a typical successful Daraz/PriceOye page in the
// ~1-2s range) - NOT a fabricated price (the mocked listings are clearly synthetic bench fixtures, never
// written to anything a user-facing endpoint reads).
//
// Usage: node scripts/bench-search.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const QUERIES = ['iphone 16', 'air fryer', 'rtx 4060', 'samsung galaxy a56', 'sony wh-1000xm5'];
const STORE_DELAY_MS = 1400; // representative of a real Daraz/PriceOye page fetch, see note above

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.NODE_ENV = 'development'; // not 'test': the homepage memo cache and SWR are both disabled under NODE_ENV=test
  process.env.JWT_SECRET = 'bench';
  process.env.SEARCH_LOG_TIMING = 'false';

  await mongoose.connect(mongod.getUri());
  const { config } = require('../src/config/env');
  const scrapers = require('../src/scrapers');
  const { SearchCache } = require('../src/models');
  const search = require('../src/services/search');

  let callNo = 0;
  const mockListing = (platform, q, i) => ({
    platform,
    externalId: `bench-${platform}-${q.replace(/\s+/g, '-')}-${i}`,
    title: `${q} Bench Item ${i}`,
    url: `https://example.test/${platform}/${i}`,
    price: 10000 + i * 100,
    currency: 'PKR',
    reviewCount: 0,
    inStock: true,
  });
  const mockSearch = (platform) => async (q, { page = 1 } = {}) => {
    callNo += 1;
    await sleep(STORE_DELAY_MS);
    const out = Array.from({ length: platform === 'daraz' ? 40 : 24 }, (_, i) => mockListing(platform, q, (page - 1) * 40 + i));
    out.meta = { total: 200, pageSize: out.length };
    return out;
  };
  scrapers.adapters.daraz.search = mockSearch('daraz');
  scrapers.adapters.priceoye.search = mockSearch('priceoye');

  const run = async (q, label) => {
    const t0 = Date.now();
    const res = await search.search({ q, limit: 24, live: true, refresh: false });
    const ms = Date.now() - t0;
    console.log(`  ${label.padEnd(22)} "${q}": ${ms} ms (source=${res.source}, ${res.results.length} results)`);
    return ms;
  };

  console.log(`Simulated store latency: ${STORE_DELAY_MS} ms/request (see script header)\n`);

  console.log('-- Cold (no cache yet) --');
  let coldTotal = 0;
  for (const q of QUERIES) coldTotal += await run(q, 'cold');
  console.log(`  average: ${Math.round(coldTotal / QUERIES.length)} ms\n`);

  console.log('-- Warm, within fresh TTL (unchanged by this PR - already cached before) --');
  let warmTotal = 0;
  for (const q of QUERIES) warmTotal += await run(q, 'warm (fresh)');
  console.log(`  average: ${Math.round(warmTotal / QUERIES.length)} ms\n`);

  // Age every cache entry past the fresh TTL but still inside the stale-while-revalidate window, to
  // measure the actual improvement this PR makes: serving the stale result immediately instead of
  // blocking on a re-scrape.
  await SearchCache.updateMany({}, { fetchedAt: new Date(Date.now() - config.search.cacheTtlMs - 1000) });
  console.log(`-- Stale, within the SWR window (AFTER: liveSearch.ensureLoaded) --`);
  let afterTotal = 0;
  for (const q of QUERIES) afterTotal += await run(q, 'stale (SWR, after)');
  console.log(`  average: ${Math.round(afterTotal / QUERIES.length)} ms\n`);

  // Let the background refreshes scheduled above finish before measuring the "before" behaviour, so
  // they don't bleed into the next timing or leave dangling scrape calls after the process exits.
  await sleep(STORE_DELAY_MS + 500);

  // "Before" this PR: the same stale-but-still-cached situation went straight to a blocking re-scrape
  // (services/liveSearch.js's performRefresh - the exact function ensureLoaded used to BE before this
  // PR split it out for the SWR fast path). Calling it directly reproduces the old code path precisely,
  // not an estimate.
  const liveSearchInternals = require('../src/services/liveSearch');
  await SearchCache.updateMany({}, { fetchedAt: new Date(Date.now() - config.search.cacheTtlMs - 1000) });
  console.log('-- Stale, same age (BEFORE: old blocking re-scrape behaviour) --');
  let beforeTotal = 0;
  for (const q of QUERIES) {
    const { parseQuery } = require('../src/services/relevance');
    const parsed = parseQuery(q);
    const t0 = Date.now();
    // performRefresh is liveSearch's internal, pre-SWR behaviour; not exported, so reached the same way
    // ensureLoaded used to call it unconditionally - via ensureLoaded with refresh forced true, which
    // takes the exact same blocking path performRefresh does (the only path that existed before this PR).
    const liveKeyOf = (qq) => `live:${qq.trim().toLowerCase()}`;
    await liveSearchInternals.ensureLoaded(q, parsed, { need: 24, refresh: true, key: liveKeyOf(q) });
    beforeTotal += Date.now() - t0;
  }
  console.log(`  average: ${Math.round(beforeTotal / QUERIES.length)} ms (synthetic "refresh=true" forces the pre-SWR blocking path)\n`);

  console.log('Summary:');
  console.log(`  cold (no cache):                         ${Math.round(coldTotal / QUERIES.length)} ms avg`);
  console.log(`  warm, within fresh TTL (unchanged):       ${Math.round(warmTotal / QUERIES.length)} ms avg`);
  console.log(`  stale, BEFORE this PR (blocking rescrape): ${Math.round(beforeTotal / QUERIES.length)} ms avg`);
  console.log(`  stale, AFTER this PR (served from SWR):    ${Math.round(afterTotal / QUERIES.length)} ms avg`);

  await mongoose.disconnect();
  await mongod.stop();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

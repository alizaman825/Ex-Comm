// Gathers live listings for a query from every live store.
//
// A store's own search ranking can bury exactly what was asked for (Daraz answers "iphone 15 pro max
// cover" with generic covers but "iphone 15 pro max case" with dozens of matches). So when the first
// attempt yields few relevant items we try up to two alternative phrasings. Every store is handled
// on its own: a store that has the product is a result whether or not any other store does.
const { config } = require('../config/env');
const scrapers = require('../scrapers');
const { parseQuery, isRelevant } = require('./relevance');

// Accessory words that stores use interchangeably.
const SYNONYMS = {
  cover: ['case'],
  case: ['cover'],
  pouch: ['sleeve'],
  sleeve: ['pouch'],
  strap: ['band'],
  band: ['strap'],
  protector: ['tempered glass'],
  holder: ['stand'],
  stand: ['holder'],
  skin: ['cover'],
  charger: ['adapter'],
  adapter: ['charger'],
};
// Store titles often leave out the family word ("15 Pro Max Case" instead of "iPhone 15 Pro Max Case").
const FAMILY_WORDS = new Set(['iphone', 'ipad', 'galaxy', 'pixel', 'redmi', 'poco']);

const ENOUGH = 5; // relevant items per store after which no further phrasing is tried
const MAX_VARIANTS = 3;

function queryVariants(query, parsed = parseQuery(query)) {
  const words = query.trim().split(' ').filter(Boolean);
  const out = [words.join(' ')];
  words.forEach((w, i) => {
    for (const s of SYNONYMS[w.toLowerCase()] || []) out.push([...words.slice(0, i), s, ...words.slice(i + 1)].join(' '));
  });
  const withoutFamily = words.filter((w) => !FAMILY_WORDS.has(w.toLowerCase()));
  if (withoutFamily.length && withoutFamily.length < words.length && parsed.model.length) out.push(withoutFamily.join(' '));
  return [...new Set(out)].slice(0, MAX_VARIANTS);
}

// What to request from one store, in order: the phrasings (page 1), then further pages of the original query.
// Pages are only read while results are still thin and the previous page came back full (so there is more).
const FULL_PAGE = 20;
const MAX_PAGE = 3;
const MAX_REQUESTS = 4;

// Runs the requests for one store and records progress in `state` as it goes (so a time budget can
// return whatever has been found so far).
async function gatherPlatform(platform, query, parsed, state) {
  const seen = new Set();
  const plan = queryVariants(query, parsed).map((q) => ({ q, page: 1 }));
  let requests = 0;
  let fullFirstPage = false;

  const run = async ({ q, page }) => {
    requests += 1;
    const r = await scrapers.scrapePlatform(platform, q, { page });
    const fresh = r.listings.filter((l) => !seen.has(l.externalId));
    fresh.forEach((l) => seen.add(l.externalId));
    const relevant = fresh.filter((l) => isRelevant(parsed, l.title));
    const label = page > 1 ? `${q} (page ${page})` : q;
    state.attempts.push({ query: label, status: r.status, scraped: r.listings.length, relevant: relevant.length, ms: r.ms, ...(r.error ? { error: r.error } : {}) });
    state.scraped += fresh.length;
    state.ms += r.ms || 0;
    state.listings.push(...relevant);
    if (r.status === 'success') state.status = 'success';
    else if (state.status !== 'success') {
      state.status = r.status;
      state.error = r.error;
      state.code = r.code;
    }
    return r;
  };

  for (const step of plan) {
    if (requests >= MAX_REQUESTS) break;
    const r = await run(step);
    if (r.status !== 'success') {
      state.done = true;
      return; // blocked, timed out or paused: do not hammer the store with more requests
    }
    if (step === plan[0]) fullFirstPage = r.listings.length >= FULL_PAGE;
    if (state.listings.length >= ENOUGH) {
      state.done = true;
      return;
    }
  }
  // Still thin although the store has plenty (a full first page): the matches may sit further down.
  for (let page = 2; fullFirstPage && page <= MAX_PAGE && requests < MAX_REQUESTS && state.listings.length < ENOUGH; page += 1) {
    const r = await run({ q: plan[0].q, page });
    if (r.status !== 'success' || r.listings.length < FULL_PAGE) break;
  }
  state.done = true;
}

const newState = () => ({ status: 'failed', scraped: 0, ms: 0, listings: [], attempts: [], done: false });

// platforms default to the live ones. Resolves with { platformStatus, listings, anySuccess }.
async function gatherAll(query, { platforms = scrapers.livePlatforms(), budgetMs = config.search.liveBudgetMs } = {}) {
  const parsed = parseQuery(query);
  const states = Object.fromEntries(platforms.map((p) => [p, newState()]));
  const work = Promise.all(platforms.map((p) => gatherPlatform(p, query, parsed, states[p]).catch((err) => {
    states[p].status = 'failed';
    states[p].error = err.message;
    states[p].done = true;
  })));
  let timer;
  await Promise.race([work, new Promise((resolve) => { timer = setTimeout(resolve, budgetMs); })]);
  clearTimeout(timer);

  const listings = [];
  const platformStatus = {};
  for (const [platform, s] of Object.entries(states)) {
    const capped = s.listings.slice(0, config.search.maxIngestPerPlatform);
    listings.push(...capped);
    const timedOut = !s.done;
    platformStatus[platform] = {
      status: s.listings.length || s.status === 'success' ? 'success' : s.status,
      scraped: s.scraped,
      relevant: capped.length,
      ms: s.ms,
      queries: s.attempts.map((a) => a.query),
      ...(s.attempts.length > 1 ? { attempts: s.attempts } : {}),
      ...(timedOut
        ? { error: `Still working when the ${Math.max(1, Math.round(budgetMs / 1000))} second time limit was reached`, code: 'BUDGET' }
        : s.error
          ? { error: s.error, code: s.code || 'ERROR' }
          : {}),
    };
  }
  const anySuccess = Object.values(platformStatus).some((s) => s.status === 'success');
  return { platformStatus, listings, anySuccess };
}

module.exports = { gatherAll, queryVariants, SYNONYMS, ENOUGH };

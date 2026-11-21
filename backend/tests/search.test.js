const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const { parseQuery, isRelevant } = require('../src/services/relevance');
const { seedDatabase } = require('../src/seed/seed');
const { Product, Listing, PriceHistory, SearchCache } = require('../src/models');
const { startDb, stopDb } = require('./helpers');

let app;

beforeAll(async () => {
  await startDb();
  await seedDatabase({ log: () => {} });
  app = createApp();
});
afterAll(stopDb);
afterEach(async () => {
  jest.restoreAllMocks();
  config.demoMode = false;
  Object.values(scrapers.queues).forEach((q) => q.reset());
  await SearchCache.deleteMany({});
});

const mockScrapers = ({ daraz, priceoye }) => {
  const impl = (value) => (typeof value === 'function' ? value : async () => value);
  jest.spyOn(scrapers.adapters.daraz, 'search').mockImplementation(impl(daraz));
  jest.spyOn(scrapers.adapters.priceoye, 'search').mockImplementation(impl(priceoye));
};
const fail = (code = 'TIMEOUT') => async () => { throw Object.assign(new Error('boom'), { code }); };
const get = (qs) => request(app).get(`/api/search?${qs}`);

describe('relevance', () => {
  const q = parseQuery('samsung galaxy a56');
  test.each([
    ['Samsung Galaxy A56 5G 8GB 256GB', true],
    ['Samsung Galaxy A57 5G', false], // model number differs
    ['Samsung Galaxy S26 Ultra', false],
    ['Samsung Galaxy A56 Back Cover Case', false], // accessory
    ['TCL 55 Inch 4K LED TV', false],
  ])('%s -> %s', (title, expected) => expect(isRelevant(q, title)).toBe(expected));

  test('accessory words in the query allow accessories', () => {
    expect(isRelevant(parseQuery('galaxy a56 case'), 'Samsung Galaxy A56 Silicone Case')).toBe(true);
  });
});

describe('GET /api/search validation', () => {
  test.each([
    ['', 'Provide a search term'],
    ['q=a', 'at least 2'],
    ['q=phone&minPrice=500&maxPrice=100', 'Minimum price'],
    ['q=phone&platform=amazon', ''],
    ['q=phone&sort=cheapest', ''],
    ['q=phone&minRating=9', ''],
  ])('%p -> 400', async (qs) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
  });
});

describe('fallback and cache', () => {
  test('serves stored data labelled "fallback" when every platform fails', async () => {
    mockScrapers({ daraz: fail(), priceoye: fail('BLOCKED') });
    const res = await get('q=galaxy a55');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.platformStatus.daraz).toMatchObject({ status: 'failed' });
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].title).toMatch(/A55/);
  });

  test('demo mode never scrapes', async () => {
    config.demoMode = true;
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    const res = await get('q=airpods pro');
    expect(res.body.source).toBe('fallback');
    expect(res.body.results[0].title).toMatch(/AirPods Pro/i);
    expect(spy).not.toHaveBeenCalled();
  });

  test('live=false skips scraping', async () => {
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    await get('q=galaxy a55&live=false');
    expect(spy).not.toHaveBeenCalled();
  });

  test('a successful live search is cached; the next search is served from cache', async () => {
    const spy = jest.fn(async () => []);
    mockScrapers({ daraz: spy, priceoye: async () => [] });
    const first = await get('q=galaxy a55');
    expect(first.body.source).toBe('live');
    const callsAfterFirst = spy.mock.calls.length; // an empty first attempt also tries alternative phrasings
    expect(callsAfterFirst).toBeGreaterThanOrEqual(1);
    const second = await get('q=galaxy a55'); // the same search again
    expect(second.body.source).toBe('cache');
    expect(spy).toHaveBeenCalledTimes(callsAfterFirst); // the cached repeat scrapes nothing
    expect((await SearchCache.findOne({ hits: { $gt: 0 } })).hits).toBe(2);
  });

  test('B1 fix: a fresh cache entry that found fewer than `need` results is served immediately, not re-scraped on every request', async () => {
    // Far more pages exist (total: 500) than were ever loaded, so this query's cache never becomes
    // "exhausted" - exactly the shape of a narrow query (one real match) that previously caused every
    // request, including an immediate reload, to block on a brand new live round-trip (2026-11-21 review).
    // A brand new, unique title - never touches the shared "galaxy a55" sample product other tests use.
    const spy = jest.fn(async () =>
      Object.assign(
        [{ platform: 'daraz', externalId: 'zv-1', title: 'Zephyr Vortex Speaker X900', price: 89999, url: 'https://daraz.pk/x', currency: 'PKR', reviewCount: 10, inStock: true }],
        { meta: { total: 500, pageSize: 40 } }
      )
    );
    mockScrapers({ daraz: spy, priceoye: async () => [] });

    const first = await get('q=zephyr vortex speaker x900'); // cold: need=24, only 1 relevant match ever loads
    expect(first.body.source).toBe('live');
    const callsAfterFirst = spy.mock.calls.length;

    const second = await get('q=zephyr vortex speaker x900'); // immediate reload
    expect(second.body.source).toBe('cache');
    expect(second.body.results.length).toBe(first.body.results.length);
    expect(spy).toHaveBeenCalledTimes(callsAfterFirst); // no new scrape - this is the bug this fixes

    const third = await get('q=zephyr vortex speaker x900'); // still fresh, still short of `need`: still served from cache
    expect(third.body.source).toBe('cache');
    expect(third.body.results.length).toBe(first.body.results.length);
    // A background top-up (throttled to once per topUpCooldownMs, via the polite per-store queue) is what
    // eventually fills a cache entry like this in further - not separately asserted here to avoid a test
    // that depends on real wall-clock timing against the scraper queue's own politeness delay.
  });

  test('one platform failing still returns the other platform and marks the failure', async () => {
    mockScrapers({
      daraz: fail(),
      priceoye: [{ platform: 'priceoye', externalId: 'p1', title: 'Vivo Y29', price: 50000, url: 'https://priceoye.pk/x', currency: 'PKR', reviewCount: 0, inStock: true }],
    });
    const res = await get('q=vivo y29');
    expect(res.body.source).toBe('live');
    expect(res.body.platformStatus.daraz.status).toBe('failed');
    expect(res.body.platformStatus.priceoye).toMatchObject({ status: 'success', relevant: 1 });
  });
});

describe('Phase 4 Part A2: fastLocal (opt-in fast local-first search)', () => {
  test('a brand-new query with a matching local product returns it immediately, pending, and kicks off a background live check', async () => {
    const spy = jest.fn(async () => []);
    mockScrapers({ daraz: spy, priceoye: async () => [] });
    const res = await get('q=galaxy a55&fastLocal=true');
    expect(res.body.liveStatus).toBe('pending');
    expect(res.body.source).toBe('fallback');
    expect(res.body.results[0].title).toMatch(/A55/);
    // the background check was kicked off (not awaited) - wait for it to actually finish before the
    // next test's afterEach clears SearchCache, so it can never leak into another test.
    await new Promise((r) => setTimeout(r, 50));
    expect(spy).toHaveBeenCalled();
  });

  test('without fastLocal, the same cold query blocks on the live check as before (no behaviour change for other callers)', async () => {
    const spy = jest.fn(async () => []);
    mockScrapers({ daraz: spy, priceoye: async () => [] });
    const res = await get('q=galaxy a55');
    expect(res.body.liveStatus).toBeNull();
    expect(res.body.source).toBe('live');
  });

  test('once a cache entry exists for the query, fastLocal defers to the normal (fast) cache path instead of forcing another local-only response', async () => {
    mockScrapers({ daraz: async () => [], priceoye: async () => [] });
    await get('q=galaxy a55'); // creates a cache entry (source: live, empty)
    const res = await get('q=galaxy a55&fastLocal=true');
    expect(res.body.liveStatus).toBeNull();
    expect(['live', 'cache']).toContain(res.body.source);
  });

  // Phase 4 Part A1: previously this fell through to the ordinary BLOCKING live check (the shopper
  // waited the full store round trip with no feedback) because fastLocal only engaged when the database
  // already had a matching product. It now answers instantly with an empty, clearly-"pending" result so
  // the frontend can show a "searching live stores" state immediately instead of a blank wait.
  test('a brand-new query with no matching local product answers instantly as pending, instead of blocking on the live check', async () => {
    let resolveFetch;
    mockScrapers({
      daraz: () => new Promise((resolve) => { resolveFetch = resolve; }),
      priceoye: async () => [],
    });
    const res = await get('q=zzz nonexistent gadget 9999&fastLocal=true');
    expect(res.body.liveStatus).toBe('pending');
    expect(res.body.total).toBe(0);
    expect(res.body.results).toEqual([]);
    resolveFetch([]); // let the background fetch finish so it doesn't leak into the next test
  });
});

describe('Phase 4 Part C2: disambiguating identical card titles', () => {
  const { disambiguateTitles, distinguishingSpec, toCard } = require('../src/services/search');

  // Regression test: toCard's internal _spec field leaked into the product-detail/similar-products
  // endpoints (products.controller.js calls toCard() directly, never disambiguateTitles()) until this
  // was caught live on production right after merging. Never opt a caller into _spec by accident.
  test('toCard never includes the internal _spec field unless explicitly asked for', () => {
    const product = { _id: 'abc', title: 'X', altTitles: ['X - 8GB RAM 256GB ROM'], platforms: ['daraz'] };
    expect('_spec' in toCard(product, [])).toBe(false);
    expect('_spec' in toCard(product, [], { withSpec: true })).toBe(true);
  });

  test('distinguishingSpec pulls a RAM/storage spec from the product\'s own titles', () => {
    expect(distinguishingSpec({ title: 'Infinix Note 60', altTitles: ['Infinix Note 60 - 8GB RAM 256GB ROM'] })).toBe('8GB/256GB');
    expect(distinguishingSpec({ title: 'Infinix Note 60', altTitles: [] })).toBeNull();
  });

  test('appends the spec only to cards whose title collides with another in the same list', () => {
    const cards = [
      { title: 'Infinix Note 60', _spec: '8GB/256GB' },
      { title: 'Infinix Note 60', _spec: '12GB/512GB' },
      { title: 'Infinix Note 60 Pro', _spec: '8GB/256GB' }, // no collision - left alone
    ];
    disambiguateTitles(cards);
    expect(cards[0].title).toBe('Infinix Note 60 8GB/256GB');
    expect(cards[1].title).toBe('Infinix Note 60 12GB/512GB');
    expect(cards[2].title).toBe('Infinix Note 60 Pro');
    expect(cards.every((c) => !('_spec' in c))).toBe(true); // internal field never leaks into the response
  });

  test('a collision with no spec on either side is left as-is - nothing invented', () => {
    const cards = [{ title: 'Generic Gadget', _spec: null }, { title: 'Generic Gadget', _spec: null }];
    disambiguateTitles(cards);
    expect(cards[0].title).toBe('Generic Gadget');
    expect(cards[1].title).toBe('Generic Gadget');
  });

  test('end-to-end: two stored products with the same title get distinguished in a search result', async () => {
    const a = await Product.create({
      title: 'Infinix Note 60', brand: 'Infinix', category: 'mobiles', searchKey: 'infinixnote60', matchKey: 'dup-test-a',
      altTitles: ['Infinix Note 60 - 8GB RAM 256GB ROM'], minPrice: 100000, maxPrice: 100000, platforms: ['daraz'],
    });
    const b = await Product.create({
      title: 'Infinix Note 60', brand: 'Infinix', category: 'mobiles', searchKey: 'infinixnote60', matchKey: 'dup-test-b',
      altTitles: ['Infinix Note 60 - 12GB RAM 512GB ROM'], minPrice: 130000, maxPrice: 130000, platforms: ['daraz'],
    });
    await Listing.create({ productId: a._id, platform: 'daraz', externalId: 'dup-a', title: a.title, price: 100000, url: 'https://daraz.pk/a', currency: 'PKR', inStock: true, dataSource: 'live' });
    await Listing.create({ productId: b._id, platform: 'daraz', externalId: 'dup-b', title: b.title, price: 130000, url: 'https://daraz.pk/b', currency: 'PKR', inStock: true, dataSource: 'live' });

    const res = await get('q=infinix note 60&live=false');
    const titles = res.body.results.filter((r) => r.id === String(a._id) || r.id === String(b._id)).map((r) => r.title);
    expect(titles).toContain('Infinix Note 60 8GB/256GB');
    expect(titles).toContain('Infinix Note 60 12GB/512GB');

    await Product.deleteMany({ _id: { $in: [a._id, b._id] } });
    await Listing.deleteMany({ productId: { $in: [a._id, b._id] } });
  });
});

describe('live ingestion', () => {
  const daraz = [
    { platform: 'daraz', externalId: 'dz-1', title: 'Samsung Galaxy A55 5G - 8GB 256GB - PTA Approved', price: 118500, originalPrice: 130000, url: 'https://www.daraz.pk/products/a55-i1.html', image: 'https://img/a55.png', rating: 4.6, reviewCount: 120, currency: 'PKR', inStock: true },
    { platform: 'daraz', externalId: 'dz-2', title: 'Samsung Galaxy A55 Back Cover Case Transparent', price: 499, url: 'https://www.daraz.pk/products/case-i2.html', currency: 'PKR', reviewCount: 0, inStock: true },
    { platform: 'daraz', externalId: 'dz-3', title: 'Samsung Galaxy A57 5G 12GB 256GB', price: 163999, url: 'https://www.daraz.pk/products/a57-i3.html', currency: 'PKR', reviewCount: 0, inStock: true },
  ];

  test('keeps everything the store returned (nothing dropped), but only the exact model counts as a main result - accessories and other models are collapsed into "other"', async () => {
    const productsBefore = await Product.countDocuments();
    mockScrapers({ daraz, priceoye: async () => [] });
    const res = await get('q=samsung galaxy a55');
    expect(res.body.source).toBe('live');
    expect(res.body.total).toBe(1); // only the real A55 match
    expect(res.body.otherTotal).toBe(2); // the case and the A57: close/loose matches, not hidden, not counted as a result
    expect(res.body.platformStatus.daraz).toMatchObject({ scraped: 3, loaded: 3 }); // the store's own count is unaffected
    expect(res.body.results[0].title).toMatch(/A55/);
    expect(res.body.otherResults.map((r) => r.title).sort()).toEqual(['Samsung Galaxy A55 Back Cover Case Transparent', 'Samsung Galaxy A57 5G 12GB 256GB']);

    expect(await Product.countDocuments()).toBe(productsBefore + 2); // the phone joined the sample product; case and A57 are new
    const product = await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' });
    const listing = await Listing.findOne({ productId: product._id, platform: 'daraz' });
    // The sample Daraz listing was adopted by the live one, so its 90-day history is kept.
    expect(listing).toMatchObject({ externalId: 'dz-1', price: 118500, dataSource: 'live', seeded: false });
    expect(await PriceHistory.countDocuments({ listingId: listing._id })).toBe(91);
    expect(res.body.results[0].offers.find((o) => o.platform === 'daraz')).toMatchObject({ price: 118500, dataSource: 'live' });
  });

  test('creates a new product when nothing similar is stored', async () => {
    mockScrapers({
      daraz: [{ platform: 'daraz', externalId: 'dz-9', title: 'Tefal Easy Fry Dual Air Fryer 8.3L', price: 54999, url: 'https://www.daraz.pk/x', currency: 'PKR', reviewCount: 3, rating: 4.5, inStock: true }],
      priceoye: async () => [],
    });
    const res = await get('q=tefal air fryer');
    expect(res.body.total).toBe(1);
    expect(res.body.results[0]).toMatchObject({ title: 'Tefal Easy Fry Dual Air Fryer 8.3L', minPrice: 54999, category: 'home-appliances' });
  });

  test('ingesting the same listing twice does not duplicate rows', async () => {
    const { ingestListings } = require('../src/services/ingest');
    const l = { platform: 'priceoye', externalId: 'dup-1', title: 'Haylou GT1 Pro Earbuds', price: 4000, url: 'https://priceoye.pk/y', currency: 'PKR', reviewCount: 0, inStock: true };
    await ingestListings([l]);
    await ingestListings([l]);
    expect(await Listing.countDocuments({ platform: 'priceoye', externalId: 'dup-1' })).toBe(1);
    const doc = await Listing.findOne({ externalId: 'dup-1' });
    expect(await PriceHistory.countDocuments({ listingId: doc._id })).toBe(1); // unchanged price, same hour
  });
});

describe('PLAN.md item 4: search fix (strict relevance filter + "other models" group)', () => {
  const listing = (externalId, title, price) => ({ platform: 'daraz', externalId, title, price, url: `https://www.daraz.pk/${externalId}`, currency: 'PKR', reviewCount: 5, inStock: true });

  test('"iphone 15 pro max": wrong models (17/18 Pro Max) never appear in the main results', async () => {
    mockScrapers({
      daraz: [
        listing('ip15', 'Apple iPhone 15 Pro Max 256GB', 450000),
        listing('ip17', 'Apple iPhone 17 Pro Max 256GB', 500000),
        listing('ip18', 'Apple iPhone 18 Pro Max 256GB', 550000),
      ],
      priceoye: async () => [],
    });
    const res = await get('q=iphone 15 pro max');
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results.some((r) => /15 Pro Max/.test(r.title))).toBe(true);
    expect(res.body.results.some((r) => /17|18/.test(r.title))).toBe(false);
    expect(res.body.otherResults.some((r) => /17 Pro Max/.test(r.title))).toBe(true);
    expect(res.body.otherResults.some((r) => /18 Pro Max/.test(r.title))).toBe(true);
  });

  test('a typo ("ihpone 15") finds nothing confidently relevant, rather than surfacing an unrelated model as if it matched', async () => {
    mockScrapers({ daraz: [listing('ip18b', 'Apple iPhone 18 Pro Max 256GB', 550000)], priceoye: async () => [] });
    const res = await get('q=ihpone 15');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  test('"samsung a55" ranks the exact model and keeps the A57 out of the main results', async () => {
    mockScrapers({
      daraz: [listing('sa55', 'Samsung Galaxy A55 5G 8GB 256GB', 118500), listing('sa57', 'Samsung Galaxy A57 5G 12GB 256GB', 163999)],
      priceoye: async () => [],
    });
    const res = await get('q=samsung a55');
    expect(res.body.results.every((r) => !/A57/.test(r.title))).toBe(true);
    expect(res.body.results.some((r) => /A55/.test(r.title))).toBe(true);
    expect(res.body.otherResults.some((r) => /A57/.test(r.title))).toBe(true);
  });

  test('"rtx 4060" does not rank an RTX 4070 as a match', async () => {
    mockScrapers({
      daraz: [listing('gpu60', 'NVIDIA GeForce RTX 4060 8GB Graphics Card', 89999), listing('gpu70', 'NVIDIA GeForce RTX 4070 12GB Graphics Card', 139999)],
      priceoye: async () => [],
    });
    const res = await get('q=rtx 4060');
    expect(res.body.results.every((r) => !/4070/.test(r.title))).toBe(true);
    expect(res.body.results.some((r) => /4060/.test(r.title))).toBe(true);
    expect(res.body.otherResults.some((r) => /4070/.test(r.title))).toBe(true);
  });

  test('"macbook air m2" does not rank a MacBook Pro as a match', async () => {
    mockScrapers({
      daraz: [listing('mba', 'Apple MacBook Air M2 8GB 256GB', 289999), listing('mbp', 'Apple MacBook Pro M2 8GB 256GB', 349999)],
      priceoye: async () => [],
    });
    const res = await get('q=macbook air m2');
    expect(res.body.results.every((r) => !/MacBook Pro/.test(r.title))).toBe(true);
    expect(res.body.results.some((r) => /MacBook Air/.test(r.title))).toBe(true);
    expect(res.body.otherResults.some((r) => /MacBook Pro/.test(r.title))).toBe(true);
  });

  test('a nonexistent product returns an empty list, not an error', async () => {
    mockScrapers({ daraz: async () => [], priceoye: async () => [] });
    const res = await get('q=zzqqnonexistentwidget99');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, otherTotal: 0, results: [], otherResults: [] });
  });
});

describe('filters, sort and pagination (stored data)', () => {
  const stored = (qs) => get(`${qs}&live=false`);

  test('filters by platform', async () => {
    const res = await stored('q=samsung&platform=aliexpress');
    expect(res.body.total).toBeGreaterThan(0);
    res.body.results.forEach((r) => {
      expect(r.offers.every((o) => o.platform === 'aliexpress')).toBe(true);
      expect(r.platforms).toContain('aliexpress');
    });
  });

  test('filters by price range using the matching offers', async () => {
    const res = await stored('q=samsung&minPrice=10000&maxPrice=60000');
    expect(res.body.total).toBeGreaterThan(0);
    res.body.results.forEach((r) => {
      expect(r.minPrice).toBeGreaterThanOrEqual(10000);
      expect(r.maxPrice).toBeLessThanOrEqual(60000);
    });
  });

  test('filters by minimum rating', async () => {
    const res = await stored('q=sony&minRating=4.5');
    res.body.results.forEach((r) => expect(r.offers.every((o) => o.rating >= 4.5)).toBe(true));
  });

  test('sorts by price ascending and descending', async () => {
    const asc = (await stored('q=samsung&sort=price_asc')).body.results.map((r) => r.minPrice);
    const desc = (await stored('q=samsung&sort=price_desc')).body.results.map((r) => r.minPrice);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });

  test('paginates', async () => {
    const p1 = (await stored('q=samsung&pageSize=3&page=1')).body;
    const p2 = (await stored('q=samsung&pageSize=3&page=2')).body;
    expect(p1.results).toHaveLength(3);
    expect(p1.pages).toBeGreaterThan(1);
    expect(p2.results.map((r) => r.id)).not.toEqual(p1.results.map((r) => r.id));
  });

  test('exact-ish product query ranks the matching product first', async () => {
    const res = await stored('q=iphone 15 128gb');
    expect(res.body.results[0].title).toBe('Apple iPhone 15 128GB');
  });

  test('no match returns an empty list, not an error', async () => {
    const res = await stored('q=zzqqxx');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, results: [] });
  });
});

describe('relevance tolerance for spacing variants', () => {
  test.each([
    ['casio g-shock', 'Casio G Shock Square Digital Black Resin Watch', true],
    ['casio g-shock', 'Casio G-Shock GA-2100 Analog Digital Watch', true],
    ['ray-ban sunglasses', 'Ray Ban Wayfarer Classic Sunglasses', true],
    ['ray-ban sunglasses', 'Oakley Holbrook Sunglasses', false],
    ['air fryer', 'Digital Airfryer 6L', true],
    ['air fryer', 'Air Purifier HEPA', false],
  ])('%s vs %s -> %s', (q, title, expected) => expect(isRelevant(parseQuery(q), title)).toBe(expected));
});

describe('model codes with hyphens', () => {
  test.each(['sony wh-1000xm5', 'sony wh1000xm5', 'wh-1000xm5 headphones', 'WH 1000XM5'.replace(' 1000', '-1000')])('"%s" finds the stored product', async (q) => {
    const res = await get(`q=${encodeURIComponent(q)}&live=false`);
    expect(res.body.results[0].title).toBe('Sony WH-1000XM5 Wireless Headphones');
  });

  test('backfill adds search keys to products stored without one', async () => {
    const { backfillSearchKeys } = require('../src/services/productStats');
    await Product.updateMany({}, { $unset: { searchKey: 1, altTitles: 1 } });
    expect(await backfillSearchKeys()).toBeGreaterThan(80);
    expect(await backfillSearchKeys()).toBe(0);
    const res = await get('q=sony wh-1000xm5&live=false');
    expect(res.body.total).toBeGreaterThan(0);
  });
});

describe('items that only say what phone they fit are not the phone', () => {
  const rel = (q, title) => isRelevant(parseQuery(q), title);
  test.each([
    ['iphone 15 pro max', 'Mini Pearl Handbag for iPhone 15 Pro Max', false],
    ['iphone 15 pro max', 'Camera Lens Kit compatible with iPhone 15 Pro Max', false],
    ['iphone 15 pro max', 'For iPhone 15 Pro Max Dust Plug Kit', false],
    ['iphone 15 pro max', 'Apple iPhone 15 Pro Max 256GB', true],
    ['iphone 15 pro max', 'Apple iPhone 15 Pro Max 256GB PTA Approved for Pakistan', true], // "for" comes after the model
    ['hp victus 15', 'Laptop Bag for HP Victus 15', false],
    ['hp victus 15', 'HP Victus 15 Core i5 for Gaming', true],
    ['mens sneakers', 'Sneakers for Men Casual', true], // no model number in the query: unaffected
    ['iphone 15 pro max cover', 'Cover for iPhone 15 Pro Max', true], // accessory query: accessories wanted
    ['iphone 15 charger', 'Fast Charger for iPhone 15', true],
  ])('%s vs "%s" -> %s', (q, title, expected) => expect(rel(q, title)).toBe(expected));
});

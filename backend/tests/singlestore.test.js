// Core rule: if ANY store has a product matching the search, it is shown, even when no other store carries
// it. Accessory words are a preference, not a requirement. Regression tests for the "iphone 15 pro max
// cover" bug (found 0 results although Daraz sells dozens of matching covers) and the pipeline audit.
const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const { seedDatabase } = require('../src/seed/seed');
const { ingestListings } = require('../src/services/ingest');
const { localSearch } = require('../src/services/search');
const { parseQuery, isRelevant } = require('../src/services/relevance');
const { queryVariants } = require('../src/services/gather');
const { Product, Listing, SearchCache } = require('../src/models');
const { startDb, stopDb } = require('./helpers');

let app;
let seq = 0;

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

const listing = (platform, title, price = 999) => {
  seq += 1;
  return { platform, externalId: `${platform}-rt-${seq}`, title, url: `https://example.com/${platform}/${seq}`, price, currency: 'PKR', reviewCount: 0, inStock: true };
};
const stores = ({ daraz = () => [], priceoye = () => [] }) => {
  jest.spyOn(scrapers.adapters.daraz, 'search').mockImplementation(async (q, opts) => daraz(q, opts));
  jest.spyOn(scrapers.adapters.priceoye, 'search').mockImplementation(async (q, opts) => priceoye(q, opts));
};
const search = (q) => request(app).get(`/api/search?q=${encodeURIComponent(q)}&pageSize=48`);
const titles = (res) => res.body.results.map((r) => r.title);
const storesOf = (card) => card.offers.map((o) => o.platform);
// The result card (if any) of the product that owns the stored listing with this exact title.
async function cardFor(res, listingTitle) {
  const l = await Listing.findOne({ title: listingTitle }).lean();
  return l ? res.body.results.find((r) => r.id === String(l.productId)) : undefined;
}

describe('"iphone 15 pro max cover": the reported bug', () => {
  // Daraz ranks generic covers first for the word "cover", and the matching ones only for "case".
  const junk = ['Phone Case For 7/8 + / 11 / 12 Models', 'Customized Mobile Cover with Picture', 'Soft Jelly cover Real me 9 Pro Plus', 'Moto Edge 2021 Armor Case', 'WATERPROOF MOBILE COVER'];
  const matching = [
    '15 PROMAX AND 15 PRO liquid silicone cases mobile phone cover',
    'Euroo Transparent soft silicone cover for 15 Pro Max 15 Pro 15 Plus',
    'iPhone15promax Matte Back Cover',
    'Phone 15 Pro Max / Phone 15 Pro _ Bumper Transparent Back Cover Soft TPU',
    'KZDOO Leather Case for Apple iPhone 15 Pro Max',
  ];
  const daraz = (q) => (q.includes('case') ? matching : junk).map((t, i) => listing('daraz', t, 500 + i));

  test('is found through an alternative phrasing and shown as single-store results', async () => {
    stores({ daraz });
    const res = await search('iphone 15 pro max cover');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('live');
    expect(res.body.total).toBeGreaterThanOrEqual(matching.length);
    for (const t of matching) expect(await cardFor(res, t)).toBeTruthy(); // each matching listing is represented
    res.body.results.forEach((card) => expect(storesOf(card)).toEqual(['daraz']));
    expect(res.body.platformStatus.daraz.queries).toEqual(expect.arrayContaining(['iphone 15 pro max cover', 'iphone 15 pro max case']));
    expect(res.body.platformStatus.daraz).toMatchObject({ status: 'success', relevant: matching.length });
    expect(res.body.platformStatus.priceoye.status).toBe('success'); // nothing there: not an error
  });

  test('junk covers for other phones are not shown', async () => {
    stores({ daraz });
    const res = await search('iphone 15 pro max cover');
    for (const t of junk) expect(await cardFor(res, t)).toBeUndefined();
  });

  test('queries differing in spacing, case and word order give the same products', async () => {
    stores({ daraz });
    const base = new Set(titles(await search('iphone 15 pro max cover')));
    for (const q of ['IPHONE 15PROMAX COVER', 'iphone15promax cover', 'cover pro max 15 iphone']) {
      await SearchCache.deleteMany({});
      stores({ daraz });
      const res = await search(q);
      expect(titles(res).sort()).toEqual([...base].sort());
    }
  });
});

describe('accessory queries: results from a single store are never dropped', () => {
  const cases = [
    { q: 'samsung a15 case', found: ['Samsung Galaxy A15 Silicone Case', 'Spigen Tough Armor Case for Samsung A15 5G'], absent: ['Samsung Galaxy A25 Case'] },
    { q: 'airpods pro case', found: ['AirPods Pro 2 Silicone Case Cover', 'Apple AirPods Pro Protective Case with Hook'], absent: ['Samsung Galaxy Buds Case'] },
    { q: 'iphone 15 charger', found: ['Apple 20W USB-C Fast Charger for iPhone 15', '65W GaN Wall Charger For iPhone 15 14 13'], absent: ['Samsung 25W Charger for Galaxy S24'] },
    { q: 'laptop sleeve 15 inch', found: ['HP 15.6 Inch Reversible Neoprene Sleeve for Laptop', 'Laptop Sleeve 15 Inch With Handle'], absent: ['Laptop Sleeve 13 Inch Slim'] },
    { q: 'apple watch strap', found: ['Apple Watch Silicone Strap Band 44mm', 'Leather Strap for Apple Watch Series 10'], absent: ['Samsung Galaxy Watch Strap 20mm'] },
  ];

  test.each(cases)('$q', async ({ q, found, absent }) => {
    // one store has the products; the other store has nothing at all
    stores({ daraz: () => [...found, ...absent].map((t, i) => listing('daraz', t, 300 + i)) });
    const res = await search(q);
    expect(res.status).toBe(200);
    for (const t of found) {
      const card = await cardFor(res, t);
      expect(card).toBeTruthy();
      expect(storesOf(card)).toEqual(['daraz']); // a single-store product is a result in its own right
    }
    for (const t of absent) expect(await cardFor(res, t)).toBeUndefined();
    // titles holding the accessory word come first (preference, not requirement)
    const word = parseQuery(q).accessoryWords[0];
    expect(titles(res)[0].toLowerCase()).toContain(word === 'sleeve' ? 'sleeve' : word);
    expect(res.body.results.filter((r) => storesOf(r).length === 1).length).toBeGreaterThanOrEqual(found.length);
  });

  test('accessory words are only a preference: a matching phone is not hidden, but ranks after the accessories', async () => {
    stores({ daraz: () => [listing('daraz', 'Apple 20W USB-C Fast Charger for iPhone 15', 3500)], priceoye: () => [] });
    const res = await search('iphone 15 charger');
    expect(titles(res)[0]).toMatch(/Charger/i);
    expect(titles(res).some((t) => /Apple iPhone 15 128GB/.test(t))).toBe(true); // seeded phone: still listed
  });
});

describe('one store only', () => {
  test('a product on a single store (PriceOye) is its own result', async () => {
    stores({ priceoye: () => [listing('priceoye', 'Tecno Camon 40 Pro 8GB 256GB', 62999)] });
    const res = await search('tecno camon 40');
    const card = res.body.results.find((r) => /Camon 40 Pro/.test(r.title));
    expect(card).toBeTruthy();
    expect(card.platforms).toEqual(['priceoye']);
    expect(card.offers).toHaveLength(1);

    // the compare view data lists only the store that has it (the UI shows "not available" for the others)
    const cmp = await request(app).get(`/api/compare?ids=${card.id}`);
    expect(cmp.body.products[0].listings.map((l) => l.platform)).toEqual(['priceoye']);
  });

  test('a product on a single store (Daraz) is its own result', async () => {
    stores({ daraz: () => [listing('daraz', 'Zong 4G MiFi Bolt Plus Device Unlocked', 8999)] });
    const res = await search('zong mifi bolt');
    expect(res.body.results.find((r) => /MiFi Bolt/.test(r.title)).platforms).toEqual(['daraz']);
  });

  test('a failing store never hides what the other store found', async () => {
    stores({
      daraz: () => {
        throw Object.assign(new Error('blocked'), { code: 'BLOCKED' });
      },
      priceoye: () => [listing('priceoye', 'Itel S25 Ultra 8GB 256GB', 41999)],
    });
    const res = await search('itel s25 ultra');
    expect(res.body.source).toBe('live');
    expect(res.body.platformStatus.daraz.status).toBe('failed');
    expect(titles(res).some((t) => /S25 Ultra/.test(t))).toBe(true);
  });

  test('a product found on a store with no match on the other is not merged away', async () => {
    stores({
      daraz: () => [listing('daraz', 'Oraimo FreePods 4 ANC Earbuds', 9999)],
      priceoye: () => [listing('priceoye', 'Oraimo FreePods 4 ANC Earbuds Black', 9499), listing('priceoye', 'Oraimo OpenBuds Pro Earbuds', 14999)],
    });
    const res = await search('oraimo earbuds');
    expect(titles(res).some((t) => /OpenBuds/.test(t))).toBe(true); // PriceOye-only product
    const shared = res.body.results.find((r) => /FreePods/.test(r.title));
    expect(storesOf(shared).sort()).toEqual(['daraz', 'priceoye']); // same product on both stores is grouped
  });

  test('a seeded product on one store is found in browsing and search', async () => {
    const cat = await request(app).get('/api/search?category=home-appliances&pageSize=48&live=false');
    const anex = cat.body.results.find((r) => /Anex/.test(r.title));
    expect(anex.platforms).toEqual(['daraz']);
    expect(cat.body.total).toBe(15);
    const s = await request(app).get('/api/search?q=anex blender&live=false');
    expect(s.body.results[0].title).toMatch(/Anex/);
  });
});

describe('pipeline audit', () => {
  test('a search that found nothing is only cached briefly', async () => {
    stores({});
    const first = await search('zzy flurbo gadget');
    expect(first.body.total).toBe(0);
    // the store gets the product a little later; once the short empty-result window is over it appears
    stores({ daraz: () => [listing('daraz', 'Zzy Flurbo Gadget Pro', 1234)] });
    await SearchCache.updateMany({}, { fetchedAt: new Date(Date.now() - config.search.emptyCacheTtlMs - 1000) });
    const second = await search('zzy flurbo gadget');
    expect(second.body.source).toBe('live');
    expect(titles(second)).toContain('Zzy Flurbo Gadget Pro');
  });

  test('every relevant listing of a full store page is kept (no cap below one page)', async () => {
    const page = Array.from({ length: 40 }, (_, i) => listing('daraz', `Quasar Widget Model ${100 + i}X Special Edition`, 1000 + i));
    stores({ daraz: () => page });
    const res = await search('quasar widget');
    expect(res.body.platformStatus.daraz.relevant).toBe(40);
    expect(res.body.total).toBe(40);
  });

  test('time budget: what was found before the deadline is still shown', async () => {
    const saved = config.search.liveBudgetMs;
    config.search.liveBudgetMs = 300;
    stores({
      daraz: () => [listing('daraz', 'Budget Test Gizmo 5000', 500)],
      priceoye: () => new Promise((resolve) => setTimeout(() => resolve([]), 2000)),
    });
    const res = await search('budget test gizmo');
    config.search.liveBudgetMs = saved;
    expect(titles(res)).toContain('Budget Test Gizmo 5000');
    expect(res.body.platformStatus.priceoye).toMatchObject({ code: 'BUDGET', error: expect.stringMatching(/time limit/i) });
  });

  test('a product buried below the first page is found on a later page', async () => {
    // page 1 is a full page of straps (dropped: the query did not ask for accessories); the watches are on pages 2 and 3
    const straps = Array.from({ length: 40 }, (_, i) => listing('daraz', `Amazfit GTS ${i} Watch Strap Band`, 300));
    const filler = (n) => Array.from({ length: n }, (_, i) => listing('daraz', `Unrelated Gadget ${i}`, 100));
    const daraz = jest.fn((q, o) => {
      if (o && o.page === 2) return [listing('daraz', 'Amazfit GTS 4 Smart Watch', 16999), ...filler(24)];
      if (o && o.page === 3) return [listing('daraz', 'Amazfit GTS 2 Mini Smart Watch', 12999), ...filler(24)];
      return straps;
    });
    stores({ daraz });
    const res = await search('amazfit gts');
    expect(titles(res)).toEqual(expect.arrayContaining(['Amazfit GTS 4 Smart Watch', 'Amazfit GTS 2 Mini Smart Watch']));
    expect(res.body.platformStatus.daraz.queries).toEqual(expect.arrayContaining(['amazfit gts (page 2)', 'amazfit gts (page 3)']));
    res.body.results.forEach((c) => expect(c.title).not.toMatch(/Strap/)); // accessories still dropped for a non-accessory query
  });

  test('no extra pages or phrasings are requested when the first page already has enough', async () => {
    const page = Array.from({ length: 40 }, (_, i) => listing('daraz', `Quasar Gizmo ${i} Deluxe`, 100 + i));
    const daraz = jest.fn(() => page);
    stores({ daraz });
    await search('quasar gizmo');
    expect(daraz).toHaveBeenCalledTimes(1);
  });

  test('pages are not fetched after a store error, and never more than four requests per store', async () => {
    const fail = jest.fn(() => { throw Object.assign(new Error('blocked'), { code: 'BLOCKED' }); });
    stores({ daraz: fail });
    await search('nothing blocked here');
    expect(fail).toHaveBeenCalledTimes(1);

    const junk = jest.fn(() => Array.from({ length: 40 }, (_, i) => listing('daraz', `Totally Different Item ${i}`, 50)));
    stores({ daraz: junk });
    await search('iphone 15 pro max cover');
    expect(junk.mock.calls.length).toBeLessThanOrEqual(4);
  });

  test('query phrasings: synonyms, and the family word dropped', () => {
    expect(queryVariants('iphone 15 pro max cover')).toEqual(['iphone 15 pro max cover', 'iphone 15 pro max case', '15 pro max cover']);
    expect(queryVariants('airpods pro case')).toContain('airpods pro cover');
    expect(queryVariants('samsung galaxy a55')).toEqual(['samsung galaxy a55', 'samsung a55']);
    expect(queryVariants('air fryer')).toEqual(['air fryer']);
  });

  // The database pre-filter must never be stricter than the relevance check: for every (query, title) pair
  // that isRelevant accepts, a product with that title must be found by the full local search.
  const accepted = [
    ['iphone 15 pro max cover', 'iPhone15promax Matte Back Cover'],
    ['iphone 15 pro max cover', '15 PROMAX Clear Case'],
    ['laptop sleeve 15 inch', 'Laptop Sleeve Bag 15.6 inch Waterproof'],
    ['laptop sleeve 15 inch', 'Neoprene Sleeve 15" for MacBook'],
    ['wireless headphones', 'Foldable Wireless Headphone Bluetooth 5.3'],
    ['wireless headphone', 'Pro Wireless Headphones With Mic'],
    ['air fryer', 'Digital Airfryer 6L Oil Free'],
    ['casio g-shock', 'Casio G Shock Square Digital Resin Watch'],
    ['ray-ban sunglasses', 'Ray Ban Wayfarer Classic Sunglasses'],
    ['samsung a15 case', 'Galaxy A15 Slim Case'],
    ['apple watch strap', 'Silicone Strap for Apple Watch Ultra 49mm'],
    ['redmi note 14', 'Xiaomi Redmi Note14 Pro 8GB 256GB'],
  ];

  test.each(accepted)('query "%s" finds a stored product titled "%s"', async (q, title) => {
    const parsed = parseQuery(q);
    expect(isRelevant(parsed, title)).toBe(true); // the precise check accepts it...
    const { productIds } = await ingestListings([listing('daraz', title, 777)]);
    const found = await localSearch(parsed);
    expect(found.map((p) => String(p._id))).toContain(productIds[0]); // ...so the pipeline must not lose it
    expect(await Product.countDocuments({ _id: productIds[0] })).toBe(1);
  });
});

describe('refresh: check the stores again', () => {
  test('an earlier live result is reused only until the user asks to refresh', async () => {
    const calls = jest.fn(() => [listing('daraz', 'Refresh Test Gadget Pro 3000', 1500)]);
    stores({ daraz: calls });
    const first = await search('refresh test gadget');
    expect(first.body.source).toBe('live');
    const afterFirst = calls.mock.calls.length;

    const again = await search('refresh test gadget');
    expect(again.body.source).toBe('cache');
    expect(calls.mock.calls.length).toBe(afterFirst); // reused, no scraping

    const refreshed = await request(app).get('/api/search?q=refresh test gadget&refresh=true');
    expect(refreshed.body.source).toBe('live');
    expect(calls.mock.calls.length).toBeGreaterThan(afterFirst); // the stores were asked again
    expect(refreshed.body.demoMode).toBe(false);
  });

  test('a refresh picks up a price change from the store', async () => {
    let price = 2000;
    stores({ daraz: () => [{ ...listing('daraz', 'Refresh Price Widget X1', price), externalId: 'fixed-id-1' }] });
    const first = await search('refresh price widget');
    expect(first.body.results[0].minPrice).toBe(2000);
    price = 1800;
    const refreshed = await request(app).get('/api/search?q=refresh price widget&refresh=true');
    expect(refreshed.body.results[0].minPrice).toBe(1800);
  });

  test('the reuse window is 15 minutes by default', () => {
    expect(config.search.cacheTtlMs).toBe(15 * 60 * 1000);
  });

  test('refresh in demo mode never scrapes and reports demoMode', async () => {
    config.demoMode = true;
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    const res = await request(app).get('/api/search?q=airpods pro&refresh=true');
    expect(res.body).toMatchObject({ source: 'fallback', demoMode: true });
    expect(spy).not.toHaveBeenCalled();
  });

  test('an invalid refresh value is rejected', async () => {
    expect((await request(app).get('/api/search?q=airpods&refresh=maybe')).status).toBe(400);
  });
});

describe('why a store could not be reached is reported, and Refresh can recover', () => {
  const timeout = () => {
    throw Object.assign(new Error('Timed out after 8000 ms'), { code: 'TIMEOUT' });
  };

  test('each failing store reports its own reason code', async () => {
    stores({ daraz: timeout, priceoye: () => { throw Object.assign(new Error('Blocked by platform (HTTP 403)'), { code: 'BLOCKED' }); } });
    const res = await search('reason code gadget');
    expect(res.body.source).toBe('fallback');
    expect(res.body.platformStatus.daraz).toMatchObject({ status: 'failed', code: 'TIMEOUT', error: expect.stringMatching(/Timed out/) });
    expect(res.body.platformStatus.priceoye).toMatchObject({ status: 'failed', code: 'BLOCKED' });
  });

  test('after repeated failures a store is paused; a normal search says so, Refresh tries again', async () => {
    const daraz = jest.fn(timeout);
    stores({ daraz });
    for (let i = 0; i < 3; i += 1) await search(`flaky gadget ${i}`); // three failures in a row trips the breaker
    const paused = await search('flaky gadget again');
    expect(paused.body.platformStatus.daraz).toMatchObject({ status: 'skipped', code: 'CIRCUIT_OPEN', error: expect.stringMatching(/paused for about \d+ more minute/) });
    const callsWhilePaused = daraz.mock.calls.length;
    await search('flaky gadget once more');
    expect(daraz.mock.calls.length).toBe(callsWhilePaused); // nothing was sent while paused

    // the store has recovered; the user presses "Refresh from stores"
    stores({ daraz: () => [listing('daraz', 'Flaky Gadget Pro Recovered', 4321)] });
    const refreshed = await request(app).get('/api/search?q=flaky gadget again&refresh=true&pageSize=48');
    expect(refreshed.body.source).toBe('live');
    expect(refreshed.body.platformStatus.daraz.status).toBe('success');
    expect(refreshed.body.results.map((r) => r.title)).toContain('Flaky Gadget Pro Recovered');
  });

  test('/api/platforms exposes the last error and circuit state for diagnosis', async () => {
    stores({ daraz: timeout });
    await search('platform status gadget');
    const res = await request(app).get('/api/platforms');
    const daraz = res.body.platforms.find((p) => p.id === 'daraz');
    expect(daraz).toMatchObject({ circuit: 'closed', lastError: { code: 'TIMEOUT', message: expect.stringMatching(/Timed out/) } });
  });
});

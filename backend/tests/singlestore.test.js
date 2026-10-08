// Live search mirrors the stores: whatever Daraz or PriceOye return for the query is shown, nothing is
// filtered out, results from a single store are results in their own right, and more are loaded on demand.
// Regression tests for the "iphone 15 pro max cover" / "iphone 16 pro max" reports (we showed 0-1 results
// while the store showed thousands).
const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const { seedDatabase } = require('../src/seed/seed');
const { ingestListings } = require('../src/services/ingest');
const { localSearch } = require('../src/services/search');
const { parseQuery, isRelevant } = require('../src/services/relevance');
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

const listing = (platform, title, price = 999, extra = {}) => {
  seq += 1;
  return { platform, externalId: `${platform}-rt-${seq}`, title, url: `https://example.com/${platform}/${seq}`, price, currency: 'PKR', reviewCount: 0, inStock: true, ...extra };
};
// adapters answer like a store: an array of listings carrying { total, pageSize } for paging
const withMeta = (items, meta = { total: items.length, pageSize: 40 }) => Object.assign([...items], { meta });
const stores = ({ daraz = () => [], priceoye = () => [] }) => {
  jest.spyOn(scrapers.adapters.daraz, 'search').mockImplementation(async (q, opts) => daraz(q, opts));
  jest.spyOn(scrapers.adapters.priceoye, 'search').mockImplementation(async (q, opts) => priceoye(q, opts));
};
const search = (q, extra = '') => request(app).get(`/api/search?q=${encodeURIComponent(q)}&limit=100${extra}`);
const titles = (res) => res.body.results.map((r) => r.title);
const storesOf = (card) => card.offers.map((o) => o.platform);
// The result card (if any) of a product that owns a stored listing with this exact title. Titles repeat
// across tests, so every listing with the title is considered.
async function cardFor(res, listingTitle) {
  const ids = new Set((await Listing.find({ title: listingTitle }).select('productId').lean()).map((l) => String(l.productId)));
  return res.body.results.find((r) => ids.has(r.id));
}

describe('nothing is filtered: the results are what the store returns', () => {
  const phones = ['Apple iPhone 16 Pro Max - 256GB', 'Apple iPhone 16 Pro Max - 512GB'];
  const accessories = ['Back Cover For iPhone 16 Pro Max', 'Unbreakable membrane Sheet for 360 Protection Sheet For 16 Pro / 16 Pro Max', 'Mini Pearl Handbag for iPhone 16 Pro Max', 'Converter Sheet 14 -15', 'Totally unrelated gadget'];

  test('every item the store returns is shown, including accessories and loosely related items', async () => {
    const all = [...accessories, ...phones];
    stores({ daraz: () => withMeta(all.map((t, i) => listing('daraz', t, 300 + i))) });
    const res = await search('iphone 16 pro max');
    expect(res.body.mode).toBe('live');
    expect(res.body.total).toBe(all.length);
    for (const t of all) expect(await cardFor(res, t)).toBeTruthy();
  });

  test('the best matches are ranked first (ranking only, nothing is dropped)', async () => {
    stores({ daraz: () => withMeta([...accessories, ...phones].map((t, i) => listing('daraz', t, 300 + i))) });
    const res = await search('iphone 16 pro max');
    const phone = await cardFor(res, phones[0]);
    const junk = await cardFor(res, 'Totally unrelated gadget');
    expect(res.body.results.indexOf(phone)).toBeLessThan(res.body.results.indexOf(junk));
    expect(res.body.results.slice(0, 2).every((r) => /iPhone 16 Pro Max/.test(r.title))).toBe(true);
  });

  test('"iphone 15 pro max cover": covers from the store are all shown, single-store', async () => {
    const covers = ['15 PROMAX AND 15 PRO liquid silicone cases mobile phone cover', 'iPhone15promax Matte Back Cover', 'Phone Case For 7/8 + / 11 / 12 Models', 'Customized Mobile Cover with Picture', 'WATERPROOF MOBILE COVER'];
    stores({ daraz: () => withMeta(covers.map((t, i) => listing('daraz', t, 500 + i))) });
    const res = await search('iphone 15 pro max cover');
    expect(res.body.total).toBe(covers.length);
    for (const t of covers) expect(await cardFor(res, t)).toBeTruthy();
    res.body.results.forEach((card) => expect(storesOf(card)).toEqual(['daraz']));
    // the covers that name the phone come before the generic ones
    const first = (await cardFor(res, covers[0])).id;
    const generic = (await cardFor(res, 'WATERPROOF MOBILE COVER')).id;
    const ids = res.body.results.map((r) => r.id);
    expect(ids.indexOf(first)).toBeLessThan(ids.indexOf(generic));
  });

  test.each(['samsung a15 case', 'airpods pro case', 'iphone 15 charger', 'laptop sleeve 15 inch', 'apple watch strap'])('accessory query "%s": all results of a single store are shown', async (q) => {
    const items = [`${q} Premium Edition`, 'Some Other Listing', 'Another Seller Listing', 'Yet Another One'].map((t, i) => listing('daraz', t, 200 + i));
    stores({ daraz: () => withMeta(items) });
    const res = await search(q);
    expect(res.body.total).toBe(items.length);
    for (const l of items) expect(await cardFor(res, l.title)).toBeTruthy();
    expect(titles(res)[0]).toContain('Premium'); // the one that matches the words ranks first
  });

  test('spacing, case and word order do not change what is shown', async () => {
    const items = ['iPhone15promax Matte Back Cover', '15 PROMAX Clear Case', 'Unrelated Thing'].map((t, i) => listing('daraz', t, 100 + i));
    const seen = [];
    for (const q of ['iphone 15 pro max cover', 'IPHONE 15PROMAX COVER', 'cover pro max 15 iphone']) {
      await SearchCache.deleteMany({});
      stores({ daraz: () => withMeta(items) });
      const res = await search(q);
      expect(res.body.total).toBe(3);
      seen.push(titles(res).slice(0, 2).sort());
    }
    expect(seen[1]).toEqual(seen[0]);
    expect(seen[2]).toEqual(seen[0]);
  });
});

describe('same store never merged; different stores grouped for comparison', () => {
  test('two listings of the same (non-marketplace) store with the same title are separate results', async () => {
    // PriceOye is not in MULTI_SELLER_PLATFORMS, so the plain "one listing per store per product" rule
    // still applies there. Daraz's own version of this rule is covered separately below, now that it
    // allows several sellers (see docs/MULTI_SELLER_PLAN.md).
    stores({ priceoye: () => withMeta([listing('priceoye', 'Apple iPhone 16 Pro Max 256GB', 540000), listing('priceoye', 'Apple iPhone 16 Pro Max 256GB', 555000), listing('priceoye', 'Apple iPhone 16 Pro Max 256GB', 560000)]) });
    const res = await search('iphone 16 pro max');
    expect(res.body.total).toBe(3);
    res.body.results.forEach((c) => expect(storesOf(c)).toEqual(['priceoye']));
  });

  test('several different Daraz sellers for the same item attach to one product, as separate offers', async () => {
    stores({
      daraz: () =>
        withMeta([
          listing('daraz', 'Samsung Galaxy A55 5G 8GB 256GB', 127000, { sellerId: 'seller-1', sellerName: 'Smart Phone Line', sellerLocation: 'Punjab' }),
          listing('daraz', 'Samsung Galaxy A55 5G 8GB 256GB', 172999, { sellerId: 'seller-2', sellerName: 'Combine Communication', sellerLocation: 'Punjab' }),
        ]),
    });
    const res = await search('samsung galaxy a55');
    expect(res.body.total).toBe(1); // one product, not two
    const daraz = await Listing.find({ platform: 'daraz', title: 'Samsung Galaxy A55 5G 8GB 256GB' }).lean();
    expect(daraz).toHaveLength(2);
    expect(daraz.map((l) => l.sellerName).sort()).toEqual(['Combine Communication', 'Smart Phone Line']);
    expect(res.body.results[0].minPrice).toBe(127000); // the true minimum across both sellers
  });

  test('a second Daraz seller does not attach to a genuinely different variant', async () => {
    stores({
      daraz: () =>
        withMeta([
          listing('daraz', 'Samsung Galaxy A55 5G 128GB', 110000, { sellerId: 'seller-1', sellerName: 'Seller One' }),
          listing('daraz', 'Samsung Galaxy A55 5G 256GB', 135000, { sellerId: 'seller-2', sellerName: 'Seller Two' }),
        ]),
    });
    const res = await search('samsung galaxy a55');
    expect(res.body.total).toBe(2); // different storage: two separate products, not merged as "two sellers"
  });

  test('re-scraping the same Daraz seller updates that listing instead of adding another offer', async () => {
    const item = { ...listing('daraz', 'Restock Gadget Pro', 5000, { sellerId: 'seller-1', sellerName: 'Original Seller' }), externalId: 'dz-reseller-1' };
    stores({ daraz: () => withMeta([item]) });
    await search('restock gadget');
    stores({ daraz: () => withMeta([{ ...item, price: 4500 }]) });
    await request(app).get('/api/search?q=restock gadget&refresh=true&limit=100');
    const daraz = await Listing.find({ platform: 'daraz', externalId: 'dz-reseller-1' }).lean();
    expect(daraz).toHaveLength(1);
    expect(daraz[0].price).toBe(4500);
  });

  test('the same product on both stores is one result with two offers', async () => {
    stores({
      daraz: () => withMeta([listing('daraz', 'Oraimo FreePods 4 ANC Earbuds', 9999)]),
      priceoye: () => withMeta([listing('priceoye', 'Oraimo FreePods 4 ANC Earbuds Black', 9499), listing('priceoye', 'Oraimo OpenBuds Pro Earbuds', 14999)]),
    });
    const res = await search('oraimo earbuds');
    expect(res.body.total).toBe(2);
    const shared = res.body.results.find((r) => /FreePods/.test(r.title));
    expect(storesOf(shared).sort()).toEqual(['daraz', 'priceoye']);
    expect(titles(res).some((t) => /OpenBuds/.test(t))).toBe(true); // PriceOye-only product is not dropped
  });

  test('a listing that is already stored keeps its product when seen again', async () => {
    const item = listing('daraz', 'Stable Identity Gadget X9', 1234);
    stores({ daraz: () => withMeta([item]) });
    const first = await search('stable identity gadget');
    const again = await request(app).get('/api/search?q=stable identity gadget&refresh=true&limit=100');
    expect(again.body.results.map((r) => r.id)).toEqual(first.body.results.map((r) => r.id));
    expect(await Listing.countDocuments({ externalId: item.externalId })).toBe(1);
  });

  test('a stored sample product adopts the first live listing of its store, keeping its price history', async () => {
    const before = await Product.countDocuments();
    stores({ daraz: () => withMeta([{ ...listing('daraz', 'Samsung Galaxy A55 5G - 8GB 256GB - PTA Approved', 118500), externalId: 'dz-adopt-1' }]) });
    const res = await search('samsung galaxy a55');
    expect(await Product.countDocuments()).toBe(before); // grouped into the sample product, not duplicated
    const product = await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' });
    const adopted = await Listing.findOne({ productId: product._id, platform: 'daraz' });
    expect(adopted).toMatchObject({ externalId: 'dz-adopt-1', price: 118500, dataSource: 'live', seeded: false });
    const { PriceHistory } = require('../src/models');
    expect(await PriceHistory.countDocuments({ listingId: adopted._id })).toBe(91);
    expect(res.body.results[0].offers.find((o) => o.platform === 'daraz')).toMatchObject({ price: 118500, dataSource: 'live' });
  });
});

describe('one store only', () => {
  test('a product on a single store (PriceOye) is its own result and the compare data lists only that store', async () => {
    stores({ priceoye: () => withMeta([listing('priceoye', 'Tecno Camon 40 Pro 8GB 256GB', 62999)]) });
    const res = await search('tecno camon 40');
    const card = res.body.results.find((r) => /Camon 40 Pro/.test(r.title));
    expect(card.platforms).toEqual(['priceoye']);
    const cmp = await request(app).get(`/api/compare?ids=${card.id}`);
    expect(cmp.body.products[0].listings.map((l) => l.platform)).toEqual(['priceoye']);
  });

  test('a failing store never hides what the other store found', async () => {
    stores({
      daraz: () => {
        throw Object.assign(new Error('blocked'), { code: 'BLOCKED' });
      },
      priceoye: () => withMeta([listing('priceoye', 'Itel S25 Ultra 8GB 256GB', 41999)]),
    });
    const res = await search('itel s25 ultra');
    expect(res.body.source).toBe('live');
    expect(res.body.platformStatus.daraz).toMatchObject({ status: 'failed', code: 'BLOCKED' });
    expect(titles(res).some((t) => /S25 Ultra/.test(t))).toBe(true);
  });

  test('a seeded product on one store is found in browsing and search', async () => {
    const cat = await request(app).get('/api/search?category=home-appliances&pageSize=48&live=false');
    expect(cat.body.results.find((r) => /Anex/.test(r.title)).platforms).toEqual(['daraz']);
    expect(cat.body.total).toBe(15);
    const s = await request(app).get('/api/search?q=anex blender&live=false');
    expect(s.body.results[0].title).toMatch(/Anex/);
  });
});

describe('paging through the store: "Show more"', () => {
  const page = (platform, n, from, meta) => withMeta(Array.from({ length: n }, (_, i) => listing(platform, `Zephyr Gadget ${from + i} Unique Item`, 1000 + from + i)), meta);

  test('loads further store pages only when more results are asked for, and reports the store totals', async () => {
    const daraz = jest.fn((q, o) => {
      const p = (o && o.page) || 1;
      return page('daraz', p === 3 ? 20 : 40, (p - 1) * 40, { total: 100, pageSize: 40 });
    });
    const priceoye = jest.fn(() => withMeta([], { total: 0, pageSize: 24 }));
    stores({ daraz, priceoye });

    const first = await request(app).get('/api/search?q=zephyr gadget&limit=24');
    expect(daraz.mock.calls.map((c) => c[1].page)).toEqual([1]); // one store page covers 24 results
    expect(first.body).toMatchObject({ mode: 'live', total: 40, estimatedTotal: 100, hasMore: true });
    expect(first.body.results).toHaveLength(24);
    expect(first.body.platformStatus.daraz).toMatchObject({ loaded: 40, total: 100, exhausted: false });

    const again = await request(app).get('/api/search?q=zephyr gadget&limit=24');
    expect(again.body.source).toBe('cache');
    expect(daraz).toHaveBeenCalledTimes(1); // reused, nothing scraped

    const more = await request(app).get('/api/search?q=zephyr gadget&limit=60');
    expect(daraz.mock.calls.map((c) => c[1].page)).toEqual([1, 2]);
    expect(more.body.results).toHaveLength(60);
    expect(more.body.total).toBe(80);

    const all = await request(app).get('/api/search?q=zephyr gadget&limit=100');
    expect(daraz.mock.calls.map((c) => c[1].page)).toEqual([1, 2, 3]);
    expect(all.body).toMatchObject({ total: 100, hasMore: false });
    expect(all.body.platformStatus.daraz.exhausted).toBe(true);
    expect(new Set(all.body.results.map((r) => r.id)).size).toBe(100); // no duplicates across pages
  });

  test('both stores are paged together and their results interleave by relevance', async () => {
    stores({
      daraz: () => withMeta([listing('daraz', 'Quokka Phone Max', 100), listing('daraz', 'Random Daraz Thing', 100)], { total: 2, pageSize: 40 }),
      priceoye: () => withMeta([listing('priceoye', 'Quokka Phone Max Pro', 100), listing('priceoye', 'Random PriceOye Thing', 100)], { total: 2, pageSize: 24 }),
    });
    const res = await search('quokka phone max');
    expect(res.body.estimatedTotal).toBe(4);
    expect(titles(res).slice(0, 2).every((t) => /Quokka/.test(t))).toBe(true);
  });

  test('never loads more than 3 store pages per request, and says there is more', async () => {
    const daraz = jest.fn((q, o) => page('daraz', 40, ((o.page || 1) - 1) * 40, { total: 4000, pageSize: 40 }));
    stores({ daraz });
    const res = await request(app).get('/api/search?q=endless gadget&limit=400');
    expect(daraz.mock.calls.length).toBeLessThanOrEqual(3);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.estimatedTotal).toBe(4000);
  });

  test('limit is validated', async () => {
    expect((await request(app).get('/api/search?q=airpods&limit=0')).status).toBe(400);
    expect((await request(app).get('/api/search?q=airpods&limit=1000')).status).toBe(400);
  });

  test('platform, price and sort filters apply to what is loaded', async () => {
    stores({
      daraz: () => withMeta([listing('daraz', 'Filterable Gadget Alpha', 500), listing('daraz', 'Filterable Gadget Bravo', 1500)]),
      priceoye: () => withMeta([listing('priceoye', 'Filterable Gadget Charlie', 900)]),
    });
    expect((await search('filterable gadget', '&platform=priceoye')).body.total).toBe(1);
    expect((await search('filterable gadget', '&minPrice=800&maxPrice=1000')).body.total).toBe(1);
    const asc = (await search('filterable gadget', '&sort=price_asc')).body.results.map((r) => r.minPrice);
    expect(asc).toEqual([500, 900, 1500]);
  });
});

describe('refresh: check the stores again', () => {
  test('an earlier live result is reused only until the user asks to refresh', async () => {
    const calls = jest.fn(() => withMeta([listing('daraz', 'Refresh Test Gadget Pro 3000', 1500)]));
    stores({ daraz: calls });
    const first = await search('refresh test gadget');
    expect(first.body.source).toBe('live');
    const afterFirst = calls.mock.calls.length;

    const again = await search('refresh test gadget');
    expect(again.body.source).toBe('cache');
    expect(calls.mock.calls.length).toBe(afterFirst); // reused, no scraping

    const refreshed = await request(app).get('/api/search?q=refresh test gadget&refresh=true&limit=100');
    expect(refreshed.body.source).toBe('live');
    expect(calls.mock.calls.length).toBeGreaterThan(afterFirst);
    expect(refreshed.body.demoMode).toBe(false);
  });

  test('a refresh picks up a price change from the store', async () => {
    let price = 2000;
    stores({ daraz: () => withMeta([{ ...listing('daraz', 'Refresh Price Widget X1', price), externalId: 'fixed-id-1' }]) });
    const first = await search('refresh price widget');
    expect(first.body.results[0].minPrice).toBe(2000);
    price = 1800;
    const refreshed = await request(app).get('/api/search?q=refresh price widget&refresh=true&limit=100');
    expect(refreshed.body.results[0].minPrice).toBe(1800);
  });

  test('the reuse window is 15 minutes by default', () => {
    expect(config.search.cacheTtlMs).toBe(15 * 60 * 1000);
  });

  test('refresh in demo mode never scrapes and reports demoMode', async () => {
    config.demoMode = true;
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    const res = await request(app).get('/api/search?q=airpods pro&refresh=true');
    expect(res.body).toMatchObject({ source: 'fallback', demoMode: true, mode: 'stored' });
    expect(spy).not.toHaveBeenCalled();
  });

  test('an invalid refresh value is rejected', async () => {
    expect((await request(app).get('/api/search?q=airpods&refresh=maybe')).status).toBe(400);
  });

  test('a search that found nothing is only reused briefly', async () => {
    stores({});
    const first = await search('zzy flurbo gadget');
    expect(first.body.total).toBe(0);
    stores({ daraz: () => withMeta([listing('daraz', 'Zzy Flurbo Gadget Pro', 1234)]) });
    await SearchCache.updateMany({}, { fetchedAt: new Date(Date.now() - config.search.emptyCacheTtlMs - 1000) });
    const second = await search('zzy flurbo gadget');
    expect(second.body.source).toBe('live');
    expect(titles(second)).toContain('Zzy Flurbo Gadget Pro');
  });
});

describe('why a store could not be reached is reported, and Refresh can recover', () => {
  const timeout = () => {
    throw Object.assign(new Error('Timed out after 8000 ms'), { code: 'TIMEOUT' });
  };

  test('each failing store reports its own reason code, and stored data is shown', async () => {
    stores({ daraz: timeout, priceoye: () => { throw Object.assign(new Error('Blocked by platform (HTTP 403)'), { code: 'BLOCKED' }); } });
    const res = await search('reason code gadget');
    expect(res.body).toMatchObject({ source: 'fallback', mode: 'stored' });
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
    expect(daraz.mock.calls.length).toBe(callsWhilePaused);

    stores({ daraz: () => withMeta([listing('daraz', 'Flaky Gadget Pro Recovered', 4321)]) });
    const refreshed = await request(app).get('/api/search?q=flaky gadget again&refresh=true&limit=100');
    expect(refreshed.body.source).toBe('live');
    expect(refreshed.body.platformStatus.daraz.status).toBe('success');
    expect(titles(refreshed)).toContain('Flaky Gadget Pro Recovered');
  });

  test('/api/platforms exposes the last error and circuit state for diagnosis', async () => {
    stores({ daraz: timeout });
    await search('platform status gadget');
    const res = await request(app).get('/api/platforms');
    expect(res.body.platforms.find((p) => p.id === 'daraz')).toMatchObject({ circuit: 'closed', lastError: { code: 'TIMEOUT', message: expect.stringMatching(/Timed out/) } });
  });
});

describe('stored data (demo mode, browsing, fallback)', () => {
  // The pre-filter must never be stricter than the relevance check: for every (query, title) pair that
  // isRelevant accepts, a product with that title must be found by the stored-data search.
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
    expect(isRelevant(parsed, title)).toBe(true);
    const { productIds } = await ingestListings([listing('daraz', title, 777)]);
    const found = await localSearch(parsed);
    expect(found.map((p) => String(p._id))).toContain(productIds[0]);
    expect(await Product.countDocuments({ _id: productIds[0] })).toBe(1);
  });
});

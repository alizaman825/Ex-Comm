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

describe('live ingestion', () => {
  const daraz = [
    { platform: 'daraz', externalId: 'dz-1', title: 'Samsung Galaxy A55 5G - 8GB 256GB - PTA Approved', price: 118500, originalPrice: 130000, url: 'https://www.daraz.pk/products/a55-i1.html', image: 'https://img/a55.png', rating: 4.6, reviewCount: 120, currency: 'PKR', inStock: true },
    { platform: 'daraz', externalId: 'dz-2', title: 'Samsung Galaxy A55 Back Cover Case Transparent', price: 499, url: 'https://www.daraz.pk/products/case-i2.html', currency: 'PKR', reviewCount: 0, inStock: true },
    { platform: 'daraz', externalId: 'dz-3', title: 'Samsung Galaxy A57 5G 12GB 256GB', price: 163999, url: 'https://www.daraz.pk/products/a57-i3.html', currency: 'PKR', reviewCount: 0, inStock: true },
  ];

  test('shows everything the store returned (accessories and other models too), ranked best first, and adopts the sample listing', async () => {
    const productsBefore = await Product.countDocuments();
    mockScrapers({ daraz, priceoye: async () => [] });
    const res = await get('q=samsung galaxy a55');
    expect(res.body.source).toBe('live');
    expect(res.body.total).toBe(3); // the phone, the case and the A57: nothing is filtered out
    expect(res.body.platformStatus.daraz).toMatchObject({ scraped: 3, loaded: 3 });
    expect(res.body.results[0].title).toMatch(/A55/); // the real match is ranked first

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

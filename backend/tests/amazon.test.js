const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const amazon = require('../src/scrapers/amazon');
const { seedDatabase } = require('../src/seed/seed');
const { Listing, SearchCache, Setting } = require('../src/models');
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

const record = (asin, title, price, extra = {}) => ({
  asin,
  title,
  url: `https://www.amazon.com/dp/${asin}`,
  image_url: `https://img.example/${asin}.jpg`,
  initial_price: price,
  rating: 4.5,
  reviews_count: 120,
  ...extra,
});

describe('Amazon adapter: mapItem', () => {
  it('maps a Bright Data record to a normalized supplier listing', () => {
    expect(amazon.mapItem(record('B001', 'Xiaomi Mi Band 8', 39.99))).toMatchObject({
      platform: 'amazon',
      role: 'supplier',
      externalId: 'B001',
      title: 'Xiaomi Mi Band 8',
      url: 'https://www.amazon.com/dp/B001',
      image: 'https://img.example/B001.jpg',
      priceUsd: 39.99,
      rating: 4.5,
      reviewCount: 120,
      inStock: true,
    });
  });

  it('skips records with no price, no asin/title, or marks unavailable items out of stock', () => {
    expect(amazon.mapItem(record('B001', 'x', 0))).toBeNull();
    expect(amazon.mapItem({ ...record('B001', 'x', 10), asin: undefined })).toBeNull();
    expect(amazon.mapItem(record('B001', 'x', 10, { availability: 'Currently unavailable' }))).toMatchObject({ inStock: false });
  });
});

describe('POST /api/search/amazon', () => {
  const post = (q) => request(app).post('/api/search/amazon').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('xiaomi mi band 8');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('converts USD to PKR using the saved exchange rate and stores the listing as a supplier offer', async () => {
    await Setting.set('usdToPkr', 300);
    jest.spyOn(scrapers.adapters.amazon, 'search').mockResolvedValue(
      Object.assign([{ platform: 'amazon', role: 'supplier', externalId: 'B999', title: 'Zeta Quantum Widget 9000', url: 'https://www.amazon.com/dp/B999', priceUsd: 40, inStock: true, reviewCount: 0 }], { meta: { total: 1 } })
    );
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });

    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });

    const listing = await Listing.findOne({ platform: 'amazon', externalId: 'B999' }).lean();
    expect(listing).toMatchObject({ role: 'supplier', price: 12000, currency: 'PKR', priceUsd: 40, dataSource: 'live' });

    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.amazon.total).toBe(1);
  });

  it('reports a failure (e.g. Bright Data not configured) without throwing', async () => {
    jest.spyOn(scrapers.adapters.amazon, 'search').mockRejectedValue(Object.assign(new Error('Bright Data is not configured (BRIGHTDATA_API_KEY)'), { code: 'CONFIG' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'CONFIG' });
  });
});

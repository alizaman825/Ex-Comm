const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const ali = require('../src/scrapers/aliexpress');
const { seedDatabase } = require('../src/seed/seed');
const { Listing, SearchCache } = require('../src/models');
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

const item = (id, title, price, extra = {}) => ({
  productId: id,
  title: { displayTitle: title },
  image: { imgUrl: `//img.example/${id}.jpg` },
  prices: { salePrice: { minPrice: price, currencyCode: 'PKR' }, originalPrice: { minPrice: price + 500, currencyCode: 'PKR' } },
  evaluation: { starRating: 4.7 },
  trade: { tradeDesc: '1,234 sold' },
  ...extra,
});
const page = (items) => `<html><script>window.x={"a":"b \\" ] }","itemList":{"content":${JSON.stringify(items)},"other":1}}</script></html>`;

describe('AliExpress parser', () => {
  it('reads PKR prices, ids, ratings and links from the embedded result list', () => {
    const out = ali.parse(page([item('1001', 'Xiaomi Mi Band 8', 9000), item('1002', 'Strap [for] Band 8', 400)]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ platform: 'aliexpress', role: 'supplier', externalId: '1001', price: 9000, originalPrice: 9500, rating: 4.7, reviewCount: 1234, url: 'https://www.aliexpress.com/item/1001.html' });
    expect(out[0].image).toBe('https://img.example/1001.jpg');
  });
  it('skips items without a rupee price and reports a block when there is no list', () => {
    const usd = item('1', 'x', 5);
    usd.prices.salePrice.currencyCode = 'USD';
    expect(ali.parse(page([usd]))).toHaveLength(0);
    expect(() => ali.parse('<html>captcha</html>')).toThrow(/blocked or layout change/);
  });
});

describe('POST /api/search/aliexpress', () => {
  const post = (q) => request(app).post('/api/search/aliexpress').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('xiaomi mi band 8');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('stores the listings as supplier offers and adds them to an existing live result list', async () => {
    jest.spyOn(scrapers.adapters.aliexpress, 'search').mockResolvedValue(Object.assign([{ platform: 'aliexpress', role: 'supplier', externalId: 'ax-1', title: 'Zeta Quantum Widget 9000', url: 'https://www.aliexpress.com/item/ax-1.html', price: 4321, currency: 'PKR', inStock: true, reviewCount: 3 }], { meta: { total: 1 } }));
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });
    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });
    const listing = await Listing.findOne({ platform: 'aliexpress', externalId: 'ax-1' }).lean();
    expect(listing).toMatchObject({ role: 'supplier', price: 4321, dataSource: 'live' });
    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.aliexpress.total).toBe(1);
  });

  it('reports a failure without throwing', async () => {
    jest.spyOn(scrapers.adapters.aliexpress, 'search').mockRejectedValue(Object.assign(new Error('blocked'), { code: 'BLOCKED' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'BLOCKED' });
  });
});

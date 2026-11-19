const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const shein = require('../src/scrapers/shein');
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
  goods_id: id,
  goods_name: title,
  goods_img: `//img.example/${id}.jpg`,
  salePrice: { amount: price },
  retailPrice: { amount: price + 500 },
  ...extra,
});
const page = (items) => `<html><script>window.x={"a":"b \\" ] }","products":${JSON.stringify(items)}}</script></html>`;

describe('SHEIN parser', () => {
  it('reads prices, ids and images from the embedded result list', () => {
    const out = shein.parse(page([item('1001', 'Floral Summer Dress', 2500), item('1002', 'Case [for] Phone', 400)]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ platform: 'shein', role: 'supplier', externalId: '1001', title: 'Floral Summer Dress', price: 2500, originalPrice: 3000 });
    expect(out[0].image).toBe('https://img.example/1001.jpg');
  });

  it('skips items without a price and reports a block when there is no list', () => {
    expect(shein.parse(page([{ goods_id: '1', goods_name: 'x' }]))).toHaveLength(0);
    expect(() => shein.parse('<html>captcha</html>')).toThrow(/blocked or layout change/);
  });
});

describe('POST /api/search/shein', () => {
  const post = (q) => request(app).post('/api/search/shein').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('floral dress');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('stores the listings as supplier offers and adds them to an existing live result list', async () => {
    jest.spyOn(scrapers.adapters.shein, 'search').mockResolvedValue(Object.assign([{ platform: 'shein', role: 'supplier', externalId: 'sh-1', title: 'Zeta Quantum Widget 9000', url: 'https://pk.shein.com/zeta-widget-p-sh-1.html', price: 4321, currency: 'PKR', inStock: true, reviewCount: 3 }], { meta: { total: 1 } }));
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });
    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });
    const listing = await Listing.findOne({ platform: 'shein', externalId: 'sh-1' }).lean();
    expect(listing).toMatchObject({ role: 'supplier', price: 4321, dataSource: 'live' });
    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.shein.total).toBe(1);
  });

  it('reports a failure without throwing', async () => {
    jest.spyOn(scrapers.adapters.shein, 'search').mockRejectedValue(Object.assign(new Error('blocked'), { code: 'BLOCKED' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'BLOCKED' });
  });
});

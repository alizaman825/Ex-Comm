const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const temu = require('../src/scrapers/temu');
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

const item = (id, title, priceCents, extra = {}) => ({
  goods_id: id,
  title,
  thumb_url: `//img.example/${id}.jpg`,
  price: { price: priceCents },
  ...extra,
});
const page = (items) => `<html><script>window.x={"a":"b \\" ] }","goods_list":${JSON.stringify(items)}}</script></html>`;

describe('Temu parser', () => {
  it('reads cents prices, ids and images from the embedded result list', () => {
    const out = temu.parse(page([item('1001', 'Wireless Earbuds', 3999), item('1002', 'Case [for] Earbuds', 500)]));
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ platform: 'temu', role: 'supplier', externalId: '1001', title: 'Wireless Earbuds', priceUsd: 39.99 });
    expect(out[0].image).toBe('https://img.example/1001.jpg');
  });

  it('skips items without a price and reports a block when there is no list', () => {
    expect(temu.parse(page([{ goods_id: '1', title: 'x' }]))).toHaveLength(0);
    expect(() => temu.parse('<html>captcha</html>')).toThrow(/blocked or layout change/);
  });
});

describe('POST /api/search/temu', () => {
  const post = (q) => request(app).post('/api/search/temu').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('wireless earbuds');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('converts USD to PKR using the saved exchange rate, stores the listing as a supplier offer, and adds it to an existing live result list', async () => {
    await Setting.set('usdToPkr', 300);
    jest.spyOn(scrapers.adapters.temu, 'search').mockResolvedValue(
      Object.assign([{ platform: 'temu', role: 'supplier', externalId: 'tm-1', title: 'Zeta Quantum Widget 9000', url: 'https://www.temu.com/tm-1.html', priceUsd: 40, inStock: true, reviewCount: 0 }], { meta: { total: 1 } })
    );
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });

    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });

    const listing = await Listing.findOne({ platform: 'temu', externalId: 'tm-1' }).lean();
    expect(listing).toMatchObject({ role: 'supplier', price: 12000, currency: 'PKR', priceUsd: 40, dataSource: 'live' });

    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.temu.total).toBe(1);
  });

  it('reports a failure without throwing', async () => {
    jest.spyOn(scrapers.adapters.temu, 'search').mockRejectedValue(Object.assign(new Error('blocked'), { code: 'BLOCKED' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'BLOCKED' });
  });
});

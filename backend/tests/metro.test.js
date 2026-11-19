const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const metro = require('../src/scrapers/metro');
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

// Minimal Magento ("Luma" theme) search-results markup: one in-stock item on sale, one out of stock.
const page = () => `<html><body><ol class="products list items product-items">
  <li class="item product product-item">
    <a class="product-item-link" href="https://www.metro.pk/samsung-galaxy-a55.html">Samsung Galaxy A55 5G</a>
    <img class="product-image-photo" src="https://www.metro.pk/media/catalog/product/a55.jpg">
    <a class="towishlist" data-post='{"action":"https://www.metro.pk/wishlist/index/add/","data":{"product":4001}}'>Add to Wish List</a>
    <span class="price-box">
      <span class="old-price"><span class="price">Rs. 150,000</span></span>
      <span class="special-price"><span class="price">Rs. 139,000</span></span>
    </span>
    <div class="rating-summary"><span class="rating-result" title="90"></span></div>
  </li>
  <li class="item product product-item">
    <a class="product-item-link" href="https://www.metro.pk/out-of-stock-phone.html">Out Of Stock Phone</a>
    <a class="towishlist" data-post='{"action":"x","data":{"product":4002}}'>Add to Wish List</a>
    <span class="price-box"><span class="price-final_price"><span class="price">Rs. 50,000</span></span></span>
    <div class="stock unavailable">Out of stock</div>
  </li>
</ol></body></html>`;

describe('Metro Online parser', () => {
  it('reads prices, ids and ratings from Magento search markup', () => {
    const out = metro.parse(page());
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ platform: 'metro', role: 'retail', externalId: '4001', title: 'Samsung Galaxy A55 5G', price: 139000, originalPrice: 150000, rating: 4.5, inStock: true });
    expect(out[0].image).toBe('https://www.metro.pk/media/catalog/product/a55.jpg');
  });

  it('detects out-of-stock items and throws PARSE on an unrelated page', () => {
    const out = metro.parse(page());
    expect(out[1]).toMatchObject({ externalId: '4002', price: 50000, inStock: false });
    expect(() => metro.parse('<html><body><h1>Maintenance</h1></body></html>')).toThrow(expect.objectContaining({ code: 'PARSE' }));
  });
});

describe('POST /api/search/metro', () => {
  const post = (q) => request(app).post('/api/search/metro').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('galaxy a55');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('stores the listings as retail offers and adds them to an existing live result list', async () => {
    jest.spyOn(scrapers.adapters.metro, 'search').mockResolvedValue(Object.assign([{ platform: 'metro', role: 'retail', externalId: 'mt-1', title: 'Zeta Quantum Widget 9000', url: 'https://www.metro.pk/zeta-widget.html', price: 4321, currency: 'PKR', inStock: true, reviewCount: 3 }], { meta: { total: 1 } }));
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });
    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });
    const listing = await Listing.findOne({ platform: 'metro', externalId: 'mt-1' }).lean();
    expect(listing).toMatchObject({ role: 'retail', price: 4321, dataSource: 'live' });
    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.metro.total).toBe(1);
  });

  it('reports a failure without throwing', async () => {
    jest.spyOn(scrapers.adapters.metro, 'search').mockRejectedValue(Object.assign(new Error('blocked'), { code: 'BLOCKED' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'BLOCKED' });
  });
});

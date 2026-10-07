const request = require('supertest');
const { createApp } = require('../src/app');
const { seedDatabase } = require('../src/seed/seed');
const { Product } = require('../src/models');
const { startDb, stopDb } = require('./helpers');

let app;
let iphone;
let a55;

beforeAll(async () => {
  await startDb();
  await seedDatabase({ log: () => {} });
  app = createApp();
  iphone = String((await Product.findOne({ title: 'Apple iPhone 15 128GB' }))._id);
  a55 = String((await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' }))._id);
});
afterAll(stopDb);

describe('GET /api/products/:id', () => {
  test('returns the product with every listing, cheapest first', async () => {
    const res = await request(app).get(`/api/products/${iphone}`);
    expect(res.status).toBe(200);
    const p = res.body.product;
    expect(p.title).toBe('Apple iPhone 15 128GB');
    expect(p.listings.map((l) => l.platform).sort()).toEqual(['aliexpress', 'daraz', 'priceoye']);
    const prices = p.listings.map((l) => l.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const ali = p.listings.find((l) => l.platform === 'aliexpress');
    expect(ali).toMatchObject({ role: 'supplier', dataSource: 'saved' });
    expect(ali.priceUsd).toBeGreaterThan(0);
    expect(p.supplierMinPrice).toBeGreaterThan(0);
    expect(p).not.toHaveProperty('inWishlist'); // signed out
  });

  test('400 for a malformed id, 404 for an unknown one', async () => {
    expect((await request(app).get('/api/products/not-an-id')).status).toBe(400);
    expect((await request(app).get('/api/products/aaaaaaaaaaaaaaaaaaaaaaaa')).status).toBe(404);
  });
});

describe('GET /api/products/:id/history', () => {
  test('returns a series per platform for the requested range', async () => {
    const res = await request(app).get(`/api/products/${iphone}/history?days=30`);
    expect(res.status).toBe(200);
    expect(res.body.series.map((s) => s.platform).sort()).toEqual(['aliexpress', 'daraz', 'priceoye']);
    res.body.series.forEach((s) => {
      expect(s.points.length).toBeGreaterThanOrEqual(29);
      expect(s.points.length).toBeLessThanOrEqual(31);
    });
    expect(res.body.series.find((s) => s.platform === 'aliexpress').role).toBe('supplier');
    const { summary } = res.body;
    expect(summary.lowest).toBeLessThanOrEqual(summary.current);
    expect(summary.highest).toBeGreaterThanOrEqual(summary.current);
  });

  test('range changes the number of points', async () => {
    const week = await request(app).get(`/api/products/${iphone}/history?days=7`);
    const quarter = await request(app).get(`/api/products/${iphone}/history?days=90`);
    expect(week.body.overall.length).toBeLessThan(10);
    expect(quarter.body.overall.length).toBeGreaterThan(80);
  });

  test('rejects an unsupported range', async () => {
    expect((await request(app).get(`/api/products/${iphone}/history?days=365`)).status).toBe(400);
  });
});

describe('GET /api/compare', () => {
  test('one product: stores as columns with cheapest and best rated highlighted', async () => {
    const res = await request(app).get(`/api/compare?ids=${a55}`);
    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('platforms');
    expect(res.body.products[0].listings).toHaveLength(3);
    expect(['daraz', 'priceoye']).toContain(res.body.cheapest.platform); // supplier is never the "cheapest retail"
    expect(res.body.bestRated.rating).toBeGreaterThan(0);
  });

  test('several products side by side, in the requested order', async () => {
    const res = await request(app).get(`/api/compare?ids=${iphone},${a55}`);
    expect(res.body.mode).toBe('products');
    expect(res.body.products.map((p) => p.id)).toEqual([iphone, a55]);
  });

  test('validates ids: none, too many, unknown', async () => {
    expect((await request(app).get('/api/compare')).status).toBe(400);
    const five = Array.from({ length: 5 }, (_, i) => `${'a'.repeat(23)}${i}`).join(',');
    expect((await request(app).get(`/api/compare?ids=${five}`)).status).toBe(400);
    expect((await request(app).get(`/api/compare?ids=${'b'.repeat(24)}`)).status).toBe(404);
  });
});

describe('product lists', () => {
  test('trending returns popular products, optionally by category', async () => {
    const res = await request(app).get('/api/products/trending?limit=5&category=mobiles');
    expect(res.body.products).toHaveLength(5);
    res.body.products.forEach((p) => expect(p.category).toBe('mobiles'));
  });

  test('drops are sorted by the biggest 7-day decrease', async () => {
    const res = await request(app).get('/api/products/drops?limit=6');
    expect(res.body.products.length).toBeGreaterThan(2);
    const changes = res.body.products.map((p) => p.priceChange7d);
    expect(changes.every((c) => c < 0)).toBe(true);
    expect(changes).toEqual([...changes].sort((a, b) => a - b));
  });

  test('similar suggests other products for manual comparison, never itself', async () => {
    const res = await request(app).get(`/api/products/${a55}/similar`);
    expect(res.status).toBe(200);
    expect(res.body.products.length).toBeGreaterThan(0);
    expect(res.body.products.map((p) => p.id)).not.toContain(a55);
  });
});

describe('compare: best rated', () => {
  test('is the listing with the highest rating (review count only breaks ties)', async () => {
    const { Listing } = require('../src/models');
    const ids = [iphone, a55];
    const res = await request(app).get(`/api/compare?ids=${ids.join(',')}`);
    const all = await Listing.find({ productId: { $in: ids }, rating: { $gt: 0 } }).lean();
    const top = Math.max(...all.map((l) => l.rating));
    expect(res.body.bestRated.rating).toBe(top);
  });
});

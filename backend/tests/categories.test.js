const request = require('supertest');
const { createApp } = require('../src/app');
const { seedDatabase, TRENDING } = require('../src/seed/seed');
const { classify, resolveCategory } = require('../src/services/categories');
const { Product, Listing, Setting } = require('../src/models');
const { startDb, stopDb } = require('./helpers');

let app;
beforeAll(async () => {
  await startDb();
  await seedDatabase({ log: () => {} });
  app = createApp();
});
afterAll(stopDb);

describe('classify', () => {
  test.each([
    ['Samsung Galaxy A55 5G 8GB 256GB Smartphone', 'mobiles'],
    ['Apple MacBook Air M3 13in', 'laptops'],
    ['HP Victus 15 Core i5 12450H', 'laptops'],
    ['JBL Tune 520BT Wireless Headphones', 'audio'],
    ['Xiaomi Redmi Buds 6 Active', 'audio'],
    ['Amazfit GTS 4 Mini Smart Watch', 'watches'],
    ['Air Fryer 8 Litre Digital', 'home-appliances'],
    ['Walkend Sneakers for men shoes for men', 'fashion'],
    ['Levis 501 Jeans', 'fashion'],
  ])('%s -> %s', (title, slug) => expect(classify(title)).toBe(slug));

  test('falls back to a hint, then null', () => {
    expect(classify('Mystery Item XYZ', 'Home Appliances')).toBe('home-appliances');
    expect(classify('Mystery Item XYZ')).toBeNull();
  });

  test('resolveCategory accepts slugs and names', () => {
    expect(resolveCategory('Home Appliances')).toBe('home-appliances');
    expect(resolveCategory('home-appliances')).toBe('home-appliances');
    expect(resolveCategory('MOBILES')).toBe('mobiles');
    expect(resolveCategory('toys')).toBeNull();
  });
});

describe('seed data shape', () => {
  test('6 categories with 15 products each', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.slug)).toEqual(['mobiles', 'laptops', 'audio', 'watches', 'home-appliances', 'fashion']);
    res.body.categories.forEach((c) => {
      expect(c.productCount).toBe(15);
      expect(c.keywords.length).toBeGreaterThanOrEqual(5);
    });
  });

  test('AliExpress listings are saved supplier data with a USD price', async () => {
    const supplier = await Listing.find({ platform: 'aliexpress' }).lean();
    expect(supplier.length).toBeGreaterThan(40);
    const fx = (await Setting.getAll()).usdToPkr;
    supplier.forEach((l) => {
      expect(l).toMatchObject({ role: 'supplier', dataSource: 'saved' });
      expect(Math.abs(l.priceUsd * fx - l.price)).toBeLessThan(fx / 100 + 1);
    });
    expect(await Listing.countDocuments({ platform: { $ne: 'aliexpress' }, role: 'supplier' })).toBe(0);
  });

  test('products expose retail and supplier minimum prices', async () => {
    const p = await Product.findOne({ title: 'Apple iPhone 15 128GB' }).lean();
    expect(p.supplierMinPrice).toBeGreaterThan(0);
    expect(p.retailMinPrice).toBeGreaterThan(0);
    const fashion = await Product.findOne({ category: 'fashion', platforms: 'aliexpress' }).lean();
    expect(fashion.supplierMinPrice).toBeLessThan(fashion.retailMinPrice * 0.75); // generic goods: big source discount
  });
});

describe('category filter', () => {
  test('browse a category without a search term', async () => {
    const res = await request(app).get('/api/search?category=watches&pageSize=48&live=false');
    expect(res.body.total).toBe(15);
    res.body.results.forEach((r) => expect(r.category).toBe('watches'));
  });

  test('accepts a category name and combines with a query', async () => {
    const res = await request(app).get('/api/search?q=samsung&category=Audio&live=false');
    expect(res.body.total).toBe(2); // Galaxy Buds FE + Buds3 Pro
    res.body.results.forEach((r) => expect(r.title).toMatch(/Buds/));
  });

  test('unknown category returns nothing', async () => {
    const res = await request(app).get('/api/search?category=toys&live=false');
    expect(res.body.total).toBe(0);
  });

  test('offers carry the supplier role and live/saved label', async () => {
    const res = await request(app).get('/api/search?q=iphone 15 128gb&live=false');
    const ali = res.body.results[0].offers.find((o) => o.platform === 'aliexpress');
    expect(ali).toMatchObject({ role: 'supplier', dataSource: 'saved' });
    expect(ali.priceUsd).toBeGreaterThan(0);
  });
});

describe('trending and platforms', () => {
  test('GET /api/search/trending lists popular searches by hits', async () => {
    const res = await request(app).get('/api/search/trending?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.trending).toHaveLength(5);
    expect(res.body.trending[0]).toMatchObject({ query: TRENDING[0][0], hits: TRENDING[0][1] });
    res.body.trending.forEach((t) => expect(t.results).toBeGreaterThan(0));
  });

  test('a trending query shows its stored products (no scraping with live=false)', async () => {
    const res = await request(app).get('/api/search?q=airpods pro&live=false');
    expect(res.body).toMatchObject({ source: 'fallback', mode: 'stored' });
    expect(res.body.results[0].title).toMatch(/AirPods Pro/);
  });

  test('GET /api/platforms lists stores with their role', async () => {
    const res = await request(app).get('/api/platforms');
    expect(res.body.platforms.map((p) => [p.id, p.role])).toEqual([
      ['daraz', 'retail'],
      ['priceoye', 'retail'],
      ['aliexpress', 'supplier'],
    ]);
    expect(res.body.platforms.find((p) => p.id === 'aliexpress').live).toBe(false);
  });
});

describe('headline price is the retail price', () => {
  test('a product with a cheaper supplier listing still headlines the retail minimum', async () => {
    const p = await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' }).lean();
    expect(p.supplierMinPrice).toBeLessThan(p.retailMinPrice);
    expect(p.minPrice).toBe(p.retailMinPrice);
    expect(['daraz', 'priceoye']).toContain(p.lowestPlatform);
    expect(p.maxPrice).toBeGreaterThanOrEqual(p.minPrice);
    const res = await request(app).get('/api/search?q=galaxy a55&live=false');
    const card = res.body.results[0];
    expect(card.minPrice).toBe(p.retailMinPrice);
    expect(card.offers.some((o) => o.platform === 'aliexpress' && o.price < card.minPrice)).toBe(true); // supplier still listed, but not the headline
  });

  test('a supplier-only product (no retail listing) headlines the supplier price', async () => {
    const { Listing, Product: P } = require('../src/models');
    const { refreshProductStats } = require('../src/services/productStats');
    const prod = await P.findOne({ title: 'Apple iPhone 15 128GB' });
    await Listing.deleteMany({ productId: prod._id, role: 'retail' });
    await refreshProductStats(prod._id);
    const after = await P.findById(prod._id).lean();
    expect(after.retailMinPrice).toBeNull();
    expect(after.minPrice).toBe(after.supplierMinPrice);
    expect(after.lowestPlatform).toBe('aliexpress');
  });
});

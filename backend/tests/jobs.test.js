const request = require('supertest');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const mailer = require('../src/services/mailer');
const { runPriceCheck } = require('../src/jobs/priceCheck');
const { seedDatabase } = require('../src/seed/seed');
const { Product, Listing, PriceHistory, Alert, Wishlist, Notification, JobRun, User } = require('../src/models');
const { startDb, stopDb } = require('./helpers');

let app;
let user;
let a55;
let a55Retail; // cheapest in-stock retail price before each test
const KEY = { 'x-job-key': 'test-job-key' };

async function makeUser() {
  const u = new User({ name: 'Job Tester', email: 'jobs@example.com', emailAlerts: true });
  await u.setPassword('password1');
  return u.save();
}

const retailListings = () => Listing.find({ productId: a55, role: 'retail' });
const liveListing = (platform, price) => ({
  platform, externalId: `live-${platform}`, title: 'Samsung Galaxy A55 5G 8GB 256GB', price,
  url: 'https://example.com/a55', currency: 'PKR', rating: 4.5, reviewCount: 10, inStock: true,
});
// Returns the fresh A55 listing for A55 queries only, nothing for other products.
const mockStores = (priceFor) => {
  for (const platform of ['daraz', 'priceoye']) {
    jest.spyOn(scrapers.adapters[platform], 'search').mockImplementation(async (q) => (/A55/i.test(q) ? [liveListing(platform, priceFor(platform))] : []));
  }
};

beforeAll(async () => {
  await startDb();
  app = createApp();
});
afterAll(stopDb);

beforeEach(async () => {
  await seedDatabase({ log: () => {} });
  await JobRun.deleteMany({});
  user = await makeUser();
  a55 = (await Product.findOne({ title: 'Samsung Galaxy A55 5G 8GB 256GB' }))._id;
  const retail = await retailListings();
  a55Retail = Math.min(...retail.filter((l) => l.inStock).map((l) => l.price));
});
afterEach(async () => {
  jest.restoreAllMocks();
  config.demoMode = false;
  config.smtp.host = '';
  Object.values(scrapers.queues).forEach((q) => q.reset());
  await User.deleteMany({ email: 'jobs@example.com' });
});

describe('trigger endpoint', () => {
  test.each([[{}], [{ 'x-job-key': 'wrong' }]])('rejects a missing/wrong key %p', async (headers) => {
    expect((await request(app).post('/api/jobs/price-check').set(headers).send({})).status).toBe(403);
    expect((await request(app).get('/api/jobs/status').set(headers)).status).toBe(403);
  });

  test('is disabled entirely when no JOB_KEY is configured', async () => {
    const saved = config.jobs.key;
    config.jobs.key = '';
    expect((await request(app).post('/api/jobs/price-check').set({ 'x-job-key': '' }).send({})).status).toBe(403);
    config.jobs.key = saved;
  });

  test('validates the mode', async () => {
    expect((await request(app).post('/api/jobs/price-check').set(KEY).send({ mode: 'turbo' })).status).toBe(400);
  });

  test('runs, records the run and reports it in /status', async () => {
    const run = await request(app).post('/api/jobs/price-check').set(KEY).send({ mode: 'simulate' });
    expect(run.status).toBe(200);
    const status = await request(app).get('/api/jobs/status').set(KEY);
    expect(status.body.running).toBe(false);
    expect(status.body.runs[0]).toMatchObject({ name: 'price-check', trigger: 'manual', mode: 'simulate' });
  });
});

describe('with nothing tracked', () => {
  test('skips and records the run', async () => {
    await Wishlist.deleteMany({});
    await Alert.deleteMany({});
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('skipped');
    expect(r.summary.note).toMatch(/No tracked products/);
    expect(await JobRun.countDocuments({ status: 'skipped' })).toBe(1);
  });
});

describe('live mode', () => {
  beforeEach(async () => {
    await Wishlist.deleteMany({});
    await Alert.deleteMany({});
    await Wishlist.create({ userId: user._id, productId: a55 });
  });

  test('updates prices, extends history and fires alerts + email', async () => {
    const target = Math.round(a55Retail * 0.9);
    await Alert.create({ userId: user._id, productId: a55, targetPrice: target });
    const dropped = Math.round(a55Retail * 0.8);
    mockStores(() => dropped);
    config.smtp.host = 'smtp.test';
    const mail = jest.spyOn(mailer, 'sendMail').mockResolvedValue(true);
    const before = await PriceHistory.countDocuments({ productId: a55 });

    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('success');
    expect(r.summary).toMatchObject({ products: 1, listingsChecked: 2, pricesChanged: 2, alertsTriggered: 1, failures: 0 });

    for (const l of await retailListings()) {
      expect(l).toMatchObject({ price: dropped, dataSource: 'live', seeded: false });
    }
    expect(await PriceHistory.countDocuments({ productId: a55 })).toBe(before + 2);
    expect((await Product.findById(a55)).retailMinPrice).toBe(dropped);

    const note = await Notification.findOne({ userId: user._id });
    expect(note.price).toBe(dropped);
    expect(mail).toHaveBeenCalledWith(expect.objectContaining({ to: 'jobs@example.com' }));
    expect((await JobRun.findOne()).summary.alertsTriggered).toBe(1);
  });

  test('does not email users who turned email alerts off', async () => {
    await User.updateOne({ _id: user._id }, { emailAlerts: false });
    await Alert.create({ userId: user._id, productId: a55, targetPrice: a55Retail * 10 });
    config.smtp.host = 'smtp.test';
    const mail = jest.spyOn(mailer, 'sendMail').mockResolvedValue(true);
    mockStores(() => a55Retail);
    await runPriceCheck({ trigger: 'manual' });
    expect(await Notification.countDocuments({ userId: user._id })).toBe(1); // in-app still created
    expect(mail).not.toHaveBeenCalled();
  });

  test('an unchanged price adds no duplicate history point and fires nothing', async () => {
    await Alert.create({ userId: user._id, productId: a55, targetPrice: Math.round(a55Retail * 0.5) });
    const current = Object.fromEntries((await retailListings()).map((l) => [l.platform, l.price]));
    mockStores((p) => current[p]);
    const before = await PriceHistory.countDocuments({ productId: a55 });
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.summary).toMatchObject({ pricesChanged: 0, alertsTriggered: 0 });
    expect(await PriceHistory.countDocuments({ productId: a55 })).toBe(before + 0);
  });

  test('all platforms failing is recorded as failed and never throws', async () => {
    await Alert.create({ userId: user._id, productId: a55, targetPrice: 1000 });
    for (const p of ['daraz', 'priceoye']) {
      jest.spyOn(scrapers.adapters[p], 'search').mockRejectedValue(Object.assign(new Error('boom'), { code: 'TIMEOUT' }));
    }
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('failed');
    expect(r.summary.failures).toBe(2);
    const prices = (await retailListings()).map((l) => l.price);
    expect(Math.min(...prices)).toBeGreaterThan(1000); // old prices kept
  });

  test('one platform failing is a partial run', async () => {
    jest.spyOn(scrapers.adapters.daraz, 'search').mockRejectedValue(Object.assign(new Error('boom'), { code: 'BLOCKED' }));
    jest.spyOn(scrapers.adapters.priceoye, 'search').mockResolvedValue([liveListing('priceoye', 12345)]);
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('partial');
    expect(r.summary).toMatchObject({ failures: 1, pricesChanged: 1 });
  });

  test('a listing that no longer appears is counted, not treated as an error', async () => {
    for (const p of ['daraz', 'priceoye']) jest.spyOn(scrapers.adapters[p], 'search').mockResolvedValue([]);
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('success');
    expect(r.summary.notFound).toBe(2);
  });

  test('demo mode skips live scraping', async () => {
    config.demoMode = true;
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.status).toBe('skipped');
    expect(spy).not.toHaveBeenCalled();
  });

  test('limits listings per run and flags truncation', async () => {
    const saved = config.jobs.maxListingsPerRun;
    config.jobs.maxListingsPerRun = 1;
    mockStores(() => a55Retail);
    const r = await runPriceCheck({ trigger: 'manual' });
    expect(r.summary).toMatchObject({ listingsChecked: 1, truncated: true });
    config.jobs.maxListingsPerRun = saved;
  });

  test('a second run started while one is in progress is skipped', async () => {
    mockStores(() => a55Retail);
    const [first, second] = await Promise.all([runPriceCheck({ trigger: 'manual' }), runPriceCheck({ trigger: 'manual' })]);
    expect([first.status, second.status].filter((s) => s === 'skipped')).toHaveLength(1);
    expect([first, second].find((r) => r.reason).reason).toMatch(/already running/);
  });
});

describe('simulate mode (offline demo)', () => {
  test('moves tracked retail prices, extends history and can fire alerts without scraping', async () => {
    await Wishlist.deleteMany({});
    await Alert.deleteMany({});
    await Alert.create({ userId: user._id, productId: a55, targetPrice: a55Retail * 10 }); // already reached
    config.demoMode = true;
    const spy = jest.spyOn(scrapers.adapters.daraz, 'search');
    const supplierBefore = await Listing.findOne({ productId: a55, role: 'supplier' }).lean();
    const histBefore = await PriceHistory.countDocuments({ productId: a55 });

    jest.spyOn(Math, 'random').mockReturnValue(0.1); // deterministic: a ~3.9% drop
    const r = await runPriceCheck({ mode: 'simulate', trigger: 'manual' });
    expect(spy).not.toHaveBeenCalled();
    expect(r.status).toBe('success');
    expect(r.summary.pricesChanged).toBe(2);
    expect(await PriceHistory.countDocuments({ productId: a55 })).toBe(histBefore + 2);
    expect(await Notification.countDocuments({ userId: user._id })).toBe(1);

    const supplierAfter = await Listing.findOne({ productId: a55, role: 'supplier' }).lean();
    expect(supplierAfter.price).toBe(supplierBefore.price); // saved supplier data is never simulated
  });
});

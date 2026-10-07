const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const catalog = require('../src/seed/catalog');
const { runCatalogSync, dueTasks, catalogSyncProgress } = require('../src/jobs/catalogSync');
const { Product, Listing, PriceHistory, Setting, JobRun } = require('../src/models');
const { startDb, stopDb, clearDb } = require('./helpers');

const FIRST = catalog.filter((c) => c.on.includes('d'))[0]; // Apple iPhone 16 128GB
const SECOND = catalog.filter((c) => c.on.includes('d'))[1];

const darazItem = (over = {}) => ({
  platform: 'daraz', externalId: '1958148', title: 'Apple iPhone 16 - 128GB', url: 'https://www.daraz.pk/products/apple-iphone-16-128gb-i1958148.html',
  price: 309899, currency: 'PKR', inStock: true, rating: 4.8, reviewCount: 30, ...over,
});
const searchResult = (listings) => ({ platform: 'daraz', status: 'success', listings, ms: 1 });

const saved = config.catalogSync;
beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  config.catalogSync = { ...saved, platforms: ['daraz'], pauseMs: 0, batch: 8 };
});
afterEach(() => {
  jest.restoreAllMocks();
  config.demoMode = false;
  config.catalogSync = saved;
});

test('a confident store match is stored with its real product URL and price, and the task is remembered', async () => {
  const search = jest.spyOn(scrapers, 'scrapePlatform').mockResolvedValue(searchResult([darazItem()]));
  const out = await runCatalogSync({ batch: 1 });
  expect(out.summary).toMatchObject({ tasks: 1, matched: 1 });
  const product = await Product.findOne({ title: FIRST.t });
  const listing = await Listing.findOne({ productId: product._id });
  expect(listing).toMatchObject({ platform: 'daraz', price: 309899, url: darazItem().url, dataSource: 'live', seeded: false });
  expect(await PriceHistory.countDocuments({ listingId: listing._id })).toBe(1);
  expect((await Setting.findOne({ key: 'catalogSync' })).value[`${FIRST.t}|daraz`]).toMatchObject({ ok: true });
  expect(search).toHaveBeenCalledTimes(1);

  // the next run moves on to the next item: the first is not due again for a day
  search.mockResolvedValue(searchResult([]));
  const next = await runCatalogSync({ batch: 1 });
  expect(next.summary.tasks).toBe(1);
  expect(search.mock.calls[1][1]).not.toBe(FIRST.t);
});

test('a run handles at most one batch, never-checked items first, and reports what is left', async () => {
  jest.spyOn(scrapers, 'scrapePlatform').mockResolvedValue(searchResult([]));
  const total = (await catalogSyncProgress()).total;
  const out = await runCatalogSync({ batch: 3 });
  expect(out.summary.tasks).toBe(3);
  expect(out.summary.remaining).toBe(total - 3);
  expect(out.summary.noMatch).toBe(3);
  expect((await catalogSyncProgress()).checked).toBe(3);
  // a miss is retried only after retryHours
  expect(dueTasks({ [`${FIRST.t}|daraz`]: { at: new Date().toISOString(), ok: false } }, Date.now()).some((t) => t.item.t === FIRST.t)).toBe(false);
});

test('a store that refuses requests stops the run; nothing is recorded for the refused task', async () => {
  const search = jest.spyOn(scrapers, 'scrapePlatform')
    .mockResolvedValueOnce(searchResult([]))
    .mockResolvedValueOnce(searchResult([])) // a task makes two queries: full title, then brand + series
    .mockResolvedValue({ platform: 'daraz', status: 'failed', listings: [], error: 'captcha', ms: 1 });
  const out = await runCatalogSync({ batch: 8 });
  expect(out.status).toBe('partial');
  expect(out.summary).toMatchObject({ tasks: 1, blocked: 1 });
  expect(search.mock.calls.length).toBeLessThanOrEqual(4); // stopped, did not keep hammering the store
  expect(Object.keys((await Setting.findOne({ key: 'catalogSync' })).value)).toHaveLength(1);
  expect((await JobRun.findOne({ name: 'catalog-sync' })).error).toBe('captcha');
});

test('a listing already linked to a product page is re-fetched by its link, never searched', async () => {
  jest.spyOn(scrapers, 'scrapePlatform').mockResolvedValueOnce(searchResult([darazItem()])).mockResolvedValue(searchResult([]));
  await runCatalogSync({ batch: 1 });
  const product = await Product.findOne({ title: FIRST.t });
  await Setting.deleteOne({ key: 'catalogSync' }); // make it due again

  const search = jest.spyOn(scrapers, 'scrapePlatform').mockClear();
  const fetchOne = jest.spyOn(scrapers, 'fetchCurrentListing').mockResolvedValue({ status: 'success', listing: darazItem({ price: 299999 }) });
  const out = await runCatalogSync({ batch: 1 });
  expect(out.summary).toMatchObject({ refreshed: 1, pricesChanged: 1 });
  expect(fetchOne).toHaveBeenCalledTimes(1);
  expect(search).not.toHaveBeenCalled();
  expect((await Listing.findOne({ productId: product._id })).price).toBe(299999);
  expect(await PriceHistory.countDocuments({ productId: product._id })).toBe(2);
});

test('accessories, clones and wrong-price items are not stored', async () => {
  jest.spyOn(scrapers, 'scrapePlatform').mockResolvedValue(searchResult([
    darazItem({ externalId: '1', title: 'Silicone Case for Apple iPhone 16 128GB', price: 799 }),
    darazItem({ externalId: '2', title: 'Apple iPhone 16 - 128GB First Copy', price: 25000 }),
    darazItem({ externalId: '3', title: 'Apple iPhone 16 Pro - 128GB', price: 349999 }),
  ]));
  const out = await runCatalogSync({ batch: 1 });
  expect(out.summary).toMatchObject({ matched: 0, noMatch: 1 });
  expect(await Listing.countDocuments()).toBe(0);
  expect(await Product.countDocuments()).toBe(0);
});

test('a store item that already belongs to another product is not stolen', async () => {
  jest.spyOn(scrapers, 'scrapePlatform').mockResolvedValue(searchResult([darazItem()]));
  await runCatalogSync({ batch: 1 });
  await Setting.deleteOne({ key: 'catalogSync' });
  await Listing.updateOne({ platform: 'daraz' }, { $set: { productId: (await Product.create({ title: 'Other', matchKey: 'other' }))._id } });
  const out = await runCatalogSync({ batch: 1 });
  expect(out.summary.matched).toBe(0);
  expect(await Listing.countDocuments()).toBe(1);
});

test('demo mode and concurrent runs are skipped', async () => {
  config.demoMode = true;
  expect((await runCatalogSync({ batch: 1 })).status).toBe('skipped');
  config.demoMode = false;
  const search = jest.spyOn(scrapers, 'scrapePlatform').mockImplementation(() => new Promise((r) => setTimeout(() => r(searchResult([])), 50)));
  const [a, b] = await Promise.all([runCatalogSync({ batch: 1 }), runCatalogSync({ batch: 1 })]);
  expect([a.status, b.status].filter((s) => s === 'skipped')).toHaveLength(1);
  expect(search).toHaveBeenCalled();
  expect(SECOND).toBeTruthy();
});

test('when one store refuses requests the others are still synced in the same run', async () => {
  config.catalogSync = { ...config.catalogSync, platforms: ['daraz', 'priceoye'] };
  const search = jest.spyOn(scrapers, 'scrapePlatform').mockImplementation(async (platform) => (
    platform === 'daraz' ? { platform, status: 'failed', listings: [], error: 'captcha', ms: 1 } : searchResult([])
  ));
  const out = await runCatalogSync({ batch: 3 });
  expect(out.summary).toMatchObject({ tasks: 3, blocked: 1 });
  expect(search.mock.calls.filter(([p]) => p === 'daraz')).toHaveLength(1); // asked Daraz once, then left it alone
  expect(search.mock.calls.filter(([p]) => p === 'priceoye').length).toBeGreaterThanOrEqual(3);
});

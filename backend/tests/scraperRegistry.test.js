const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');

afterEach(() => {
  config.demoMode = false;
  jest.restoreAllMocks();
  Object.values(scrapers.queues).forEach((q) => q.reset());
});

test('demo mode skips live scraping', async () => {
  config.demoMode = true;
  const res = await scrapers.scrapeAll('iphone 15');
  expect(Object.keys(res).sort()).toEqual(['daraz', 'priceoye']);
  Object.values(res).forEach((r) => expect(r).toMatchObject({ status: 'skipped', listings: [] }));
});

test('one platform failing does not break the others and never throws', async () => {
  jest.spyOn(scrapers.adapters.daraz, 'search').mockRejectedValue(
    Object.assign(new Error('Timed out'), { code: 'TIMEOUT' })
  );
  jest.spyOn(scrapers.adapters.priceoye, 'search').mockResolvedValue([{ externalId: '1', title: 'X', price: 10 }]);
  const res = await scrapers.scrapeAll('x');
  expect(res.daraz).toMatchObject({ status: 'failed', code: 'TIMEOUT', listings: [] });
  expect(res.priceoye).toMatchObject({ status: 'success' });
  expect(res.priceoye.listings).toHaveLength(1);
});

test('fetchCurrentListing prefers the exact externalId', async () => {
  jest.spyOn(scrapers.adapters.daraz, 'search').mockResolvedValue([
    { externalId: '2', title: 'Samsung Galaxy A55 5G 8GB 256GB', price: 120000 },
    { externalId: '1', title: 'Samsung Galaxy A55 5G 8GB 256GB Case', price: 500 },
  ]);
  const out = await scrapers.fetchCurrentListing({ platform: 'daraz', externalId: '2', title: 'Samsung Galaxy A55 5G 8GB 256GB' });
  expect(out.listing.price).toBe(120000);
});

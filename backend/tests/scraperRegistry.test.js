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

test('fetchCurrentListing re-fetches by id and never searches', async () => {
  const fetchListing = jest.spyOn(scrapers.adapters.daraz, 'fetchListing').mockResolvedValue({ externalId: '123', price: 120000 });
  const search = jest.spyOn(scrapers.adapters.daraz, 'search');
  const out = await scrapers.fetchCurrentListing({ platform: 'daraz', externalId: '123', url: 'https://www.daraz.pk/products/x-i123.html', title: 'whatever' });
  expect(out).toMatchObject({ status: 'success', listing: { price: 120000 } });
  expect(fetchListing).toHaveBeenCalledTimes(1);
  expect(search).not.toHaveBeenCalled();
});

test('an item the store no longer lists comes back as success with a null listing', async () => {
  jest.spyOn(scrapers.adapters.priceoye, 'fetchListing').mockResolvedValue(null);
  const out = await scrapers.fetchCurrentListing({ platform: 'priceoye', externalId: '1', url: 'https://priceoye.pk/mobiles/x/y' });
  expect(out).toMatchObject({ status: 'success', listing: null });
});

test('sample listings without a store link are unlinked and cause no request', async () => {
  const spy = jest.spyOn(scrapers.adapters.daraz, 'fetchListing');
  const out = await scrapers.fetchCurrentListing({ platform: 'daraz', externalId: 'seed-x-daraz', url: 'https://www.daraz.pk/catalog/?q=x' });
  expect(out.status).toBe('unlinked');
  expect(spy).not.toHaveBeenCalled();
  expect(scrapers.canRefetch({ platform: 'priceoye', url: 'https://priceoye.pk/search?q=x' })).toBe(false);
});

test('a failing store is reported as failed, not thrown', async () => {
  jest.spyOn(scrapers.adapters.daraz, 'fetchListing').mockRejectedValue(Object.assign(new Error('boom'), { code: 'TIMEOUT' }));
  const out = await scrapers.fetchCurrentListing({ platform: 'daraz', externalId: '5', url: 'https://www.daraz.pk/products/y-i5.html' });
  expect(out).toMatchObject({ status: 'failed', code: 'TIMEOUT' });
});

test('demo mode skips re-fetching', async () => {
  config.demoMode = true;
  const out = await scrapers.fetchCurrentListing({ platform: 'daraz', externalId: '5', url: '' });
  expect(out.status).toBe('skipped');
});

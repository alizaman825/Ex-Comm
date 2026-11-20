const request = require('supertest');
const axios = require('axios');
const { createApp } = require('../src/app');
const { config } = require('../src/config/env');
const scrapers = require('../src/scrapers');
const ebay = require('../src/scrapers/ebay');
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
  ebay.resetToken();
  Object.values(scrapers.queues).forEach((q) => q.reset());
  await SearchCache.deleteMany({});
});

const item = (id, title, price, extra = {}) => ({
  itemId: id,
  title,
  itemWebUrl: `https://www.ebay.com/itm/${id}`,
  image: { imageUrl: `https://img.example/${id}.jpg` },
  price: { value: String(price), currency: 'USD' },
  ...extra,
});

describe('eBay adapter', () => {
  describe('mapItem', () => {
    it('maps a USD item summary to a normalized supplier listing', () => {
      expect(ebay.mapItem(item('v1|1', 'Xiaomi Mi Band 8', 39.99))).toMatchObject({
        platform: 'ebay',
        role: 'supplier',
        externalId: 'v1|1',
        title: 'Xiaomi Mi Band 8',
        url: 'https://www.ebay.com/itm/v1|1',
        image: 'https://img.example/v1|1.jpg',
        priceUsd: 39.99,
        inStock: true,
        condition: 'unknown',
        conditionLabel: null,
        multiVariant: false,
      });
    });

    it('skips items with no price, no id/title, or a non-USD price', () => {
      expect(ebay.mapItem(item('1', 'x', 0))).toBeNull();
      expect(ebay.mapItem({ ...item('1', 'x', 10), itemId: undefined })).toBeNull();
      expect(ebay.mapItem({ ...item('1', 'x', 10), price: { value: '10', currency: 'GBP' } })).toBeNull();
    });

    it('reports item condition, normalized to new/used/refurbished', () => {
      expect(ebay.mapItem(item('1', 'x', 10, { condition: 'New', conditionId: '1000' }))).toMatchObject({ condition: 'new', conditionLabel: 'New' });
      expect(ebay.mapItem(item('1', 'x', 10, { condition: 'Used', conditionId: '3000' }))).toMatchObject({ condition: 'used', conditionLabel: 'Used' });
      expect(ebay.mapItem(item('1', 'x', 10, { condition: 'Seller refurbished', conditionId: '2500' }))).toMatchObject({ condition: 'refurbished' });
      expect(ebay.mapItem(item('1', 'x', 10, { condition: 'Manufacturer refurbished', conditionId: '2000' }))).toMatchObject({ condition: 'refurbished' });
      expect(ebay.mapItem(item('1', 'x', 10, { condition: 'For parts or not working', conditionId: '7000' }))).toMatchObject({ condition: 'used' });
      expect(ebay.mapItem(item('1', 'x', 10))).toMatchObject({ condition: 'unknown' });
    });

    it('flags multi-variation listings, where the price shown is only the cheapest option', () => {
      expect(ebay.mapItem(item('1', 'x', 10, { itemGroupType: 'SELLER_DEFINED_VARIATIONS' }))).toMatchObject({ multiVariant: true });
      expect(ebay.mapItem(item('1', 'x', 10))).toMatchObject({ multiVariant: false });
    });
  });

  describe('getToken', () => {
    it('fetches and caches an application token, refetching once it is about to expire', async () => {
      config.ebay.clientId = 'id';
      config.ebay.clientSecret = 'secret';
      const post = jest.spyOn(axios, 'post').mockResolvedValue({ status: 200, data: { access_token: 'tok-1', expires_in: 7200 } });
      expect(await ebay.getToken()).toBe('tok-1');
      expect(await ebay.getToken()).toBe('tok-1');
      expect(post).toHaveBeenCalledTimes(1); // second call reused the cached token

      post.mockResolvedValue({ status: 200, data: { access_token: 'tok-2', expires_in: 7200 } });
      ebay.resetToken();
      expect(await ebay.getToken()).toBe('tok-2');
      expect(post).toHaveBeenCalledTimes(2);
    });

    it('reports missing credentials as a config error, not a crash', async () => {
      config.ebay.clientId = '';
      config.ebay.clientSecret = '';
      await expect(ebay.getToken()).rejects.toMatchObject({ code: 'CONFIG' });
    });
  });
});

describe('POST /api/search/ebay', () => {
  const post = (q) => request(app).post('/api/search/ebay').send({ q });

  it('is refused in demo mode', async () => {
    config.demoMode = true;
    const res = await post('xiaomi mi band 8');
    expect(res.status).toBe(409);
  });

  it('validates the query', async () => {
    expect((await post('a')).status).toBe(400);
  });

  it('converts USD to PKR using the saved exchange rate, stores the listing as a supplier offer, and adds it to an existing live result list', async () => {
    await Setting.set('usdToPkr', 300);
    jest.spyOn(scrapers.adapters.ebay, 'search').mockResolvedValue(
      Object.assign([{ platform: 'ebay', role: 'supplier', externalId: 'eb-1', title: 'Zeta Quantum Widget 9000', url: 'https://www.ebay.com/itm/eb-1', priceUsd: 40, inStock: true, reviewCount: 0 }], { meta: { total: 1 } })
    );
    await SearchCache.create({ queryKey: 'live:zeta quantum widget', query: 'zeta quantum widget', productIds: [], platformState: { daraz: { nextPage: 2, loaded: 0, total: 0, exhausted: true, status: 'success' } }, platformStatus: {}, source: 'live', fetchedAt: new Date() });

    const res = await post('zeta quantum widget');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });

    const listing = await Listing.findOne({ platform: 'ebay', externalId: 'eb-1' }).lean();
    expect(listing).toMatchObject({ role: 'supplier', price: 12000, currency: 'PKR', priceUsd: 40, dataSource: 'live' });

    const cache = await SearchCache.findOne({ queryKey: 'live:zeta quantum widget' }).lean();
    expect(cache.productIds).toHaveLength(1);
    expect(cache.platformStatus.ebay.total).toBe(1);
  });

  it('drops eBay results that are not actually relevant to the search, so they cannot attach to the wrong product', async () => {
    await Setting.set('usdToPkr', 300);
    jest.spyOn(scrapers.adapters.ebay, 'search').mockResolvedValue(
      Object.assign(
        [
          { platform: 'ebay', role: 'supplier', externalId: 'eb-match', title: 'Quokka Blaster Pro 5', url: 'https://www.ebay.com/itm/eb-match', priceUsd: 40, inStock: true, reviewCount: 0, condition: 'used' },
          { platform: 'ebay', role: 'supplier', externalId: 'eb-nomatch', title: 'Unrelated Toaster Oven', url: 'https://www.ebay.com/itm/eb-nomatch', priceUsd: 15, inStock: true, reviewCount: 0, condition: 'new' },
        ],
        { meta: { total: 2 } }
      )
    );

    const res = await post('quokka blaster pro 5');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });
    expect(await Listing.findOne({ platform: 'ebay', externalId: 'eb-match' }).lean()).not.toBeNull();
    expect(await Listing.findOne({ platform: 'ebay', externalId: 'eb-nomatch' }).lean()).toBeNull();
  });

  it('stores eBay condition and multi-variation flag on the listing', async () => {
    await Setting.set('usdToPkr', 300);
    jest.spyOn(scrapers.adapters.ebay, 'search').mockResolvedValue(
      Object.assign(
        [
          {
            platform: 'ebay', role: 'supplier', externalId: 'eb-cond', title: 'Nebula Sprocket Max 2', url: 'https://www.ebay.com/itm/eb-cond', priceUsd: 50, inStock: true, reviewCount: 0,
            condition: 'used', conditionLabel: 'Used', multiVariant: true,
          },
        ],
        { meta: { total: 1 } }
      )
    );

    const res = await post('nebula sprocket max 2');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', found: 1 });
    expect(await Listing.findOne({ platform: 'ebay', externalId: 'eb-cond' }).lean()).toMatchObject({ condition: 'used', conditionLabel: 'Used', multiVariant: true });
  });

  it('reports a failure (e.g. missing credentials) without throwing', async () => {
    jest.spyOn(scrapers.adapters.ebay, 'search').mockRejectedValue(Object.assign(new Error('eBay is not configured'), { code: 'CONFIG' }));
    const res = await post('some product');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'failed', code: 'CONFIG' });
  });
});

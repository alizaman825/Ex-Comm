const axios = require('axios');

jest.mock('axios');

const { config } = require('../src/config/env');
const mega = require('../src/scrapers/mega');
const { analyzeTitle } = require('../src/services/matching');
const { runMegaSync, politeDelay } = require('../src/jobs/megaSync');
const { Product, Listing, PriceHistory } = require('../src/models');
const { startDb, stopDb, clearDb } = require('./helpers');

const saved = config.megaSync;
beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  axios.get.mockReset(); // jest.mock('axios')'s call history is not cleared by restoreAllMocks()
  config.megaSync = { ...saved, enabled: true, maxPagesPerRun: 10, minDelayMs: 0, maxDelayMs: 0, maxRetries: 2 };
});
afterEach(() => {
  jest.restoreAllMocks();
  config.demoMode = false;
  config.megaSync = saved;
});

const sitemapIndexXml = '<sitemapindex><sitemap><loc>https://www.mega.pk/sitemap-products-1.xml</loc></sitemap></sitemapindex>';
const productSitemapXml = (urls) => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;
const productPage = ({ name, price, availability = 'InStock', productID = '1' }) =>
  `<html><head></head><body><script type="application/ld+json">${JSON.stringify({
    '@type': 'Product',
    name,
    productID,
    url: `https://www.mega.pk/laptop_products/${productID}/x.html`,
    offers: { '@type': 'Offer', price: String(price), priceCurrency: 'PKR', availability: `https://schema.org/${availability}` },
  })}</script></body></html>`;

test('the kill switch is off by default: no network calls, run is skipped', async () => {
  config.megaSync.enabled = false;
  const spy = jest.spyOn(mega, 'discoverProductSitemaps');
  const out = await runMegaSync({});
  expect(out.status).toBe('skipped');
  expect(spy).not.toHaveBeenCalled();
});

test('discovers products via the sitemap and stores a new product for a launch-category item', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.mega.pk/laptop_products/9001/HP-Victus.html']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ name: 'HP Victus Gaming Laptop Core i5', price: '215,000', productID: '9001' }), headers: {} });

  const out = await runMegaSync({});
  expect(out.summary).toMatchObject({ pagesFetched: 1, created: 1 });
  const listing = await Listing.findOne({ platform: 'mega' });
  expect(listing).toMatchObject({ price: 215000, dataSource: 'live', seeded: false, inStock: true });
  expect(await PriceHistory.countDocuments({ listingId: listing._id, source: 'real' })).toBe(1);
});

test('an item outside the launch categories is fetched but not stored', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.mega.pk/tshirt_products/9002/x.html']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ name: "Men's Cotton T-Shirt", price: '1,499', productID: '9002' }), headers: {} });

  const out = await runMegaSync({});
  expect(out.summary).toMatchObject({ pagesFetched: 1, skippedCategory: 1, created: 0 });
  expect(await Listing.countDocuments()).toBe(0);
});

test('an existing product with the exact same normalized title is matched, not duplicated (reuses the one matching pipeline)', async () => {
  await Product.create({ title: 'HP Victus Gaming Laptop Core i5', matchKey: analyzeTitle('HP Victus Gaming Laptop Core i5').key });
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.mega.pk/laptop_products/9001/x.html']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ name: 'HP Victus Gaming Laptop Core i5', price: '215,000', productID: '9001' }), headers: {} });

  const out = await runMegaSync({});
  expect(out.summary).toMatchObject({ matched: 1, created: 0 });
  expect(await Product.countDocuments()).toBe(1);
});

test('a title with no confident exact match is kept as its own separate product, not merged', async () => {
  await Product.create({ title: 'HP Victus Gaming Laptop Core i5 Pro', matchKey: analyzeTitle('HP Victus Gaming Laptop Core i5 Pro').key });
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.mega.pk/laptop_products/9001/x.html']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ name: 'HP Victus Gaming Laptop Core i5', price: '215,000', productID: '9001' }), headers: {} });

  const out = await runMegaSync({});
  expect(out.summary).toMatchObject({ created: 1 });
  expect(await Product.countDocuments()).toBe(2); // the Pro variant and this new unmatched one, never merged
});

test('a 429 is retried with backoff, then the run stops immediately once retries are exhausted', async () => {
  config.megaSync.maxRetries = 1;
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.mega.pk/laptop_products/1/x.html']), headers: {} })
    .mockResolvedValue({ status: 429, data: '', headers: {} });

  const out = await runMegaSync({});
  expect(out.status).toBe('failed');
  expect(out.summary.blocked).toBe(1);
  // 2 discovery calls + (1 initial attempt + 1 retry) product-page calls = 4
  expect(axios.get).toHaveBeenCalledTimes(4);
});

test('never requests a disallowed URL (query string, cart path, or another host)', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({
      status: 200,
      data: productSitemapXml([
        'https://www.mega.pk/laptop_products/1/x.html',
        'https://www.mega.pk/laptops/?q=laptop',
        'https://www.mega.pk/cart/123',
        'https://evil.example.com/laptop_products/2/y.html',
      ]),
      headers: {},
    })
    .mockResolvedValue({ status: 200, data: productPage({ name: 'HP Victus Gaming Laptop', price: '1,000', productID: '1' }), headers: {} });

  await runMegaSync({});
  const requested = axios.get.mock.calls.map(([url]) => url);
  expect(requested.some((u) => u.includes('?q='))).toBe(false);
  expect(requested.some((u) => u.includes('/cart/'))).toBe(false);
  expect(requested.some((u) => u.includes('evil.example.com'))).toBe(false);
});

test('the polite delay between product requests stays within the configured window', () => {
  config.megaSync = { ...config.megaSync, minDelayMs: 3000, maxDelayMs: 5000 };
  for (let i = 0; i < 20; i += 1) {
    const d = politeDelay();
    expect(d).toBeGreaterThanOrEqual(3000);
    expect(d).toBeLessThanOrEqual(5000);
  }
});

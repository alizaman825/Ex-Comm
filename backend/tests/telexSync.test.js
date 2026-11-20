const axios = require('axios');

jest.mock('axios');

const { config } = require('../src/config/env');
const telex = require('../src/scrapers/telex');
const { analyzeTitle } = require('../src/services/matching');
const { runTelexSync, politeDelay } = require('../src/jobs/telexSync');
const { Product, Listing, PriceHistory } = require('../src/models');
const { startDb, stopDb, clearDb } = require('./helpers');

const saved = config.telexSync;
beforeAll(startDb);
afterAll(stopDb);
beforeEach(async () => {
  await clearDb();
  config.telexSync = { ...saved, enabled: true, maxPagesPerRun: 10, minDelayMs: 0, maxDelayMs: 0, maxRetries: 2 };
});
afterEach(() => {
  jest.restoreAllMocks();
  config.demoMode = false;
  config.telexSync = saved;
});

const sitemapIndexXml = '<sitemapindex><sitemap><loc>https://www.telex.pk/sitemap_products_1.xml?from=1&amp;to=2</loc></sitemap></sitemapindex>';
const productSitemapXml = (urls) => `<urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;
const productPage = ({ title, price, inStock = true }) => `<html><head>
  <meta property="og:title" content="${title}">
  <meta property="og:price:amount" content="${price}">
  <meta property="og:price:currency" content="PKR">
  </head><body><script>var p = {"variants":[{"available":${inStock}}]}</script></body></html>`;

test('the kill switch is off by default: no network calls, run is skipped', async () => {
  config.telexSync.enabled = false;
  const spy = jest.spyOn(telex, 'discoverProductSitemaps');
  const out = await runTelexSync({});
  expect(out.status).toBe('skipped');
  expect(spy).not.toHaveBeenCalled();
});

test('discovers products via the sitemap and stores a new product for a launch-category item', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.telex.pk/products/infinix-hot-60i']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ title: 'Infinix Hot 60i Dual Sim', price: '53,449.00' }), headers: {} });

  const out = await runTelexSync({});
  expect(out.summary).toMatchObject({ pagesFetched: 1, created: 1 });
  const listing = await Listing.findOne({ platform: 'telex' });
  expect(listing).toMatchObject({ price: 53449, dataSource: 'live', seeded: false, inStock: true });
  expect(await PriceHistory.countDocuments({ listingId: listing._id, source: 'real' })).toBe(1);
});

test('an item outside the launch categories is fetched but not stored', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.telex.pk/products/tshirt']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ title: "Men's Cotton T-Shirt", price: '1,499.00' }), headers: {} });

  const out = await runTelexSync({});
  expect(out.summary).toMatchObject({ pagesFetched: 1, skippedCategory: 1, created: 0 });
  expect(await Listing.countDocuments()).toBe(0);
});

test('an existing product with the exact same normalized title is matched, not duplicated', async () => {
  await Product.create({ title: 'Infinix Hot 60i', matchKey: analyzeTitle('Infinix Hot 60i').key });
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.telex.pk/products/infinix-hot-60i']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ title: 'Infinix Hot 60i', price: '53,449.00' }), headers: {} });

  const out = await runTelexSync({});
  expect(out.summary).toMatchObject({ matched: 1, created: 0 });
  expect(await Product.countDocuments()).toBe(1);
});

test('a title with no confident exact match is kept as its own separate product, not merged', async () => {
  await Product.create({ title: 'Infinix Hot 60i Pro', matchKey: analyzeTitle('Infinix Hot 60i Pro').key });
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.telex.pk/products/infinix-hot-60i']), headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productPage({ title: 'Infinix Hot 60i', price: '53,449.00' }), headers: {} });

  const out = await runTelexSync({});
  expect(out.summary).toMatchObject({ created: 1 });
  expect(await Product.countDocuments()).toBe(2); // the Pro variant and this new unmatched one, never merged
});

test('a 429 is retried with backoff, then the run stops immediately once retries are exhausted', async () => {
  config.telexSync.maxRetries = 1;
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({ status: 200, data: productSitemapXml(['https://www.telex.pk/products/x']), headers: {} })
    .mockResolvedValue({ status: 429, data: '', headers: {} });

  const out = await runTelexSync({});
  expect(out.status).toBe('failed');
  expect(out.summary.blocked).toBe(1);
  // 2 discovery calls + (1 initial attempt + 1 retry) product-page calls = 4
  expect(axios.get).toHaveBeenCalledTimes(4);
});

test('never requests a disallowed URL (cart path, or another host)', async () => {
  axios.get
    .mockResolvedValueOnce({ status: 200, data: sitemapIndexXml, headers: {} })
    .mockResolvedValueOnce({
      status: 200,
      data: productSitemapXml(['https://www.telex.pk/products/x', 'https://www.telex.pk/cart/123', 'https://evil.example.com/products/y']),
      headers: {},
    })
    .mockResolvedValue({ status: 200, data: productPage({ title: 'Infinix Hot 60i', price: '1,000.00' }), headers: {} });

  await runTelexSync({});
  const requested = axios.get.mock.calls.map(([url]) => url);
  expect(requested.some((u) => u.includes('/cart/'))).toBe(false);
  expect(requested.some((u) => u.includes('evil.example.com'))).toBe(false);
});

test('the polite delay between product requests stays within the configured window', () => {
  config.telexSync = { ...config.telexSync, minDelayMs: 3000, maxDelayMs: 5000 };
  for (let i = 0; i < 20; i += 1) {
    const d = politeDelay();
    expect(d).toBeGreaterThanOrEqual(3000);
    expect(d).toBeLessThanOrEqual(5000);
  }
});

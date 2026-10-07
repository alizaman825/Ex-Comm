const { startDb, stopDb, clearDb } = require('./helpers');
const { seedDatabase } = require('../src/seed/seed');
const { Product, Listing, PriceHistory } = require('../src/models');
const real = require('../src/seed/listings.json');

beforeAll(async () => {
  await startDb();
  await seedDatabase({ source: 'real', log: () => {} });
});
afterAll(async () => {
  await clearDb();
  await stopDb();
});

const isProductPage = (url) => {
  const u = new URL(url);
  const parts = u.pathname.split('/').filter(Boolean);
  if (u.hostname.endsWith('daraz.pk')) return /-i[0-9]+[.]html$/.test(u.pathname);
  if (u.hostname.endsWith('priceoye.pk')) return parts.length >= 3 && parts[0] !== 'search';
  if (u.hostname.endsWith('aliexpress.com')) return /^[/]item[/][0-9]+[.]html$/.test(u.pathname);
  return false;
};

test('every seeded listing links straight to its product page, never to a search page', async () => {
  const listings = await Listing.find().lean();
  expect(listings.length).toBeGreaterThan(0);
  for (const l of listings) expect({ url: l.url, ok: isProductPage(l.url) }).toEqual({ url: l.url, ok: true });
});

test('seeded prices are exactly the captured store prices', async () => {
  const listings = await Listing.find().populate('productId', 'title').lean();
  for (const l of listings) {
    const captured = real[l.productId.title][l.platform];
    expect(l.price).toBe(captured.price);
    expect(l.externalId).toBe(captured.externalId);
    expect(l.url).toBe(captured.url);
  }
});

test('the price history ends at the real price and no product is seeded without a retail store', async () => {
  const listing = await Listing.findOne().lean();
  const last = await PriceHistory.findOne({ listingId: listing._id }).sort({ scrapedAt: -1 }).lean();
  expect(last.price).toBe(listing.price);
  const products = await Product.find().lean();
  for (const p of products) expect(p.platforms.some((x) => x !== 'aliexpress')).toBe(true);
});

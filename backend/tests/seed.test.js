const { startDb, stopDb } = require('./helpers');
const { seedDatabase, DEMO_USER } = require('../src/seed/seed');
const catalog = require('../src/seed/catalog');
const { Product, Listing, PriceHistory, User, Wishlist, Alert, Notification } = require('../src/models');

let summary;

beforeAll(async () => {
  await startDb();
  summary = await seedDatabase({ log: () => {} });
});
afterAll(stopDb);

test('creates one product per catalog entry with unique match keys', async () => {
  expect(await Product.countDocuments()).toBe(catalog.length);
  expect(catalog.length).toBeGreaterThanOrEqual(60);
});

test('every product has 1-3 listings and up-to-date stats', async () => {
  const products = await Product.find().lean();
  for (const p of products) {
    expect(p.listingCount).toBeGreaterThanOrEqual(1);
    expect(p.minPrice).toBeGreaterThan(0);
    expect(p.maxPrice).toBeGreaterThanOrEqual(p.minPrice);
    expect(p.platforms.length).toBe(p.listingCount);
  }
  const threeStore = products.filter((p) => p.platforms.length === 3).length;
  expect(threeStore).toBeGreaterThan(30); // compare view shows three stores for most products
});

test('price history covers 90 days and ends at the current listing price', async () => {
  const listing = await Listing.findOne({ platform: 'daraz' }).lean();
  const points = await PriceHistory.find({ listingId: listing._id }).sort({ scrapedAt: 1 }).lean();
  expect(points).toHaveLength(90);
  expect(points[points.length - 1].price).toBe(listing.price);
  expect(summary.priceHistory).toBe((await Listing.countDocuments()) * 90);
});

test('some products show a recent price drop', async () => {
  expect(await Product.countDocuments({ priceChange7d: { $lt: -5 } })).toBeGreaterThan(3);
});

test('demo user can log in and has wishlist, alerts and notifications', async () => {
  const user = await User.findOne({ email: DEMO_USER.email }).select('+passwordHash');
  expect(await user.checkPassword(DEMO_USER.password)).toBe(true);
  expect(await Wishlist.countDocuments({ userId: user._id })).toBe(6);
  expect(await Alert.countDocuments({ userId: user._id })).toBe(4);
  expect(await Notification.countDocuments({ userId: user._id, read: false })).toBe(1);
});

test('re-running the seed is idempotent', async () => {
  await seedDatabase({ log: () => {} });
  expect(await Product.countDocuments()).toBe(catalog.length);
  expect(await User.countDocuments({ email: DEMO_USER.email })).toBe(1);
});

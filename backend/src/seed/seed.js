// Seeds realistic sample data: products on 2-3 platforms, 90 days of daily price history,
// and a demo user with wishlist, alerts and notifications. Deterministic (fixed RNG seed).

const mongoose = require('mongoose');
const catalog = require('./catalog');
const { analyzeTitle, searchKeyOf } = require('../services/matching');
const { refreshProductsStats } = require('../services/productStats');
const { ensureCategories, resolveCategory } = require('../services/categories');
const { queryKeyOf, localSearch } = require('../services/search');
const { parseQuery } = require('../services/relevance');
const { Product, Listing, PriceHistory, SearchCache, User, Wishlist, Alert, Notification, ScrapeLog, Category, Setting } = require('../models');

// Product image URLs harvested from the live stores (scripts/calibrate-catalog.js); optional.
let IMAGES = {};
try {
  IMAGES = require('./images.json');
} catch {
  IMAGES = {};
}

const DAY = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 90;
const DEMO_USER = { name: 'Demo User', email: 'demo@excomm.pk', password: 'demo1234' };

// mulberry32: small deterministic PRNG so every seed run produces the same data.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LABEL = { daraz: 'Daraz', priceoye: 'PriceOye', aliexpress: 'AliExpress' };
const PLATFORM_OF = { d: 'daraz', p: 'priceoye', a: 'aliexpress' };

const PROFILE = {
  daraz: { factor: [-0.04, 0.05], mrp: [1.1, 1.4], rating: [3.9, 4.8], reviews: [20, 2500] },
  priceoye: { factor: [-0.03, 0.03], mrp: [1.02, 1.12], rating: [4.0, 4.9], reviews: [5, 400] },
  aliexpress: { factor: [-0.12, 0.04], mrp: [1.3, 2.0], rating: [3.8, 4.8], reviews: [50, 8000] },
};

// AliExpress (supplier) price relative to Pakistani retail, by category: phones/laptops are close to
// retail, generic electronics, watches and fashion are much cheaper at the source.
const SUPPLIER_FACTOR = {
  mobiles: [-0.18, -0.04],
  laptops: [-0.2, -0.05],
  audio: [-0.5, -0.2],
  watches: [-0.5, -0.2],
  'home-appliances': [-0.45, -0.15],
  fashion: [-0.6, -0.3],
};

const roundPrice = (p) => (p >= 1000 ? Math.round(p / 100) * 100 - 1 : Math.round(p));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function listingTitle(platform, item) {
  const isPhone = item.c === 'Mobiles';
  if (platform === 'daraz') {
    return isPhone ? `${item.t} - PTA Approved - Official Warranty` : `${item.t} - Original - Official Warranty`;
  }
  if (platform === 'priceoye') return item.t;
  return isPhone ? `${item.t} Global Version Smartphone` : `${item.t} Global Version`;
}

function listingUrl(platform, title) {
  const q = encodeURIComponent(title);
  if (platform === 'daraz') return `https://www.daraz.pk/catalog/?q=${q}`;
  if (platform === 'priceoye') return `https://priceoye.pk/search?q=${q}`;
  return `https://www.aliexpress.com/w/wholesale-${slug(title)}.html`;
}

// Daily prices for HISTORY_DAYS ending exactly at `current`: gentle downward drift, noise,
// occasional sales, and optionally a recent drop (for the "price drops" section).
function priceSeries(current, rand, { recentDrop }) {
  const start = current * (1 + 0.02 + rand() * 0.1);
  const saleDay = Math.floor(10 + rand() * 60);
  const saleLen = Math.floor(3 + rand() * 5);
  const saleCut = 0.08 + rand() * 0.07;
  const dropFactor = recentDrop ? 1.08 + rand() * 0.12 : 1;
  const series = [];
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const daysAgo = HISTORY_DAYS - 1 - i;
    let p = start + ((current * dropFactor - start) * i) / (HISTORY_DAYS - 1);
    p *= 1 + (rand() - 0.5) * 0.03;
    if (i >= saleDay && i < saleDay + saleLen) p *= 1 - saleCut;
    if (recentDrop && daysAgo < 5) p = current * (1 + (rand() - 0.5) * 0.01);
    series.push({ daysAgo, price: roundPrice(p) });
  }
  series[series.length - 1].price = current;
  return series;
}

// Popular searches shown on the home page. Seeded as fresh cache entries so they respond instantly
// (and work in DEMO_MODE) without scraping.
const TRENDING = [
  ['iphone 16', 214], ['samsung galaxy a55', 188], ['airpods pro', 163], ['redmi note 14', 141],
  ['macbook air', 127], ['air fryer', 119], ['sony headphones', 96], ['apple watch', 88],
  ['jbl speaker', 74], ["men's sneakers", 61],
];

async function seedTrending() {
  for (const [query, hits] of TRENDING) {
    // eslint-disable-next-line no-await-in-loop
    const products = await localSearch(parseQuery(query));
    // eslint-disable-next-line no-await-in-loop
    await SearchCache.updateOne(
      { queryKey: queryKeyOf(query) },
      {
        $set: {
          query, hits, source: 'cache', lastSearchedAt: new Date(), fetchedAt: new Date(),
          productIds: products.map((p) => p._id),
          platformStatus: { daraz: { status: 'success', saved: true }, priceoye: { status: 'success', saved: true } },
        },
      },
      { upsert: true }
    );
  }
}

async function clearAll() {
  await Promise.all(
    [Product, Listing, PriceHistory, SearchCache, Wishlist, Alert, Notification, ScrapeLog, Category].map((M) => M.deleteMany({}))
  );
  await User.deleteOne({ email: DEMO_USER.email });
}

async function seedDatabase({ reset = true, log = console.log } = {}) {
  const t0 = Date.now();
  const rand = rng(20261007);
  const between = ([lo, hi]) => lo + rand() * (hi - lo);
  if (reset) await clearAll();
  await Promise.all([Product, Listing, PriceHistory].map((M) => M.syncIndexes()));

  await ensureCategories();
  const settingRows = Object.entries(Setting.DEFAULTS);
  await Promise.all(settingRows.map(([k, v]) => Setting.updateOne({ key: k }, { $setOnInsert: { value: v } }, { upsert: true })));
  const fx = await Setting.getAll();

  const today = new Date();
  today.setHours(10, 0, 0, 0);
  const products = [];
  const listings = [];
  const history = [];

  catalog.forEach((item, idx) => {
    const productId = new mongoose.Types.ObjectId();
    products.push({
      _id: productId,
      title: item.t,
      matchKey: analyzeTitle(item.t).key,
      brand: item.b,
      category: resolveCategory(item.c),
      searchKey: searchKeyOf(item.b, item.t),
      image: IMAGES[item.t],
      popularity: Math.round(rand() * 60 + (item.c === 'Mobiles' ? 40 : 0)),
    });
    const recentDrop = idx % 7 === 3;

    for (const code of item.on) {
      const platform = PLATFORM_OF[code];
      const prof = PROFILE[platform];
      const title = listingTitle(platform, item);
      const isSupplier = platform === 'aliexpress';
      const factor = isSupplier ? SUPPLIER_FACTOR[resolveCategory(item.c)] : prof.factor;
      const price = roundPrice(item.p * (1 + between(factor)));
      const listingId = new mongoose.Types.ObjectId();
      listings.push({
        _id: listingId,
        productId,
        platform,
        role: isSupplier ? 'supplier' : 'retail',
        priceUsd: isSupplier ? Math.round((price / fx.usdToPkr) * 100) / 100 : undefined,
        externalId: `seed-${slug(item.t)}-${platform}`,
        title,
        image: IMAGES[item.t],
        url: listingUrl(platform, item.t),
        price,
        originalPrice: rand() < 0.75 ? roundPrice(price * between(prof.mrp)) : null,
        currency: 'PKR',
        rating: Math.round(between(prof.rating) * 10) / 10,
        reviewCount: Math.round(between(prof.reviews)),
        inStock: rand() > 0.05,
        seeded: true,
        dataSource: 'saved',
        lastScrapedAt: new Date(today.getTime() - Math.floor(rand() * 6) * 3600 * 1000),
      });
      for (const { daysAgo, price: p } of priceSeries(price, rand, { recentDrop })) {
        history.push({ listingId, productId, platform, price: p, scrapedAt: new Date(today.getTime() - daysAgo * DAY) });
      }
    }
  });

  await Product.insertMany(products);
  await Listing.insertMany(listings);
  await PriceHistory.insertMany(history);
  await refreshProductsStats(products.map((p) => p._id)); // one pass for every product

  // Demo user with wishlist, alerts and notifications.
  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) {
    user = new User({ name: DEMO_USER.name, email: DEMO_USER.email, emailAlerts: true });
    await user.setPassword(DEMO_USER.password);
    await user.save();
  }
  const byTitle = async (t) => Product.findOne({ title: t });
  const wish = ['Samsung Galaxy A55 5G 8GB 256GB', 'Apple AirPods Pro 2 USB-C', 'Sony WH-1000XM5 Wireless Headphones',
    'Apple MacBook Air M3 13in 8GB 256GB', 'Xiaomi Redmi Watch 5 Active', 'Apple Watch Series 10 46mm'];
  for (const [i, t] of wish.entries()) {
    // eslint-disable-next-line no-await-in-loop
    const p = await byTitle(t);
    // eslint-disable-next-line no-await-in-loop
    await Wishlist.create({ userId: user._id, productId: p._id, priceWhenAdded: roundPrice(p.minPrice * 1.06), createdAt: new Date(Date.now() - (20 - i) * DAY) });
  }

  const a55 = await byTitle('Samsung Galaxy A55 5G 8GB 256GB');
  const airpods = await byTitle('Apple AirPods Pro 2 USB-C');
  const ps5 = await byTitle('Apple Watch Series 10 46mm');
  const watch = await byTitle('Xiaomi Redmi Watch 5 Active');
  const triggeredAt = new Date(Date.now() - 2 * 3600 * 1000);
  const alerts = await Alert.insertMany([
    { userId: user._id, productId: a55._id, targetPrice: roundPrice(a55.minPrice * 1.02), platform: null, lastTriggeredAt: triggeredAt },
    { userId: user._id, productId: airpods._id, targetPrice: roundPrice(airpods.minPrice * 0.9), platform: 'daraz' },
    { userId: user._id, productId: ps5._id, targetPrice: roundPrice(ps5.minPrice * 0.93), platform: null },
    { userId: user._id, productId: watch._id, targetPrice: roundPrice(watch.minPrice * 0.85), platform: null, active: false },
  ]);
  await Notification.insertMany([
    {
      userId: user._id, alertId: alerts[0]._id, productId: a55._id, price: a55.minPrice, platform: a55.lowestPlatform,
      message: `Price drop: ${a55.title} is now Rs ${a55.minPrice.toLocaleString('en-PK')} on ${LABEL[a55.lowestPlatform]}, below your target.`,
      createdAt: triggeredAt,
    },
    {
      userId: user._id, alertId: alerts[1]._id, productId: airpods._id, price: roundPrice(airpods.minPrice * 0.89), platform: 'daraz', read: true,
      message: `Price drop: ${airpods.title} reached your target on Daraz during a sale.`,
      createdAt: new Date(Date.now() - 9 * DAY),
    },
  ]);

  await seedTrending(rand);

  await Setting.set('seedCompletedAt', new Date().toISOString()); // marks a complete seed (see ensureSeeded)

  const summary = { products: products.length, listings: listings.length, priceHistory: history.length, demoUser: DEMO_USER.email, ms: Date.now() - t0 };
  log(`Seed complete: ${JSON.stringify(summary)}`);
  return summary;
}

// Seeds on first start. A previous seed that was interrupted (products but no completion marker, e.g. the
// server was stopped while loading over a slow connection) is detected and redone from scratch.
async function ensureSeeded({ log = console.log } = {}) {
  if (await Setting.exists({ key: 'seedCompletedAt' })) return false;
  const partial = (await Product.estimatedDocumentCount()) > 0;
  log(partial ? 'Sample data looks incomplete: reloading it' : 'Database is empty: loading sample data');
  await seedDatabase({ reset: partial, log });
  return true;
}

module.exports = { seedDatabase, ensureSeeded, DEMO_USER, TRENDING };

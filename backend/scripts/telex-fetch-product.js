// One-off helper (2026-11-21 live-site review): ali's own test case, the "Apple iPhone 18 Pro"
// product, hadn't been reached yet by the resumable Telex sync (it walks the sitemap sequentially,
// capped per run). Rather than wait for however many scheduled runs it takes to cycle back to that
// one sub-sitemap range, this finds that single product's URL in Telex's own public sitemap (the
// same discovery path jobs/telexSync.js uses) and fetches/stores it through the exact same pipeline
// (telex.fetchProductPage + jobs/telexSync.js's storeProduct, including the same fuzzy matching and
// price-floor guard) - not a new scraping path, just pointed at one URL instead of the next unvisited
// batch. Polite delay between every request, same as a normal sync.
//
// Usage: node scripts/telex-fetch-product.js <handle-substring>
// e.g.:  node scripts/telex-fetch-product.js iphone-18-pro
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const telex = require('../src/scrapers/telex');
const { storeProduct, politeDelay } = require('../src/jobs/telexSync');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const needle = (process.argv[2] || '').toLowerCase();
  if (!needle) {
    console.error('Usage: node scripts/telex-fetch-product.js <handle-substring>');
    process.exit(1);
  }
  await connectDB(config.mongoUri);
  try {
    console.log(`Discovering Telex product sitemaps...`);
    const sitemaps = await telex.discoverProductSitemaps();
    console.log(`${sitemaps.length} product sub-sitemap(s) found.`);

    let targetUrl;
    for (const sitemapUrl of sitemaps) {
      await sleep(politeDelay());
      // eslint-disable-next-line no-await-in-loop
      const urls = await telex.discoverProductUrls(sitemapUrl);
      targetUrl = urls.find((u) => u.toLowerCase().includes(needle));
      if (targetUrl) {
        console.log(`Found match in ${sitemapUrl}: ${targetUrl}`);
        break;
      }
    }
    if (!targetUrl) {
      console.log(`No product URL matching "${needle}" found in any sub-sitemap.`);
      return;
    }

    await sleep(politeDelay());
    const found = await telex.fetchProductPage(targetUrl);
    console.log(`Fetched: "${found.title}" - Rs ${found.price} (inStock: ${found.inStock})`);
    if (!telex.isLaunchCategory(found.title)) {
      console.log('Skipped: not a launch category per the sync job\'s own filter.');
      return;
    }
    const { product, matched } = await storeProduct(found, new Date());
    console.log(`${matched ? 'Matched to existing product' : 'Created new product'}: "${product.title}" (${product._id})`);
  } finally {
    await disconnectDB();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

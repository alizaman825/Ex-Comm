// Captures the real store listing (product page URL, price, image, rating) of every seed catalog item on
// every store the catalog says sells it, and writes src/seed/listings.json. The seed uses this file, so
// sample data carries real prices and links straight to the product pages. A store without a confident
// match (same brand, model, variant and storage) is stored as null and left out of the seed.
// Resumable: items already in the file are skipped (use --refresh to redo all, or pass filter text).
// Usage: node scripts/harvest-listings.js [--refresh] [--only=daraz|priceoye|aliexpress] [--revalidate] [filterText]
// Be gentle: Daraz answers a burst of searches with a captcha page for a while. Run with SCRAPER_MIN_DELAY_MS=4000 SCRAPER_MAX_DELAY_MS=7000.
const fs = require('fs');
const path = require('path');
const catalog = require('../src/seed/catalog');
const scrapers = require('../src/scrapers');
const { significantTokens } = require('../src/services/matching');
const { pick, plausible } = require('../src/services/catalogMatch');

const FILE = path.join(__dirname, '../src/seed/listings.json');
const PLATFORM_OF = { d: 'daraz', p: 'priceoye', a: 'aliexpress' };

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const revalidate = args.includes('--revalidate');
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7);
const filter = (args.find((a) => !a.startsWith('--')) || '').toLowerCase();

const keep = (l, now) => ({
  externalId: l.externalId, title: l.title, url: l.url, image: l.image || null, price: l.price,
  originalPrice: l.originalPrice || null, rating: l.rating || null, reviewCount: l.reviewCount || 0,
  inStock: l.inStock !== false, capturedAt: now,
});

(async () => {
  const data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  if (revalidate) {
    // Offline: drop stored matches that fail the checks, so the next run looks them up again.
    let dropped = 0;
    for (const item of catalog) {
      const row = data[item.t] || {};
      for (const platform of Object.keys(row)) {
        if (row[platform] && !plausible(item, row[platform], row)) {
          console.log(`drop ${platform.padEnd(9)} ${item.t.slice(0, 40).padEnd(40)} Rs ${row[platform].price} ${row[platform].title.slice(0, 50)}`);
          delete row[platform];
          dropped += 1;
        }
      }
    }
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    console.log(`${dropped} stored matches dropped`);
    process.exit(0);
  }
  const todo = catalog.filter((c) => !filter || c.t.toLowerCase().includes(filter));
  let n = 0;
  let blocked = 0;
  for (const item of todo) {
    n += 1;
    const row = data[item.t] || {};
    for (const code of item.on) {
      const platform = PLATFORM_OF[code];
      if (only && only !== platform) continue;
      if (!refresh && !filter && row[platform]) continue; // decided matches are kept; misses are retried
      // Full title first; if the store has nothing, brand + series words only (the matcher stays strict).
      const queries = [item.t, significantTokens(item.t).slice(0, 4).join(' ')];
      let found = null;
      let failed = false;
      for (const q of [...new Set(queries)]) {
        // eslint-disable-next-line no-await-in-loop
        const r = await scrapers.scrapePlatform(platform, q, { kind: 'harvest' });
        if (r.status !== 'success') {
          failed = true;
          console.log(`   ${platform} "${q}": ${r.status} ${r.error || ''}`);
          break;
        }
        found = pick(item, r.listings, row);
        if (found) break;
      }
      if (failed) {
        blocked += 1;
        if (blocked >= 3) {
          console.log('Stopping: the store keeps refusing requests. Wait about an hour and run again (progress is saved).');
          process.exit(2);
        }
        continue; // leave undecided: a rerun tries again
      }
      blocked = 0;
      row[platform] = found ? keep(found, new Date().toISOString()) : null;
      console.log(`${String(n).padStart(3)}/${todo.length} ${platform.padEnd(10)} ${item.t.slice(0, 40).padEnd(40)} ${found ? `Rs ${found.price} ${found.url.slice(0, 60)}` : '-- no match'}`);
    }
    data[item.t] = row;
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
  }
  process.exit(0);
})();

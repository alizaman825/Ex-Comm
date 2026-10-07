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
const { analyzeTitle, significantTokens, accessoryWordsIn } = require('../src/services/matching');

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

// Words that change which product it is (Pro, Max, Ultra...): the listing must not have one the catalog lacks.
const EDITION = new Set('pro max plus ultra mini lite fe se neo prime slim oled xl'.split(' '));
const isStorage = (t) => /^[0-9]+(gb|tb)$/.test(t);
const hasDigit = (t) => /[0-9]/.test(t);
const gb = (t) => parseFloat(t) * (t.endsWith('tb') ? 1024 : 1);

// Coverage 0..1 when the listing is the catalog item (same brand, model numbers, edition and storage;
// store titles may add words such as 5G, PTA, colours), otherwise 0.
function coverage(item, listing) {
  const want = analyzeTitle(item.t);
  const got = analyzeTitle(listing.title);
  const have = new Set(got.tokens);
  const compact = got.tokens.join('');
  if (want.brand && got.brand && want.brand !== got.brand) return 0;
  const extraAccessory = accessoryWordsIn(got.tokens).some((w) => !want.tokens.includes(w));
  if (extraAccessory) return 0;
  const present = (t) => have.has(t) || compact.includes(t);
  if (!want.tokens.filter((t) => hasDigit(t) && !isStorage(t)).every(present)) return 0;
  if (got.tokens.some((t) => EDITION.has(t) && !want.tokens.includes(t))) return 0;
  const gotStorage = got.tokens.filter(isStorage).map(gb);
  const wantStorage = want.tokens.filter(isStorage).map(gb);
  if (gotStorage.length && wantStorage.length && Math.max(...gotStorage) !== Math.max(...wantStorage)) return 0;
  const hit = want.tokens.filter(present).length / want.tokens.length;
  return hit >= 0.6 ? hit : 0;
}

// Accessories and look-alikes that borrow the product name ("Strap for Apple Watch Series 10", "Case for ...").
const JUNK = /(strap|straps|bracelet|protector|replacement|compatible|cover|case|film|charger|cable|tpu|silicone|sticker|skin|holder|stand|tips|ear ?pads?|clone|copy|master ?copy|first ?copy)|for (apple|samsung|xiaomi|sony|jbl|huawei|amazfit|iphone|galaxy|airpods|watch|redmi|ipad|macbook)/i;

// A store price far from what this product costs elsewhere means a different item (accessory, clone, other
// model). Reference: PriceOye's real price when captured, else the catalog's approximate retail price.
function plausible(item, listing, row) {
  const ref = (row && row.priceoye && row.priceoye.price) || item.p;
  if (listing.price < ref * 0.55 || listing.price > ref * 1.6) return false;
  const bad = listing.title.match(JUNK);
  return !(bad && !item.t.toLowerCase().includes(bad[0].toLowerCase()));
}

// The store's best confident match: highest coverage, ties keep the store's own order.
function pick(item, listings, row) {
  let best = null;
  let bestScore = 0;
  for (const l of listings) {
    if (!l.price || !l.url || l.sponsored || !plausible(item, l, row)) continue;
    const cov = coverage(item, l);
    if (!cov) continue;
    const score = cov + (l.inStock !== false ? 0.001 : 0);
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

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

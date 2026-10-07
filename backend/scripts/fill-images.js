// Second pass for seed images: for catalog items without an image, take the first relevant,
// non-accessory result (looser than the fuzzy match used by calibrate-catalog.js).
// Usage: node scripts/fill-images.js   (updates src/seed/images.json)
const fs = require('fs');
const path = require('path');
const catalog = require('../src/seed/catalog');
const { scrapeAll } = require('../src/scrapers');
const { parseQuery, isRelevant } = require('../src/services/relevance');
const { significantTokens } = require('../src/services/matching');

const file = path.join(__dirname, '../src/seed/images.json');

(async () => {
  const images = JSON.parse(fs.readFileSync(file, 'utf8'));
  const missing = catalog.filter((c) => !images[c.t]);
  console.log(`${missing.length} items without an image`);
  for (const item of missing) {
    // Try the full title, then the first three meaningful words (brand + series).
    const queries = [item.t, significantTokens(item.t).slice(0, 3).join(' ')];
    let found;
    for (const q of queries) {
      // eslint-disable-next-line no-await-in-loop
      const res = await scrapeAll(q);
      const parsed = parseQuery(q);
      const hit = Object.values(res)
        .flatMap((r) => r.listings)
        .find((l) => l.image && isRelevant(parsed, l.title));
      if (hit) {
        found = hit.image;
        break;
      }
    }
    if (found) images[item.t] = found;
    console.log(`${found ? 'ok  ' : 'none'} ${item.t}`);
  }
  fs.writeFileSync(file, JSON.stringify(images, null, 2));
  console.log(`images: ${Object.keys(images).length} of ${catalog.length}`);
  process.exit(0);
})();

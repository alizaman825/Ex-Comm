// Dev tool: look up each seed catalog item on the live stores and report the best match
// (price, title, image) so the sample data stays realistic. Writes JSON to the given path.
// Usage: node scripts/calibrate-catalog.js out.json [filterText]
const fs = require('fs');
const catalog = require('../src/seed/catalog');
const { scrapeAll } = require('../src/scrapers');
const { analyzeTitle, findBestMatch } = require('../src/services/matching');

(async () => {
  const [out, filter] = process.argv.slice(2);
  const items = catalog.filter((c) => !filter || c.t.toLowerCase().includes(filter.toLowerCase()));
  const report = [];
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const results = await scrapeAll(item.t);
    const row = { t: item.t, p: item.p };
    for (const [platform, r] of Object.entries(results)) {
      const best = findBestMatch(analyzeTitle(item.t), r.listings);
      row[platform] = best
        ? { price: best.candidate.price, title: best.candidate.title, image: best.candidate.image, score: +best.score.toFixed(2) }
        : { none: true, status: r.status, top: r.listings.slice(0, 3).map((l) => `${l.title} @${l.price}`) };
    }
    report.push(row);
    const fmt = (x) => (x && x.price ? `${x.price}` : '-');
    console.log(`${item.t.padEnd(50)} seed ${item.p}  daraz ${fmt(row.daraz)}  priceoye ${fmt(row.priceoye)}`);
  }
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  process.exit(0);
})();

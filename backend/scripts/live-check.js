// Live smoke test of the scraper adapters (hits the real sites, politely).
// Usage: node scripts/live-check.js "galaxy a57" "airpods pro"
const { scrapeAll } = require('../src/scrapers');

(async () => {
  const queries = process.argv.slice(2);
  if (!queries.length) queries.push('samsung galaxy a57', 'airpods pro 3');
  for (const q of queries) {
    // eslint-disable-next-line no-await-in-loop
    const results = await scrapeAll(q);
    for (const r of Object.values(results)) {
      console.log(`${r.platform.padEnd(9)} "${q}": ${r.status} ${r.listings.length} items in ${r.ms} ms${r.error ? ` (${r.error})` : ''}`);
      for (const l of r.listings.slice(0, 3)) console.log(`   Rs ${l.price.toLocaleString()}  ${l.title.slice(0, 80)}`);
    }
  }
  process.exit(0);
})();

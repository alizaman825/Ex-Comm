// One-off CI verification for the on-demand adapters (Metro Online, SHEIN, Temu) that could not be
// checked from the sandbox this code was written in (its network policy blocks those hosts outright).
// GitHub Actions runners have normal internet access, so this runs there instead. No database needed:
// scrapePlatform() skips its ScrapeLog write when mongoose isn't connected.
// Usage: node scripts/verify-ondemand.js "query"
const { scrapePlatform } = require('../src/scrapers');

(async () => {
  const query = process.argv[2] || 'samsung galaxy a55';
  const platforms = ['metro', 'shein', 'temu'];
  let anyFailed = false;
  for (const platform of platforms) {
    // eslint-disable-next-line no-await-in-loop
    const r = await scrapePlatform(platform, query);
    console.log(`\n=== ${platform} ===`);
    console.log(`status: ${r.status}${r.error ? ` (${r.code || 'ERROR'}: ${r.error})` : ''}, ${r.listings.length} listing(s), ${r.ms} ms`);
    for (const l of r.listings.slice(0, 3)) console.log(`  ${l.price ?? l.priceUsd} ${l.currency || 'USD'}  ${l.title.slice(0, 80)}`);
    if (r.status !== 'success') anyFailed = true;
  }
  process.exit(anyFailed ? 1 : 0);
})();

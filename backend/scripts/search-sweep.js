// Live sweep: runs varied search terms against both live stores (first page, as the app does) and reports what
// each store returned, how many results the store says it has, and how many look like the searched product.
// Nothing is filtered in the app: "matching" here is only a measure of how good the store's own ranking is.
// Usage: node scripts/search-sweep.js ../docs/search_sweep.md
const fs = require('fs');
const scrapers = require('../src/scrapers');
const { parseQuery, isRelevant } = require('../src/services/relevance');
const { classify } = require('../src/services/categories');

const TERMS = [
  ['mobiles', 'iphone 16'], ['mobiles', 'samsung galaxy a55'], ['mobiles', 'redmi note 14'],
  ['laptops', 'macbook air m3'], ['laptops', 'hp victus'], ['laptops', 'lenovo ideapad'],
  ['audio', 'airpods pro'], ['audio', 'jbl flip 6'], ['audio', 'sony wh-1000xm5'],
  ['watches', 'apple watch series 10'], ['watches', 'amazfit gts'], ['watches', 'casio g-shock'],
  ['home-appliances', 'air fryer'], ['home-appliances', 'dyson vacuum'], ['home-appliances', 'haier inverter ac'],
  ['fashion', "men's sneakers"], ['fashion', 'nike air force 1'], ['fashion', 'levis jeans'],
  ['fashion', 'ray-ban sunglasses'], ['fashion', 'backpack'],
  ['other', 'women kurta'], ['other', 'bed sheet'], ['other', 'protein powder'],
  // accessory queries: accessory words are a preference, matching products from ANY store must be shown
  ['accessory', 'iphone 15 pro max cover'], ['accessory', 'samsung a15 case'], ['accessory', 'airpods pro case'],
  ['accessory', 'iphone 15 charger'], ['accessory', 'laptop sleeve 15 inch'], ['accessory', 'apple watch strap'],
];

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '-');

function fieldStats(listings) {
  const n = listings.length;
  const count = (fn) => listings.filter(fn).length;
  const cats = {};
  for (const l of listings) {
    const c = classify(l.title, l.category) || 'none';
    cats[c] = (cats[c] || 0) + 1;
  }
  return {
    image: pct(count((l) => l.image), n),
    rating: pct(count((l) => l.rating), n),
    original: pct(count((l) => l.originalPrice), n),
    topCategory: Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
  };
}

(async () => {
  const out = process.argv[2];
  const rows = [];
  for (const [expected, term] of TERMS) {
    // eslint-disable-next-line no-await-in-loop
    const parsed = parseQuery(term);
    const results = await Promise.all(scrapers.livePlatforms().map((p) => scrapers.scrapePlatform(p, term, { page: 1 })));
    for (const r of results) {
      const own = r.listings || [];
      const relevant = own.filter((l) => isRelevant(parsed, l.title)).length;
      const total = (r.meta && r.meta.total) || own.length;
      rows.push({ term, expected, platform: r.platform, status: r.status, ms: r.ms, error: r.error, scraped: own.length, relevant, total, ...fieldStats(own) });
      console.log(`${term.padEnd(26)} ${r.platform.padEnd(9)} ${r.status.padEnd(8)} first page ${String(own.length).padStart(3)} of ~${String(total).padStart(5)}, looks like the product: ${String(relevant).padStart(2)}${r.error ? ` !! ${r.error}` : ''}`);
    }
    const any = rows.filter((r) => r.term === term).some((r) => r.scraped > 0);
    if (!any) console.log(`   -> no store returned anything for "${term}"`);
  }

  if (out) {
    const lines = [
      '# Search sweep (live)',
      '',
      `Run: ${new Date().toISOString().slice(0, 10)}. ${TERMS.length} terms x 2 live stores, first page of each store's own search, exactly what the app shows first (it mirrors the stores: nothing is filtered, "Show more" loads further pages). "Store total" is the number of results the store reports. "Looks like the product" counts first-page titles that contain the query's model/words, which only measures the store's own ranking. Field columns are the share of first-page items that have the field.`,
      '',
      '| Term | Expected category | Store | Status | First page | Store total | Looks like the product | Image | Rating | Original price | Classified as | Time (ms) |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.term} | ${r.expected} | ${r.platform} | ${r.status}${r.error ? ' (' + r.error + ')' : ''} | ${r.scraped} | ${r.total} | ${r.relevant} | ${r.image} | ${r.rating} | ${r.original} | ${r.topCategory} | ${r.ms} |`),
    ];
    fs.writeFileSync(out, `${lines.join('\n')}\n`);
    fs.writeFileSync(out.replace(/[.]md$/, '.json'), JSON.stringify(rows, null, 2));
  }
  process.exit(0);
})();

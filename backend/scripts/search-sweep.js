// Live sweep: runs varied search terms against each platform adapter and reports what works.
// Usage: node scripts/search-sweep.js docs/search_sweep.md
// Checks per platform and term: status, items scraped, relevant to the query, and field completeness.
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
];

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '-');

function stats(listings, parsed) {
  const relevant = listings.filter((l) => isRelevant(parsed, l.title));
  const n = relevant.length;
  const count = (fn) => relevant.filter(fn).length;
  const cats = {};
  for (const l of relevant) {
    const c = classify(l.title, l.category) || 'none';
    cats[c] = (cats[c] || 0) + 1;
  }
  const ids = new Set(listings.map((l) => l.externalId));
  return {
    scraped: listings.length,
    relevant: n,
    price: pct(count((l) => l.price > 0), n),
    image: pct(count((l) => l.image), n),
    rating: pct(count((l) => l.rating), n),
    original: pct(count((l) => l.originalPrice), n),
    url: pct(count((l) => /^https:/.test(l.url || '')), n),
    dupes: listings.length - ids.size,
    topCategory: Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '-',
    sample: relevant.slice(0, 2).map((l) => `${l.title.slice(0, 45)} (Rs ${l.price})`),
  };
}

(async () => {
  const out = process.argv[2];
  const rows = [];
  for (const [expected, term] of TERMS) {
    const parsed = parseQuery(term);
    // eslint-disable-next-line no-await-in-loop
    const res = await scrapers.scrapeAll(term);
    for (const [platform, r] of Object.entries(res)) {
      const s = stats(r.listings, parsed);
      rows.push({ term, expected, platform, status: r.status, ms: r.ms, error: r.error, ...s });
      console.log(`${term.padEnd(24)} ${platform.padEnd(9)} ${r.status.padEnd(8)} scraped ${String(s.scraped).padStart(2)} relevant ${String(s.relevant).padStart(2)} img ${s.image} rating ${s.rating} cat ${s.topCategory}${r.error ? ` !! ${r.error}` : ''}`);
    }
  }

  if (out) {
    const lines = [
      '# Search sweep (live)',
      '',
      `Run: ${new Date().toISOString().slice(0, 10)}. ${TERMS.length} terms x 2 live platforms. "Relevant" = passes the query relevance filter. Field columns are the share of relevant items that have the field.`,
      '',
      '| Term | Expected category | Platform | Status | Scraped | Relevant | Image | Rating | Original price | Classified as | Time (ms) |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.term} | ${r.expected} | ${r.platform} | ${r.status}${r.error ? ' (' + r.error + ')' : ''} | ${r.scraped} | ${r.relevant} | ${r.image} | ${r.rating} | ${r.original} | ${r.topCategory} | ${r.ms} |`),
    ];
    fs.writeFileSync(out, `${lines.join('\n')}\n`);
    fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(rows, null, 2));
  }
  process.exit(0);
})();

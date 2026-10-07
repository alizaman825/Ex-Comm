// Live sweep: runs varied search terms through the same gather stage the app uses (including alternative
// phrasings) and reports what each store returned, and what survived the relevance filter.
// Usage: node scripts/search-sweep.js ../docs/search_sweep.md
const fs = require('fs');
const { gatherAll } = require('../src/services/gather');
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
    const { platformStatus, listings } = await gatherAll(term, { budgetMs: 30000 });
    for (const [platform, s] of Object.entries(platformStatus)) {
      const own = listings.filter((l) => l.platform === platform);
      rows.push({ term, expected, platform, status: s.status, ms: s.ms, error: s.error, scraped: s.scraped, relevant: s.relevant, phrasings: s.queries.length, ...fieldStats(own) });
      console.log(`${term.padEnd(26)} ${platform.padEnd(9)} ${s.status.padEnd(8)} scraped ${String(s.scraped).padStart(3)} relevant ${String(s.relevant).padStart(2)} phrasings ${s.queries.length}${s.error ? ` !! ${s.error}` : ''}`);
    }
    // the core rule, per term: a result exists whenever any store had a relevant product
    const any = rows.filter((r) => r.term === term).some((r) => r.relevant > 0);
    if (!any) console.log(`   -> no store returned a matching product for "${term}"`);
  }

  if (out) {
    const lines = [
      '# Search sweep (live)',
      '',
      `Run: ${new Date().toISOString().slice(0, 10)}. ${TERMS.length} terms x 2 live stores, through the same gather stage as the app (up to 3 phrasings per store when the first attempt finds fewer than 5 relevant items). "Relevant" = passes the query relevance filter; a store that has a matching product contributes it whether or not the other store does. Field columns are the share of relevant items that have the field.`,
      '',
      '| Term | Expected category | Store | Status | Scraped | Relevant | Phrasings | Image | Rating | Original price | Classified as | Time (ms) |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.term} | ${r.expected} | ${r.platform} | ${r.status}${r.error ? ' (' + r.error + ')' : ''} | ${r.scraped} | ${r.relevant} | ${r.phrasings} | ${r.image} | ${r.rating} | ${r.original} | ${r.topCategory} | ${r.ms} |`),
    ];
    fs.writeFileSync(out, `${lines.join('\n')}\n`);
    fs.writeFileSync(out.replace(/[.]md$/, '.json'), JSON.stringify(rows, null, 2));
  }
  process.exit(0);
})();

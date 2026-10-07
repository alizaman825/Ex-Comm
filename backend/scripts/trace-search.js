// Traces one search through every pipeline stage, per platform, and shows where products are dropped.
// Usage: node scripts/trace-search.js "iphone 15 pro max cover"
const scrapers = require('../src/scrapers');
const { parseQuery, isRelevant } = require('../src/services/relevance');
const { significantTokens, hasAccessoryWord } = require('../src/services/matching');
const { analyzeTitle } = require('../src/services/matching');

const query = process.argv.slice(2).join(' ') || 'iphone 15 pro max cover';
const short = (t) => (t.length > 74 ? `${t.slice(0, 71)}...` : t);

// Why a title fails isRelevant (mirrors services/relevance.js, for the report only).
function why(parsed, title) {
  const toks = new Set(significantTokens(title));
  const reasons = [];
  if (!parsed.wantsAccessory && hasAccessoryWord([...toks])) reasons.push('accessory word in title');
  const missing = parsed.tokens.filter((t) => !toks.has(t) && ![...toks].some((x) => x.startsWith(t) || x.includes(t)));
  if (missing.length) reasons.push(`missing: ${missing.join(', ')}`);
  return reasons.join('; ') || 'ok';
}

(async () => {
  const parsed = parseQuery(query);
  console.log(`QUERY "${query}"`);
  console.log('  tokens:', JSON.stringify(parsed.tokens), '| wantsAccessory:', parsed.wantsAccessory, '\n');

  const results = await scrapers.scrapeAll(query);
  for (const [platform, r] of Object.entries(results)) {
    console.log(`== ${platform.toUpperCase()}: status=${r.status} raw=${r.listings.length}${r.error ? ` error=${r.error}` : ''}`);
    const kept = [];
    r.listings.forEach((l, i) => {
      const ok = isRelevant(parsed, l.title);
      if (ok) kept.push(l);
      if (i < 12 || ok) console.log(`  ${String(i + 1).padStart(2)} ${ok ? 'KEEP' : 'DROP'}  Rs ${String(l.price).padStart(7)}  ${short(l.title)}${ok ? '' : `   <- ${why(parsed, l.title)}`}`);
    });
    console.log(`  after relevance filter: ${kept.length} of ${r.listings.length}`);
    const keys = new Set(kept.map((l) => analyzeTitle(l.title).key));
    console.log(`  distinct match keys among kept: ${keys.size}\n`);
  }
  process.exit(0);
})();

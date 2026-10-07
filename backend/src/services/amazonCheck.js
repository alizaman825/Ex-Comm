// On-demand Amazon check for a search, via Bright Data's Amazon Scraper API (not a direct scrape, since
// Amazon blocks datacenter IPs aggressively). Not part of the ordinary live search (it is a supplier-style
// channel like AliExpress and eBay: international shipping/customs apply, and collection can take up to a
// minute), so the user asks for it explicitly. Prices come back in USD; converted to PKR here using the
// same saved exchange rate as eBay, since Listing.price is compared across stores as PKR everywhere else.
const scrapers = require('../scrapers');
const { SearchCache, Setting } = require('../models');
const { parseQuery, relevanceScore } = require('./relevance');
const { ingestListings } = require('./ingest');
const { liveKeyOf } = require('./search');

async function checkAmazon(q) {
  const parsed = parseQuery(q);
  const r = await scrapers.scrapePlatform('amazon', q);
  if (r.status !== 'success') {
    return { status: r.status === 'skipped' ? 'skipped' : 'failed', found: 0, error: r.error, code: r.code, ms: r.ms };
  }
  const fx = await Setting.getAll();
  const priced = r.listings.map((l) => ({ ...l, price: Math.round(l.priceUsd * fx.usdToPkr), currency: 'PKR' }));

  const ranked = priced
    .map((l, i) => ({ l, i, score: relevanceScore(parsed, l.title) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.l);
  const { productIdByListing } = await ingestListings(ranked);

  const key = liveKeyOf(q);
  const doc = await SearchCache.findOne({ queryKey: key });
  if (doc && doc.platformState) {
    const have = new Set(doc.productIds.map(String));
    const added = [];
    for (const id of productIdByListing) if (id && !have.has(id) && (have.add(id), true)) added.push(id);
    const state = JSON.parse(JSON.stringify(doc.platformState));
    state.amazon = { nextPage: 2, loaded: ranked.length, total: ranked.length, pageSize: ranked.length, approximate: false, exhausted: true, status: 'success' };
    const platformStatus = { ...(doc.platformStatus || {}), amazon: { status: 'success', scraped: ranked.length, relevant: ranked.length, loaded: ranked.length, total: ranked.length, exhausted: true, ms: r.ms } };
    await SearchCache.updateOne({ queryKey: key }, { $set: { productIds: [...doc.productIds, ...added], platformState: state, platformStatus } });
  }
  return { status: 'success', found: ranked.length, ms: r.ms };
}

module.exports = { checkAmazon };

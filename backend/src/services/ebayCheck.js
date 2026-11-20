// On-demand eBay check for a search, via eBay's official Browse API (OAuth2, not scraping) as an
// international reference price. Not part of the ordinary live search (international shipping/customs
// make it a supplier-style channel, like AliExpress), so the user asks for it explicitly. eBay prices
// come back in USD; they are converted to PKR here (the saved exchange rate) before being stored, since
// Listing.price is compared across stores as PKR everywhere else in the app.
const scrapers = require('../scrapers');
const { SearchCache, Setting } = require('../models');
const { parseQuery, relevanceScore, isRelevant } = require('./relevance');
const { ingestListings } = require('./ingest');
const { liveKeyOf } = require('./search');

async function checkEbay(q) {
  const parsed = parseQuery(q);
  const r = await scrapers.scrapePlatform('ebay', q);
  if (r.status !== 'success') {
    return { status: r.status === 'skipped' ? 'skipped' : 'failed', found: 0, error: r.error, code: r.code, ms: r.ms };
  }
  const fx = await Setting.getAll();
  const priced = r.listings.map((l) => ({ ...l, price: Math.round(l.priceUsd * fx.usdToPkr), currency: 'PKR' }));

  // eBay's own search is loose (it returns accessories/other models alongside the real match); unlike
  // ordinary live search, these results are ingested straight into an existing product's listings, so an
  // irrelevant title here would attach as a wrong "Compare stores" row rather than just ranking low.
  const relevant = priced.filter((l) => isRelevant(parsed, l.title));

  // Only one eBay listing can attach to a product (ingest.js: one listing per store per product), so
  // whichever result ranks first here is the price the user is shown. Title relevance alone is not
  // enough to pick it: eBay mixes used/"for parts" listings in with new ones for the same search, and a
  // terser used listing's title can out-score a longer, more fully-described new listing. Among
  // closely-matching titles, prefer a listing eBay reports as New, and avoid one priced only for its
  // cheapest buyer-selectable variation (multiVariant), so the price shown reflects the actual item.
  const CONDITION_RANK = { new: 0, refurbished: 1, unknown: 2, used: 3 };
  const ranked = relevant
    .map((l, i) => ({ l, i, score: relevanceScore(parsed, l.title) }))
    .sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.05) {
        const condDiff = (CONDITION_RANK[a.l.condition] ?? 2) - (CONDITION_RANK[b.l.condition] ?? 2);
        if (condDiff) return condDiff;
        if (a.l.multiVariant !== b.l.multiVariant) return a.l.multiVariant ? 1 : -1;
      }
      return b.score - a.score || a.i - b.i;
    })
    .map((x) => x.l);
  const { productIdByListing } = await ingestListings(ranked);

  const key = liveKeyOf(q);
  const doc = await SearchCache.findOne({ queryKey: key });
  if (doc && doc.platformState) {
    const have = new Set(doc.productIds.map(String));
    const added = [];
    for (const id of productIdByListing) if (id && !have.has(id) && (have.add(id), true)) added.push(id);
    const state = JSON.parse(JSON.stringify(doc.platformState));
    state.ebay = { nextPage: 2, loaded: ranked.length, total: ranked.length, pageSize: ranked.length, approximate: false, exhausted: true, status: 'success' };
    const platformStatus = { ...(doc.platformStatus || {}), ebay: { status: 'success', scraped: ranked.length, relevant: ranked.length, loaded: ranked.length, total: ranked.length, exhausted: true, ms: r.ms } };
    await SearchCache.updateOne({ queryKey: key }, { $set: { productIds: [...doc.productIds, ...added], platformState: state, platformStatus } });
  }
  return { status: 'success', found: ranked.length, ms: r.ms };
}

module.exports = { checkEbay };

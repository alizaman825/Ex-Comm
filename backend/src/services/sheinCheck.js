// On-demand SHEIN check for a search. Not part of the ordinary live search (SHEIN is an international
// catalog and can block automated requests at any time), so the user asks for it. Its listings are
// ingested like any other store's and appended to the query's stored result list (same pattern as
// services/aliexpressCheck.js).
const scrapers = require('../scrapers');
const { SearchCache } = require('../models');
const { parseQuery, relevanceScore } = require('./relevance');
const { ingestListings } = require('./ingest');
const { liveKeyOf } = require('./search');

async function checkShein(q) {
  const parsed = parseQuery(q);
  const r = await scrapers.scrapePlatform('shein', q);
  if (r.status !== 'success') {
    return { status: r.status === 'skipped' ? 'skipped' : 'failed', found: 0, error: r.error, code: r.code, ms: r.ms };
  }
  const ranked = r.listings
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
    state.shein = { nextPage: 2, loaded: ranked.length, total: ranked.length, pageSize: ranked.length, approximate: false, exhausted: true, status: 'success' };
    const platformStatus = { ...(doc.platformStatus || {}), shein: { status: 'success', scraped: ranked.length, relevant: ranked.length, loaded: ranked.length, total: ranked.length, exhausted: true, ms: r.ms } };
    await SearchCache.updateOne({ queryKey: key }, { $set: { productIds: [...doc.productIds, ...added], platformState: state, platformStatus } });
  }
  return { status: 'success', found: ranked.length, ms: r.ms };
}

module.exports = { checkShein };

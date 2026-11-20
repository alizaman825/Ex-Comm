// One-off correction (ali's Phase 1 continuation brief, step A6, 2026-11-20): the AliExpress supplier
// catalog (120 listings) was bulk-imported on 2026-10-07, the same day real scraping started elsewhere.
// Because that import's PriceHistory points carry a scrapedAt on/after the verified cutoff
// (2026-10-07T12:20:00Z), backfill-pricehistory-source.js labelled them 'real' - but a bulk import is
// not a live check, so that label overstates how it was obtained. This finds AliExpress PriceHistory
// points scraped on 2026-10-07 that are currently 'real' and relabels them 'unverified' (PriceHistory.source
// has no 'saved_reference' value - that's a PriceStatus label, not a history-point label; 'unverified' is
// the correct one here, same as any other point with no live-check proof behind it).
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { PriceHistory } = require('../src/models');

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB(config.mongoUri);
  try {
    const dayStart = new Date('2026-10-07T00:00:00.000Z');
    const dayEnd = new Date('2026-10-08T00:00:00.000Z');
    const filter = { platform: 'aliexpress', scrapedAt: { $gte: dayStart, $lt: dayEnd }, source: 'real' };
    console.log('Filter: platform=aliexpress, scrapedAt in [2026-10-07, 2026-10-08), source=real');
    const count = await PriceHistory.countDocuments(filter);
    console.log(`${count} AliExpress points from the 2026-10-07 import are currently labelled 'real'.`);
    if (!count) return;
    if (!apply) {
      console.log("Dry run only - nothing changed. Re-run with --apply to relabel these as 'unverified'.");
      return;
    }
    const result = await PriceHistory.updateMany(filter, { $set: { source: 'unverified' } });
    console.log(`Relabelled ${result.modifiedCount} points as source: "unverified".`);
    const bySource = await PriceHistory.aggregate([
      { $match: { platform: 'aliexpress' } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log('New AliExpress counts by source:');
    for (const row of bySource) console.log(`  ${row._id}: ${row.count}`);
  } finally {
    await disconnectDB();
  }
}
main().catch((err) => { console.error(err); process.exitCode = 1; });

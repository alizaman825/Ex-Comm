// One-off migration (PLAN.md item 1c): PriceHistory.source did not exist before this field was added
// (2026-11-20). Every untagged point is split on config.priceHistory.verifiedCutoff
// (2026-10-07T12:20:00Z, set by the owner from the real data - round, once-a-day timestamps stop and
// real scrape times start right around there): before the cutoff is marked 'unverified' (seed-generated,
// not a real scrape), at/after the cutoff is marked 'real' (the first real scrape ran 12:25 UTC that same
// day). Charts/deals/alerts already treat anything other than source:'real' as untrustworthy (see
// services/priceStatus.js and productStats.js).
//
// This does NOT re-guess which points were simulated; it applies the owner's approved cutoff. Run
// data-truth-report.js first to see the current counts.
//
// Usage: node scripts/backfill-pricehistory-source.js [--apply]
// Without --apply: reports how many points would change in each direction, writes nothing.
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { PriceHistory } = require('../src/models');

async function main() {
  const apply = process.argv.includes('--apply');
  const cutoff = config.priceHistory.verifiedCutoff;
  await connectDB(config.mongoUri);
  try {
    const untagged = { source: { $exists: false } };
    const unverifiedFilter = { ...untagged, scrapedAt: { $lt: cutoff } };
    const realFilter = { ...untagged, scrapedAt: { $gte: cutoff } };
    console.log(`Verified cutoff: ${cutoff.toISOString()}`);
    console.log(`Filter for 'unverified': source missing AND scrapedAt < ${cutoff.toISOString()}`);
    console.log(`Filter for 'real': source missing AND scrapedAt >= ${cutoff.toISOString()}`);

    const [unverifiedCount, realCount] = await Promise.all([
      PriceHistory.countDocuments(unverifiedFilter),
      PriceHistory.countDocuments(realFilter),
    ]);
    console.log(`${unverifiedCount} points would be marked 'unverified'.`);
    console.log(`${realCount} points would be marked 'real'.`);
    if (!unverifiedCount && !realCount) return;
    if (!apply) {
      console.log('Dry run only - nothing changed. Re-run with --apply to write these labels.');
      return;
    }

    const unverifiedResult = await PriceHistory.updateMany(unverifiedFilter, { $set: { source: 'unverified' } });
    const realResult = await PriceHistory.updateMany(realFilter, { $set: { source: 'real' } });
    console.log(`Marked ${unverifiedResult.modifiedCount} points as source: "unverified".`);
    console.log(`Marked ${realResult.modifiedCount} points as source: "real".`);

    const bySource = await PriceHistory.aggregate([
      { $group: { _id: { $ifNull: ['$source', 'untagged'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    console.log('New counts by source:');
    for (const row of bySource) console.log(`  ${row._id}: ${row.count}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

// One-off migration (PLAN.md item 1c): PriceHistory.source did not exist before 2026-11-20
// (config.priceHistory.verifiedCutoff). Every point written before then has no way to prove it came
// from a real scrape rather than simulate mode's fabricated demo moves (CLAUDE.md documents
// `POST /api/jobs/price-check {"mode":"simulate"}` as a demo command with no record of whether it was
// ever run against production). Per the owner's instruction, those points are marked 'unverified' - not
// 'real' - rather than assumed real. Charts/deals/alerts already treat anything other than
// source:'real' as untrustworthy (see services/priceStatus.js and productStats.js).
//
// This does NOT guess which points were simulated; it only stops treating untagged points as proven
// real. Run data-truth-report.js first to see how many points this affects.
//
// Usage: node scripts/backfill-pricehistory-source.js [--apply]
// Without --apply: reports how many points would change, writes nothing.
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { PriceHistory } = require('../src/models');

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB(config.mongoUri);
  try {
    const filter = { source: { $exists: false } };
    const count = await PriceHistory.countDocuments(filter);
    console.log(`${count} price-history points have no 'source' field (written before ${config.priceHistory.verifiedCutoff.toISOString()}).`);
    if (!count) return;
    if (!apply) {
      console.log('Dry run only - nothing changed. Re-run with --apply to set them to source: "unverified".');
      return;
    }
    const result = await PriceHistory.updateMany(filter, { $set: { source: 'unverified' } });
    console.log(`Marked ${result.modifiedCount} points as source: "unverified".`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

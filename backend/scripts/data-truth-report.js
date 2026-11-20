// One-off, read-only report (PLAN.md Phase 1 item 2, pre-approved by the owner 2026-11-20: counts only,
// never emails/names/user data; this repo is public, so treat the Action log as public).
//
// Prints: products, listings, seeded vs live listings, price-history points by source, listing
// freshness buckets (under 1 day / 1-7 days / 7-30 days / over 30 days, by lastScrapedAt), and listings
// with a usable store link (a url field). Fills in AUDIT.md section 3's "not measured" numbers.
//
// Usage: node scripts/data-truth-report.js  (writes nothing; GitHub Action: data-truth-report.yml)
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Product, Listing, PriceHistory } = require('../src/models');

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  await connectDB(config.mongoUri);
  try {
    const [productCount, listingCount, seededCount, liveCount] = await Promise.all([
      Product.countDocuments(),
      Listing.countDocuments(),
      Listing.countDocuments({ seeded: true }),
      Listing.countDocuments({ seeded: { $ne: true } }),
    ]);
    const platforms = await Listing.distinct('platform');

    const historyBySource = await PriceHistory.aggregate([
      { $group: { _id: { $ifNull: ['$source', 'untagged (pre-migration)'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const historyTotal = historyBySource.reduce((s, r) => s + r.count, 0);

    const now = Date.now();
    const freshnessBuckets = [
      ['under 1 day', 0, DAY],
      ['1 to 7 days', DAY, 7 * DAY],
      ['7 to 30 days', 7 * DAY, 30 * DAY],
      ['over 30 days (or never scraped)', 30 * DAY, Infinity],
    ];
    const listings = await Listing.find().select('lastScrapedAt url').lean();
    const freshness = freshnessBuckets.map(([label, min, max]) => ({
      label,
      count: listings.filter((l) => {
        if (!l.lastScrapedAt) return max === Infinity; // never scraped counts as "over 30 days"
        const age = now - new Date(l.lastScrapedAt).getTime();
        return age >= min && age < max;
      }).length,
    }));
    const withStoreLink = listings.filter((l) => Boolean(l.url)).length;

    console.log('=== Ex-Comm data-truth report (read-only, counts only) ===');
    console.log(`Generated: ${new Date().toISOString()}`);
    console.log('');
    console.log(`Products: ${productCount}`);
    console.log(`Stores (distinct platforms with a listing): ${platforms.length} (${platforms.sort().join(', ')})`);
    console.log(`Listings (offers): ${listingCount} total - ${seededCount} seeded/sample, ${liveCount} live-sourced`);
    console.log(`Listings with a store link (url set): ${withStoreLink} of ${listingCount}`);
    console.log('');
    console.log(`Price-history points: ${historyTotal} total`);
    for (const row of historyBySource) console.log(`  source=${row._id}: ${row.count}`);
    console.log('');
    console.log('Listing freshness (by lastScrapedAt):');
    for (const row of freshness) console.log(`  ${row.label}: ${row.count}`);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

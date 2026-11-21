// One-off migration (Phase 4 Part C, 2026-11-21): catalog-wide duplicate check asked for in the brief's
// C1/C3. Two products with the EXACT same (title, brand, category) triple are, by definition, the same
// listing text for the same product typed twice - the live-site example this fixes is two "Infinix Note
// 60" products (brand "Infinix", category "mobiles"): one with 6 Daraz + PriceOye + Telex listings
// (Rs 104,449-119,999) and a second, separately-created, with a single Daraz listing from a seller whose
// title happened to add "Mediatek Dimensity 7400 Ultimate" to the match key used when IT was created
// (Rs 114,499 - ali's "Only on Daraz" card). Not a storage/RAM/colour variant - the spec sheet is
// identical; the matching ingest pipeline just never re-checked the two products against each other.
//
// This script finds every such exact-title group catalog-wide (src/services/dedupIdenticalProducts.js
// holds the pure planning logic, unit-tested in tests/dedupIdenticalProducts.test.js), picks the product
// with the most listings in each group as the one to keep (ties broken by the lower/older _id), and
// re-points every OTHER product's listings onto it - exactly like cleanup-mismatched-listings.js/
// backfill-telex-mega-matching.js already do for their own moves. A group is skipped (left separate,
// logged as "unsure") when any candidate's price is implausibly far from the keeper's own price range
// (the same PRICE_FLOOR_RATIO guard ingest.js/backfill-telex-mega-matching.js use, applied both
// directions here since either product could be genuinely wrong) - safest default for a one-off
// catalog-wide sweep with no human review of every row. Nothing is deleted (hard limit 4): a merged-away
// product is left in place with zero listings, already invisible to search the same way any other
// zero-listing product is.
//
// Usage: node scripts/dedup-identical-products.js [--apply] [--category=mobiles]
// Without --apply: reports what would change, writes nothing.
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Product, Listing, PriceHistory } = require('../src/models');
const { refreshProductsStats } = require('../src/services/productStats');
const { planMerges } = require('../src/services/dedupIdenticalProducts');

async function main() {
  const apply = process.argv.includes('--apply');
  const categoryArg = process.argv.find((a) => a.startsWith('--category='));
  const onlyCategory = categoryArg ? categoryArg.split('=')[1] : null;

  await connectDB(config.mongoUri);
  try {
    const products = await Product.find(onlyCategory ? { category: onlyCategory } : {})
      .select('title brand category minPrice retailMinPrice')
      .lean();
    const listingCounts = await Listing.aggregate([{ $group: { _id: '$productId', n: { $sum: 1 } } }]);
    const listingCountOf = new Map(listingCounts.map((d) => [String(d._id), d.n]));

    const { byCategory, mergeableGroups, unsureGroups, moves } = planMerges(products, listingCountOf);

    console.log('Catalog-wide exact-duplicate check (same title + brand + category):');
    for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${cat}: ${n} duplicate group(s)`);
    console.log(`\n${mergeableGroups} group(s) safe to merge (prices consistent), ${unsureGroups} group(s) left separate (price mismatch - needs a human look)`);

    if (!moves.length) return;
    console.log(`\n${moves.length} product(s) to merge:`);
    for (const { from, to } of moves) console.log(`  "${from.title}" [${from._id}] -> "${to.title}" [${to._id}]`);

    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to fix these.');
      return;
    }

    const touched = new Set();
    for (const { from, to } of moves) {
      await Listing.updateMany({ productId: from._id }, { $set: { productId: to._id } });
      await PriceHistory.updateMany({ productId: from._id }, { $set: { productId: to._id } });
      touched.add(String(from._id));
      touched.add(String(to._id));
    }
    await refreshProductsStats([...touched]);
    console.log(`\nMoved listings for ${moves.length} duplicate product(s) onto their kept product.`);
  } finally {
    await disconnectDB();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

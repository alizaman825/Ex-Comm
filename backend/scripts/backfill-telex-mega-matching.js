// One-off migration (Phase 3 Part C, 2026-11-21 live-site review): before the matching fix in
// src/jobs/telexSync.js / megaSync.js, a Telex/Mega listing only joined an existing product on an
// EXACT normalized-title key match. A listing worded slightly differently from an existing product
// (storage/variant wording, "PTA Approved With Official Warranty", etc.) never matched, so it silently
// created its own separate, unmatched product instead - invisible on the product page a shopper already
// has open. The sync jobs now also try the fuzzy same-brand matcher, but that only prevents it from
// happening again; it does not retroactively fix a product that was already created this way.
//
// This script finds every such "orphan": a product whose listings are ALL telex/mega (so it was never
// something an ordinary Daraz/PriceOye search already found and matched), re-runs the same exact-then-
// fuzzy match used by the sync jobs against the rest of the catalog, and - only when a different,
// established product matches - moves its listing(s) onto that product (Listing.productId and the
// matching PriceHistory rows, exactly like cleanup-mismatched-listings.js does for its own move).
//
// Nothing is deleted (hard limit 4): the orphan product document is left in place with zero listings,
// which search/trending/drops already treat as invisible (services/search.js's buildCards skips any
// product with no listings) - the same way an ordinary product with no current listings behaves today.
//
// Usage: node scripts/backfill-telex-mega-matching.js [--apply]
// Without --apply: reports what would change, writes nothing.
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Product, Listing, PriceHistory } = require('../src/models');
const { analyzeTitle, findBestMatch } = require('../src/services/matching');
const { refreshProductsStats } = require('../src/services/productStats');

const PRICE_FLOOR_RATIO = 0.4;
const priceImplausible = (price, product) => {
  const ref = product && (product.minPrice ?? product.retailMinPrice);
  return Boolean(ref) && price < ref * PRICE_FLOOR_RATIO;
};

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB(config.mongoUri);
  try {
    const listings = await Listing.find().select('productId platform externalId title price').lean();
    const listingsByProduct = new Map();
    for (const l of listings) {
      const k = String(l.productId);
      if (!listingsByProduct.has(k)) listingsByProduct.set(k, []);
      listingsByProduct.get(k).push(l);
    }

    const products = await Product.find().select('title brand matchKey minPrice retailMinPrice').lean();
    const orphans = products.filter((p) => {
      const ls = listingsByProduct.get(String(p._id)) || [];
      return ls.length > 0 && ls.every((l) => l.platform === 'telex' || l.platform === 'mega');
    });
    // Only an "established" product (has at least one non-telex/mega listing, or is itself not an
    // orphan from this same bug) is a valid merge target - two orphans are left alone rather than
    // arbitrarily picking which one absorbs the other.
    const orphanIds = new Set(orphans.map((p) => String(p._id)));
    const candidatePool = products.filter((p) => !orphanIds.has(String(p._id)));

    const moves = []; // { orphan, target, listing }
    for (const orphan of orphans) {
      const orphanListings = listingsByProduct.get(String(orphan._id)) || [];
      const a = analyzeTitle(orphan.title);
      let target = candidatePool.find((c) => c.matchKey === a.key);
      if (target && priceImplausible(orphan.minPrice ?? orphanListings[0]?.price, target)) target = null;
      if (!target && a.brand) {
        const sameBrand = candidatePool.filter(
          (c) => c.brand && c.brand.toLowerCase() === a.brand.toLowerCase() && !priceImplausible(orphan.minPrice ?? orphanListings[0]?.price, c)
        );
        const best = findBestMatch(a, sameBrand);
        if (best) target = best.candidate;
      }
      if (!target) continue;
      for (const listing of orphanListings) moves.push({ orphan, target, listing });
    }

    console.log(`${orphans.length} telex/mega-only orphan product(s) checked, ${moves.length} listing(s) to re-match`);
    for (const { orphan, target, listing } of moves) {
      console.log(`  [${listing.platform}] "${listing.title}" (Rs ${listing.price}): "${orphan.title}" -> "${target.title}"`);
    }
    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to fix these.');
      return;
    }

    const touched = new Set();
    for (const { target, listing } of moves) {
      await Listing.updateOne({ _id: listing._id }, { $set: { productId: target._id } });
      await PriceHistory.updateMany({ listingId: listing._id }, { $set: { productId: target._id } });
      touched.add(String(target._id));
    }
    // Orphan products are left as-is (zero listings afterwards) - not deleted, and already invisible
    // to search/trending/drops the same way any other zero-listing product is.
    for (const { orphan } of moves) touched.add(String(orphan._id));
    await refreshProductsStats([...touched]);
    console.log(`\nMoved ${moves.length} listing(s) onto their matched product.`);
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

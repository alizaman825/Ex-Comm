// One-off migration: detach store listings that were matched onto the wrong product before the
// accessory/price-sanity fix in services/matching.js and services/ingest.js (see docs/report_notes.md,
// "Product matching across platforms", 2026-11-20).
//
// A listing is mismatched when either is true, compared against the product it is currently attached to:
//   - its title is an accessory title (matching.js::analyzeTitle(...).accessory) while the product's own
//     title is not ("For iPhone18ProMax" attached to "Apple iPhone 18 Pro Max"), or
//   - its price is far below the product's other listings (ingest.js's PRICE_FLOOR_RATIO), which usually
//     means a different, much cheaper item slipped past the title check.
//
// A mismatched listing is detached into its own new product (never deleted - the scrape is kept, just
// regrouped), named after its own title, exactly like an unmatched listing created during ordinary
// ingest. Price history rows follow the listing (productId is denormalized there too) and are fixed up.
//
// Usage: node scripts/cleanup-mismatched-listings.js [--apply]
// Without --apply: reports what would change, writes nothing.
const { config } = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { Product, Listing, PriceHistory } = require('../src/models');
const { analyzeTitle, searchKeyOf } = require('../src/services/matching');
const { classify } = require('../src/services/categories');
const { refreshProductsStats } = require('../src/services/productStats');
const { cleanTitle } = require('../src/services/ingest');

const PRICE_FLOOR_RATIO = 0.4;

function reasonFor(listing, product) {
  const listingAcc = analyzeTitle(listing.title).accessory;
  const productAcc = analyzeTitle(product.title).accessory;
  if (listingAcc && !productAcc) return 'accessory title attached to a non-accessory product';
  const ref = product.minPrice ?? product.retailMinPrice;
  if (ref && listing.price < ref * PRICE_FLOOR_RATIO) return `price Rs ${listing.price} far below product range (Rs ${ref}+)`;
  return null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDB(config.mongoUri);
  try {
    const products = await Product.find().select('title minPrice retailMinPrice').lean();
    const productById = new Map(products.map((p) => [String(p._id), p]));

    // Only products with more than one listing can have a mismatched *offer* mixed in with real ones;
    // a single-listing product that is itself the mismatch is still caught (ref price check uses its
    // own minPrice, which is just that one listing's price - never a false positive on its own).
    const listings = await Listing.find().select('productId platform title price externalId').lean();

    const toMove = [];
    for (const l of listings) {
      const product = productById.get(String(l.productId));
      if (!product) continue;
      const reason = reasonFor(l, product);
      if (reason) toMove.push({ listing: l, product, reason });
    }

    console.log(`${listings.length} listings checked, ${toMove.length} mismatched`);
    for (const { listing, product, reason } of toMove) {
      console.log(`  [${listing.platform}] "${listing.title}" (Rs ${listing.price}) off "${product.title}": ${reason}`);
    }
    if (!apply) {
      console.log('\nDry run only. Re-run with --apply to fix these.');
      return;
    }

    const touchedProducts = new Set();
    for (const { listing } of toMove) {
      const a = analyzeTitle(listing.title);
      const title = cleanTitle(listing.title);
      const brand = a.brand ? a.brand[0].toUpperCase() + a.brand.slice(1) : undefined;
      const matchKey = `${a.key}~cleanup~${listing.platform}~${listing.externalId}`;
      const newProduct = await Product.create({
        title,
        matchKey,
        brand,
        category: classify(listing.title) || undefined,
        searchKey: searchKeyOf(brand, title),
      });
      await Listing.updateOne({ _id: listing._id }, { $set: { productId: newProduct._id } });
      await PriceHistory.updateMany({ listingId: listing._id }, { $set: { productId: newProduct._id } });
      touchedProducts.add(String(listing.productId));
      touchedProducts.add(String(newProduct._id));
    }
    await refreshProductsStats([...touchedProducts]);
    console.log(`\nDetached ${toMove.length} listings into their own products.`);
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

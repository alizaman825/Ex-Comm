// Pure planning logic for scripts/dedup-identical-products.js (Phase 4 Part C) - split out from the
// script so it can be unit-tested without a database. See that script's own header comment for the
// full rationale (the live "two Infinix Note 60 products" case this fixes).
const PRICE_FLOOR_RATIO = 0.4; // same guard as ingest.js/the telex-mega backfill script

function priceRatioOk(a, b) {
  if (!a || !b) return true; // no price yet on one side - nothing to contradict
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return lo / hi >= PRICE_FLOOR_RATIO;
}

/**
 * products: [{ _id, title, brand, category, minPrice, retailMinPrice }]
 * listingCountOf: Map(productId string -> listing count)
 * Returns { byCategory: Map(category -> duplicateGroupCount), mergeableGroups, unsureGroups, moves }
 * where moves is [{ from, to }] (from's listings/history should be re-pointed onto to).
 */
function planMerges(products, listingCountOf) {
  const groups = new Map();
  for (const p of products) {
    const key = `${(p.title || '').trim().toLowerCase()}|${(p.brand || '').trim().toLowerCase()}|${p.category || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }

  const byCategory = new Map();
  let mergeableGroups = 0;
  let unsureGroups = 0;
  const moves = [];

  for (const [, group] of groups) {
    if (group.length < 2) continue;
    const cat = group[0].category || '(none)';
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);

    const sorted = [...group].sort((a, b) => {
      const diff = (listingCountOf.get(String(b._id)) || 0) - (listingCountOf.get(String(a._id)) || 0);
      if (diff !== 0) return diff;
      return String(a._id).localeCompare(String(b._id));
    });
    const [keeper, ...rest] = sorted;
    const keeperPrice = keeper.minPrice ?? keeper.retailMinPrice;
    // Phase 4 Part C fix (2026-11-21 live dry run): a group can have 3+ members where only ONE is a bad
    // price match (the live "Infinix Note 60" case - a Rs 104,449 phone, a Rs 114,499 duplicate of the
    // SAME phone, and an unrelated Rs 449 phone case all titled exactly "Infinix Note 60") - skipping the
    // WHOLE group over that one outlier would also block the two members that are genuinely safe to
    // merge. Each candidate is judged against the keeper on its own instead: a candidate that fails the
    // price-plausibility guard is left separate (counted in `unsureGroups` once per such group), every
    // other candidate in the same group still merges.
    const safe = [];
    const unsafe = [];
    for (const p of rest) (priceRatioOk(keeperPrice, p.minPrice ?? p.retailMinPrice) ? safe : unsafe).push(p);
    if (unsafe.length) unsureGroups += 1;
    if (safe.length) mergeableGroups += 1;
    for (const dupe of safe) moves.push({ from: dupe, to: keeper });
  }

  return { byCategory, mergeableGroups, unsureGroups, moves };
}

module.exports = { planMerges, priceRatioOk, PRICE_FLOOR_RATIO };

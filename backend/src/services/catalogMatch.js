// Decides whether a store listing really is a given catalog item (the seed catalog in seed/catalog.js).
// Used by scripts/harvest-listings.js and the background catalog sync (jobs/catalogSync.js).
const { analyzeTitle, accessoryWordsIn } = require('./matching');

// Words that change which product it is (Pro, Max, Ultra...): the listing must not have one the catalog lacks.
const EDITION = new Set('pro max plus ultra mini lite fe se neo prime slim oled xl'.split(' '));
const isStorage = (t) => /^[0-9]+(gb|tb)$/.test(t);
const hasDigit = (t) => /[0-9]/.test(t);
const gb = (t) => parseFloat(t) * (t.endsWith('tb') ? 1024 : 1);

// Coverage 0..1 when the listing is the catalog item (same brand, model numbers, edition and storage;
// store titles may add words such as 5G, PTA, colours), otherwise 0.
function coverage(item, listing) {
  const want = analyzeTitle(item.t);
  const got = analyzeTitle(listing.title);
  const have = new Set(got.tokens);
  const compact = got.tokens.join('');
  if (want.brand && got.brand && want.brand !== got.brand) return 0;
  const extraAccessory = accessoryWordsIn(got.tokens).some((w) => !want.tokens.includes(w));
  if (extraAccessory) return 0;
  const present = (t) => have.has(t) || compact.includes(t);
  if (!want.tokens.filter((t) => hasDigit(t) && !isStorage(t)).every(present)) return 0;
  if (got.tokens.some((t) => EDITION.has(t) && !want.tokens.includes(t))) return 0;
  const gotStorage = got.tokens.filter(isStorage).map(gb);
  const wantStorage = want.tokens.filter(isStorage).map(gb);
  if (gotStorage.length && wantStorage.length && Math.max(...gotStorage) !== Math.max(...wantStorage)) return 0;
  const hit = want.tokens.filter(present).length / want.tokens.length;
  return hit >= 0.6 ? hit : 0;
}

// Accessories and look-alikes that borrow the product name ("Strap for Apple Watch Series 10", "Case for ...").
const JUNK = /(strap|straps|bracelet|protector|replacement|compatible|cover|case|film|charger|cable|tpu|silicone|sticker|skin|holder|stand|tips|ear ?pads?|clone|copy|master ?copy|first ?copy)|for (apple|samsung|xiaomi|sony|jbl|huawei|amazfit|iphone|galaxy|airpods|watch|redmi|ipad|macbook)/i;

// A store price far from what this product costs elsewhere means a different item (accessory, clone, other
// model). Reference: PriceOye's real price when captured, else the catalog's approximate retail price.
function plausible(item, listing, row) {
  const ref = (row && row.priceoye && row.priceoye.price) || item.p;
  if (listing.price < ref * 0.55 || listing.price > ref * 1.6) return false;
  const bad = listing.title.match(JUNK);
  return !(bad && !item.t.toLowerCase().includes(bad[0].toLowerCase()));
}

// The store's best confident match: highest coverage, ties keep the store's own order.
function pick(item, listings, row) {
  let best = null;
  let bestScore = 0;
  for (const l of listings) {
    if (!l.price || !l.url || l.sponsored || !plausible(item, l, row)) continue;
    const cov = coverage(item, l);
    if (!cov) continue;
    const score = cov + (l.inStock !== false ? 0.001 : 0);
    if (score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

module.exports = { coverage, pick, plausible };

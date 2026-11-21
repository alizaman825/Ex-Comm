// Search.
//  - Live search (default): mirrors what the stores return for the query, nothing filtered (services/liveSearch.js).
//  - Stored data: used for demo mode, category browsing, `live=false`, and when no store answers.
// Result `source`: 'live' (stores were just checked), 'cache' (an earlier live check, reused for a few
// minutes), 'fallback' (stored data, because live search is off or no store answered).
const { config } = require('../config/env');
const { Product, Listing, SearchCache } = require('../models');
const { normalizeText, searchKeyOf } = require('./matching');
const { resolveCategory } = require('./categories');
const { parseQuery, isRelevantAny, bestScore, TOKEN_SYNONYMS } = require('./relevance');
const liveSearch = require('./liveSearch');
const { excludeSeededInProd, excludeStaleInProd } = require('./publicData');
const { statusOf } = require('./priceStatus');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const queryKeyOf = (q) => normalizeText(q).split(' ').filter(Boolean).sort().join(' ');
// Live results depend on the order of the words (the stores rank by it), so the live key keeps it.
const liveKeyOf = (q) => `live:${normalizeText(q)}`;

// Database pre-filter pattern for one query token. It must accept everything isRelevant() could accept
// (that function does the precise check), so it mirrors its tolerances:
//  - spacing/hyphens/dots are ignored (compact key),
//  - a plural query word also matches the singular ("headphones" ~ "headphone"),
//  - "15 inch" also matches "15.6 inch" (compact key "156in"),
//  - equivalent words ("laptop" ~ "macbook") match each other.
// A brand named only through its product line ("Galaxy" for Samsung) is handled by the precise check; the
// pre-filter requires only ONE of the non-model words, so it cannot exclude those.
function tokenPattern(t) {
  const alternatives = [escapeRegex(searchKeyOf(t))];
  if (/^[0-9]+in$/.test(t)) alternatives.push(`${t.slice(0, -2)}[0-9]*in`);
  if (t.length > 3 && t.endsWith('s')) alternatives.push(escapeRegex(searchKeyOf(t.slice(0, -1))));
  for (const alt of TOKEN_SYNONYMS[t] || []) alternatives.push(escapeRegex(searchKeyOf(alt)));
  return new RegExp(alternatives.join('|'), 'i');
}

// Stored products that answer the query, ordered by relevance (or popularity when no query). Used for
// category browsing, demo mode and as the fallback when no store answers; live search does not use it.
// A product matches when ANY of its names does (its title or the title of any store listing).
async function localSearch(parsed, { category } = {}) {
  const filter = {};
  if (category) filter.category = resolveCategory(category) || '__none__';
  const browsing = parsed.tokens.length === 0;
  if (!browsing) {
    // Cheap pre-filter on the compact key: all model tokens, and at least one of the other words.
    // Accessory words are only a preference, so they are not required here.
    const key = tokenPattern;
    const must = parsed.model.map((t) => ({ searchKey: key(t) }));
    const some = parsed.words.length ? [{ $or: parsed.words.map((t) => ({ searchKey: key(t) })) }] : [];
    const only = !must.length && !some.length ? parsed.tokens.map((t) => ({ searchKey: key(t) })) : [];
    filter.$and = [...must, ...some, ...only];
  }
  // Browsing sorts in the database before limiting, so the most popular products are never cut off.
  const docs = await Product.find(filter)
    .sort(browsing ? { popularity: -1 } : undefined)
    .limit(browsing ? 2000 : 1500)
    .lean();
  if (browsing) return docs;

  const names = (p) => [`${p.brand || ''} ${p.title}`, ...(p.altTitles || [])];
  return docs
    .filter((p) => isRelevantAny(parsed, names(p)))
    .map((p) => ({ p, score: bestScore(parsed, names(p)) }))
    .sort((x, y) => y.score - x.score || (y.p.popularity || 0) - (x.p.popularity || 0))
    .map((x) => x.p);
}

// "Live" should mean "we actually checked this recently", not "was fetched through the live code path
// at some unknown point in the past". Supplier listings (eBay, AliExpress) are never re-fetched by the
// price job (scrapers/*: canRefetch = false), so without this a 6-week-old on-demand check keeps the
// "Live" badge forever. The raw stored field is left alone (ingest/history logic depends on it); only
// what the API reports is adjusted.
function effectiveDataSource(l) {
  if (l.dataSource !== 'live') return l.dataSource;
  if (!l.lastScrapedAt) return 'saved';
  const ageMs = Date.now() - new Date(l.lastScrapedAt).getTime();
  return ageMs <= config.home.freshnessHours * 60 * 60 * 1000 ? 'live' : 'saved';
}

// Cheapest in-stock offer per platform, shaped for product cards.
function offersFor(listings) {
  const best = new Map();
  for (const l of listings) {
    const cur = best.get(l.platform);
    const better = !cur || (l.inStock && !cur.inStock) || (l.inStock === cur.inStock && l.price < cur.price);
    if (better) best.set(l.platform, l);
  }
  return [...best.values()]
    .sort((a, b) => a.price - b.price)
    .map((l) => ({
      listingId: String(l._id),
      platform: l.platform,
      role: l.role || 'retail',
      priceUsd: l.priceUsd || null,
      price: l.price,
      originalPrice: l.originalPrice || null,
      rating: l.rating || null,
      reviewCount: l.reviewCount || 0,
      inStock: l.inStock,
      url: l.url,
      dataSource: effectiveDataSource(l),
      lastScrapedAt: l.lastScrapedAt,
      status: statusOf(l), // see services/priceStatus.js - replaces the old always-"Live" badge
      condition: l.condition || 'unknown',
      multiVariant: Boolean(l.multiVariant),
    }));
}

// Phase 4 Part C2: a storage/RAM spec ("8GB/256GB") pulled from the product's own stored titles, used
// only to disambiguate two cards in the SAME result set that would otherwise render an identical title
// (a shopper comparing two "Infinix Note 60" cards with no way to tell them apart) - never shown
// otherwise, and never a substitute for actually merging a true duplicate (see C1/scripts/
// dedup-identical-products.js: ali's own "Infinix Note 60" example turned out to be a duplicate, not a
// variant, but two genuinely different storage configs of the same phone can still collide this way).
function distinguishingSpec(product) {
  const texts = [product.title, ...(product.altTitles || [])];
  for (const t of texts) {
    const m = String(t).match(/(\d{1,3})\s*GB\s*(?:RAM)?\D{0,15}?(\d{2,4})\s*GB\s*(?:ROM|Storage)?\b/i);
    if (m) return `${m[1]}GB/${m[2]}GB`;
  }
  return null;
}

function toCard(product, listings) {
  const offers = offersFor(listings);
  return {
    id: String(product._id),
    title: product.title,
    brand: product.brand || null,
    category: product.category || null,
    image: product.image || listings.find((l) => l.image)?.image || null,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
    rating: product.rating || null,
    reviewCount: product.reviewCount || 0,
    priceChange7d: product.priceChange7d || 0,
    platforms: product.platforms,
    offers,
    _spec: distinguishingSpec(product), // internal only - stripped by disambiguateTitles() below
  };
}

// Appends the distinguishing spec to every card in `cards` whose title collides with another card's in
// the SAME list (never across main results and the separate "other models" group - those are already
// visually separated). A collision with no spec to show (neither side names one) is left as-is: nothing
// to tell them apart with, and never guessed.
function disambiguateTitles(cards) {
  const counts = new Map();
  for (const c of cards) counts.set(c.title, (counts.get(c.title) || 0) + 1);
  for (const c of cards) {
    if (counts.get(c.title) > 1 && c._spec) c.title = `${c.title} ${c._spec}`;
    delete c._spec;
  }
  return cards;
}

// Phase 3 Part D1 (2026-11-21): a search/category result this implausible for its category is almost
// always a misfiled accessory, or (same bug, a different shape) a monitor/bag/stand the seller titled
// as the device itself - keyword matching on the title catches what classify() can't, since a seller's
// own mis-title ("Dell P22T Laptop" for an actual monitor) still says the device category's own word.
// Scoped to 'laptops' only (the live-site finding this fixes): other categories' price floors stay
// configurable for future use, but a flat per-category price gate is too blunt for categories whose
// legitimate items vary far more widely in price (e.g. mobiles - accessories already have their own
// gate above, via parsed.wantsAccessory).
const QUALITY_GATED_CATEGORIES = new Set(['laptops']);
function passesCategoryQuality(card) {
  const slug = card.category;
  if (!slug || !QUALITY_GATED_CATEGORIES.has(slug)) return true;
  const floor = config.categoryQuality.minPrice[slug];
  if (floor && (card.minPrice ?? 0) < floor) return false;
  const excluded = config.categoryQuality.excludedKeywords[slug];
  if (excluded && excluded.length) {
    const title = `${card.brand || ''} ${card.title}`.toLowerCase();
    if (excluded.some((kw) => kw && title.includes(kw))) return false;
  }
  return true;
}

const SORTS = {
  relevance: null,
  price_asc: (a, b) => a.minPrice - b.minPrice,
  price_desc: (a, b) => b.minPrice - a.minPrice,
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount,
  discount: (a, b) => a.priceChange7d - b.priceChange7d,
};

// The products with these ids, in this order (ids whose product no longer exists are skipped).
async function productsInOrder(ids) {
  const docs = await Product.find({ _id: { $in: ids } }).lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

// params: { q, category, platform[], minPrice, maxPrice, minRating, sort, page, pageSize, limit, live, refresh }
//  - live search returns the first `limit` results (more are loaded from the stores when asked for);
//  - stored data is paginated with page / pageSize.
async function search(params) {
  const { q = '', category, platform, minPrice, maxPrice, minRating, sort = 'relevance', page = 1, pageSize = 12, limit = 24, live = true, refresh = false, fastLocal = false } = params;
  const parsed = parseQuery(q);
  // Phase 2 Part E (E1): coarse stage timing, logged only when SEARCH_LOG_TIMING=true - see
  // scripts/bench-search.js for the before/after numbers this produced.
  const t0 = Date.now();
  let tLive = t0;
  let tDb = t0;

  let meta = { source: 'fallback', platformStatus: {}, fetchedAt: null, liveStatus: null };
  let liveInfo = null;
  let fastLocalProducts = null; // Phase 4 Part A2: results already shown while a cold live check runs in the background
  const liveKey = liveKeyOf(q);
  if (fastLocal && parsed.tokens.length && live && !config.demoMode) {
    // A genuinely cold query (no cache entry at all yet) blocks on the stores otherwise, which is the
    // slow path A2 fixes: if the database already has matching products, show those immediately and kick
    // the live check off in the background instead of making the shopper wait for it. A query that DOES
    // have a cache entry (fresh, stale-but-servable, or short of `need`) is already handled quickly by
    // liveSearch's own stale-while-revalidate logic below, so this only ever applies to a brand-new query.
    // Opt-in only (fastLocal=true, sent by the ordinary search page): other callers of this API keep the
    // existing "always wait for the live answer" contract.
    if (!refresh) {
      const hasCacheEntry = await SearchCache.exists({ queryKey: liveKey });
      if (!hasCacheEntry) {
        const localHit = await localSearch(parsed, { category });
        if (localHit.length) {
          fastLocalProducts = localHit;
          meta = { source: 'fallback', platformStatus: {}, fetchedAt: null, liveStatus: 'pending' };
          // Not awaited: the next request for this query (the frontend polls while liveStatus is
          // 'pending') picks up the result via the normal cache path above.
          liveSearch.ensureLoaded(q, parsed, { need: limit, refresh, key: liveKey }).catch(() => {});
        }
      }
    }
  }
  if (!fastLocalProducts && parsed.tokens.length && live && !config.demoMode) {
    const attempt = await liveSearch.ensureLoaded(q, parsed, { need: limit, refresh, key: liveKey });
    tLive = Date.now();
    if (attempt.anySuccess) {
      liveInfo = attempt;
      meta = { source: attempt.fetchedNow ? 'live' : 'cache', platformStatus: attempt.platformStatus, fetchedAt: attempt.fetchedAt, liveStatus: null };
    } else {
      // no store answered: stored data is shown, with the reason for each store
      meta = { source: 'fallback', platformStatus: attempt.platformStatus, fetchedAt: null, liveStatus: null };
    }
  } else {
    tLive = Date.now();
  }

  const products = liveInfo ? await productsInOrder(liveInfo.productIds) : fastLocalProducts || (await localSearch(parsed, { category }));
  // PLAN.md item 4: live search's "other models" group (close/loose matches that failed the strict
  // relevance check) - same card-building rules, kept separate so they never rank above a real match.
  const otherProducts = liveInfo && liveInfo.otherProductIds.length ? await productsInOrder(liveInfo.otherProductIds) : [];
  const allProducts = [...products, ...otherProducts];
  const listingsByProduct = new Map();
  if (allProducts.length) {
    const all = await Listing.find(excludeStaleInProd(excludeSeededInProd({ productId: { $in: allProducts.map((p) => p._id) } }))).lean();
    for (const l of all) {
      const k = String(l.productId);
      if (!listingsByProduct.has(k)) listingsByProduct.set(k, []);
      listingsByProduct.get(k).push(l);
    }
  }
  tDb = Date.now();

  // Filters apply to the offers of the selected platforms.
  const wanted = platform && platform.length ? new Set(platform) : null;
  const categorySlug = category ? resolveCategory(category) || '__none__' : null;
  function buildCards(pool) {
    const built = [];
    for (const p of pool) {
      if (liveInfo && categorySlug && p.category !== categorySlug) continue; // (stored search filters by category in the query)
      let listings = listingsByProduct.get(String(p._id)) || [];
      if (wanted) listings = listings.filter((l) => wanted.has(l.platform));
      if (minPrice !== undefined) listings = listings.filter((l) => l.price >= minPrice);
      if (maxPrice !== undefined) listings = listings.filter((l) => l.price <= maxPrice);
      if (minRating !== undefined) listings = listings.filter((l) => (l.rating || 0) >= minRating);
      if (!listings.length) continue;
      const card = toCard(p, listings);
      if (wanted || minPrice !== undefined || maxPrice !== undefined || minRating !== undefined) {
        // Headline price = the retail listings that matched (supplier prices only headline when nothing else matched).
        const retail = listings.filter((l) => l.role !== 'supplier');
        const headline = retail.length ? retail : listings;
        card.minPrice = Math.min(...headline.map((l) => l.price));
        card.maxPrice = Math.max(...headline.map((l) => l.price));
      }
      // Live search: demote (never hide - PLAN.md item 4's "nothing the store returned is dropped" rule
      // extends to this too) a result that fails the category quality check into "Other models", the
      // same group a wrong-model/accessory match already collapses into. Stored/category-browsing results
      // are left alone - D1's report was specifically about a live search ("laptop"), and demoting there
      // would need its own "other" concept that browsing/demo mode don't have.
      // An accessory query ("laptop sleeve", "apple watch strap") legitimately matches cheap,
      // accessory-titled items - the quality floor is for a bare category query ("laptop") whose
      // results should be actual products, not for a query that asked for an accessory.
      if (liveInfo && !parsed.wantsAccessory && !passesCategoryQuality(card)) {
        card._qualityDemoted = true;
      }
      built.push(card);
    }
    return built;
  }
  const builtMain = buildCards(products);
  let cards = builtMain.filter((c) => !c._qualityDemoted);
  const demoted = builtMain.filter((c) => c._qualityDemoted);
  // Collapsed, capped group - a shopper can open it, but it is never what "N results" counts as.
  const otherCards = [...demoted, ...buildCards(otherProducts)].slice(0, 20);
  // Internal marker only - never part of the API response.
  for (const c of otherCards) delete c._qualityDemoted;
  if (SORTS[sort]) cards.sort(SORTS[sort]); // sorts what is loaded; "best match first" is the stores' order with matches ranked up

  const total = cards.length;
  let pages = Math.max(1, Math.ceil(total / pageSize));
  let shownPage = page;
  let hasMore = false;
  if (liveInfo) {
    hasMore = cards.length > limit || liveInfo.storesHaveMore;
    cards = cards.slice(0, limit);
    pages = 1;
    shownPage = 1;
  } else {
    cards = cards.slice((page - 1) * pageSize, page * pageSize);
  }
  // C2: disambiguate identical titles within each visible group separately (never across them - the
  // main results and "other models" are already visually separated).
  disambiguateTitles(cards);
  disambiguateTitles(otherCards);

  // Remember the query for the trending list (queries that found something).
  if (parsed.tokens.length) {
    const update = { $set: { query: q.trim().toLowerCase(), lastSearchedAt: new Date() }, $inc: { hits: 1 } };
    if (total > 0) update.$set.productIds = products.slice(0, 50).map((p) => p._id);
    await SearchCache.updateOne({ queryKey: queryKeyOf(q) }, update, { upsert: true });
  }

  if (config.search.logTiming) {
    const tEnd = Date.now();
    // eslint-disable-next-line no-console
    console.log(
      `[search-timing] q=${JSON.stringify(q)} source=${meta.source} liveMs=${tLive - t0} dbMs=${tDb - tLive} buildMs=${tEnd - tDb} totalMs=${tEnd - t0}`
    );
  }

  return {
    query: q,
    source: meta.source,
    mode: liveInfo ? 'live' : 'stored',
    demoMode: config.demoMode, // true: live scraping is switched off, only saved data is shown
    fetchedAt: meta.fetchedAt,
    // Phase 4 Part A2: 'pending' means these are database results shown while a first-ever live check
    // for this query runs in the background - the client should poll again shortly for the live update.
    liveStatus: meta.liveStatus || null,
    platformStatus: meta.platformStatus,
    total,
    loaded: total,
    estimatedTotal: liveInfo ? liveInfo.estimatedTotal : total,
    hasMore,
    page: shownPage,
    pages,
    pageSize,
    // PLAN.md item 4: loose/close matches (wrong model, no recognisable model number, etc.) that failed
    // the strict relevance check - never counted in `total`, never shown above `results`, but not hidden.
    otherTotal: otherCards.length,
    otherResults: otherCards,
    results: cards,
  };
}

module.exports = { search, localSearch, queryKeyOf, liveKeyOf, toCard, offersFor, effectiveDataSource, disambiguateTitles, distinguishingSpec };

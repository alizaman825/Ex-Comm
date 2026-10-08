# Multi-seller price comparison — plan

## Why

Daraz (and eBay) are not "one store, one price" — they're marketplaces where many independent sellers list the same item at different prices. Ex-Comm currently throws that away: `services/ingest.js` enforces "one listing per store per product," so when two different sellers list the same phone, only one of them ever gets attached to the product; the other is silently misread as a different product. Verified against a real Daraz fixture (`tests/fixtures/daraz-galaxy-a55.json`): 40 search results, **36 distinct sellers** (`sellerId`/`sellerName`/`location` are already in the scraped JSON — currently parsed and discarded by `scrapers/daraz.js`). Two listings in that same fixture plausibly describe the identical phone at Rs 127,000 vs Rs 172,999 from two different sellers — exactly the case this plan fixes.

## Scope

- **In scope: Daraz.** Seller fields confirmed present in real scrape data (see above). Build this first.
- **In scope: eBay**, once production keys are approved and we've looked at one real Browse API response. eBay's `item_summary` is expected to carry a `seller` object (username, feedback score) based on how that API is generally documented, but this is **unconfirmed from a live response** — treat as a spike, not a given, before writing eBay-specific code.
- **Out of scope: Amazon.** Removed from the codebase (reverted the Bright Data/Amazon work entirely — `scrapers/brightdata.js`, `scrapers/amazon.js`, `services/amazonCheck.js`, the `amazon` platform, and AliExpress's optional Bright Data transport are all gone as of this plan).
- **Out of scope for now: PriceOye.** Its product cards expose `lowest_price`/`highest_price` but `store_id` was `9999` (i.e. one default value) on every sample checked — looks like PriceOye mostly sells its own inventory rather than running a seller marketplace like Daraz. Do a 30-minute spike to confirm before ruling it out for good; don't build multi-seller support for it on assumption alone.
- **Out of scope for now: AliExpress.** Stays exactly as it is (single supplier-role listing per product, on-demand check, no seller breakdown). Could be a future follow-on once Daraz+eBay are proven out, not part of this plan.

## Design decision: roles don't change

Daraz stays `role: 'retail'`, eBay stays `role: 'supplier'`. This plan is about showing **every seller within a platform**, not about changing which platforms compete for the headline "cheapest" price. A product can end up with 5 Daraz listings (5 different sellers) and 3 eBay listings (3 different sellers); the cheapest **Daraz** seller can become the retail headline, exactly like today, just computed correctly over all of them instead of whichever one the matcher happened to attach first. The cheapest **eBay** seller is shown as the best supplier reference price, same non-headline treatment AliExpress gets today.

## Phase 0 — Verification spikes (do these before writing production code)

1. **eBay seller field shape.** Once `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` are live, call the Browse API's `item_summary/search` for a real query and inspect one raw response. Confirm: does `seller` exist on each item summary? What fields (username? feedback score/percentage? none at all)? This decides what `ebay.js`'s `mapItem()` can actually capture — don't guess.
2. **PriceOye seller data.** Pull a fresh PriceOye search response and check whether `store_id`/`storelink_id` ever varies across items for the same product, or whether it's genuinely always a fixed default. If it's always fixed, PriceOye is confirmed single-seller and stays untouched; if it varies, it becomes a candidate for the same treatment later (separate plan, not this one).
3. **Daraz `sku`/`skuId`/`cheapest_sku` semantics.** Confirm these represent product variants (storage/color) rather than per-seller identifiers, so the matching logic in Phase 2 doesn't confuse "same seller, different variant" with "different seller, same item." Check a few real listings where `sellerId` is identical across different `sku` values to validate this.

## Phase 1 — Data model

- `backend/src/models/Listing.js`: add `sellerId: String`, `sellerName: String`, `sellerLocation: String` (all optional; `undefined` for stores where we don't have this — PriceOye, AliExpress, legacy seeded rows).
- No index/uniqueness change needed: each seller's Daraz listing already has its own `externalId` (Daraz's `itemId` is per-listing, not per-abstract-product), so the existing `{platform, externalId}` unique index already treats each seller's listing as its own document. The fix is entirely in which listings are allowed to attach to the same **product** (Phase 2).

## Phase 2 — Ingestion / matching (`services/ingest.js`)

This is the core change, and the riskiest one — it's shared by every adapter.

- Today: `sameStoreTaken(pid, platform)` returns true (blocks attaching) if the product already has ANY non-seeded listing from that platform. That's the "one per store" rule.
- New: for a small, explicit list of multi-seller platforms (`const MULTI_SELLER_PLATFORMS = ['daraz']` initially, add `'ebay'` after its Phase 0 spike passes), change the check to `sameStoreTaken(pid, platform, externalId)` — only block if **the same externalId** (i.e. the same seller's own listing, on a re-scrape) is already attached. A different seller's listing for the same product is now allowed to attach as another offer.
- Everything else in `ingestListings` — title/brand/variant matching (`analyzeTitle`, `findBestMatch`), price history, denormalized stats — is unchanged; it already operates per-listing, not per-store.
- **Explicit regression test required**: two different-seller Daraz listings for genuinely different variants (e.g. 128GB vs 256GB) must NOT be merged just because this rule loosened. Confirm the existing exact-variant-token matching still protects this before relying on it.

## Phase 3 — Price aggregation (`services/productStats.js`)

No code change expected: `minPrice`/`retailMinPrice` are already `Math.min(...)` over whatever retail listings a product has. Once Phase 2 lets multiple Daraz listings attach, the correct minimum falls out automatically. **Verify this with a test**, don't just assume it — add a case with 3 Daraz sellers at different prices and confirm `retailMinPrice` picks the true minimum.

## Phase 4 — API response

No new endpoint or response shape needed. `GET /api/products/:id`'s `listings: Listing[]` already returns every attached listing flat; once Phase 2 allows multiple Daraz/eBay listings per product, they just show up in that same array with their own `sellerId`/`sellerName`. Add those two fields to the listing serializer (`controllers/products.controller.js`'s listing mapper) so the frontend can read them.

## Phase 5 — Frontend

- `components/product/OfferTable.tsx` (the product page's "Compare stores" list): group listings by platform. Where a platform has exactly one listing, render it exactly as today. Where it has more than one (multi-seller), render a collapsed summary row — "4 sellers on Daraz, from Rs 127,000 ▾" — that expands to one row per seller (name, location if present, price, rating, stock, link to that seller's listing). Reuse the existing row styling; this is a grouping change, not a new design.
- `components/compare/CompareView.tsx`: **no change expected** — `StoresTable` already does `pool.reduce((x, y) => (y.price < x.price ? y : x))` per platform, which already picks the true minimum across however many listings exist. Verify with a multi-seller fixture; add the same "N sellers" disclosure here only if it reads as missing once Phase 2 ships, not pre-emptively.
- Search result cards (`ProductCard.tsx`): **no change.** Cards already show one best price per platform via the same aggregated stats; multi-seller support makes that number more correct without changing the card's shape.

## Phase 6 — Adapters: capture seller identity

- `scrapers/daraz.js`: add `sellerId: String(it.sellerId)`, `sellerName: it.sellerName`, `location: it.location` to the object `parse()` returns (confirmed field names from the real fixture).
- `scrapers/ebay.js`: add the equivalent fields to `mapItem()`, **using whatever Phase 0's spike actually found** — do not hardcode a guessed field name the way `scrapers/amazon.js` had to (and which was flagged as unverified); this is exactly the mistake this plan avoids repeating for eBay.

## Phase 7 — Tests

- Backend: a Daraz ingestion test with 2+ different-seller listings for the same product, asserting both attach and `retailMinPrice` is correct; a negative test asserting a genuinely different variant does not get merged; parser tests confirming `sellerId`/`sellerName`/`location` are captured from the real fixture (already available, no new fixture needed).
- Frontend: `OfferTable` test for the grouped/expandable multi-seller row (single-seller case must render unchanged — regression guard).
- Same sandbox caveat as always: this session's `mongodb-memory-server` can't run here (network policy blocks the binary download), so backend DB-dependent tests need to be run locally/CI, not assumed passing from this environment.

## Phase 8 — Rollout order

1. Land Phase 1–7 for **Daraz only** (`MULTI_SELLER_PLATFORMS = ['daraz']`). Ship, verify on real data, watch for matching false positives.
2. Once eBay keys are approved and Phase 0's spike confirms the `seller` field shape, add `'ebay'` to `MULTI_SELLER_PLATFORMS`, land Phase 6's eBay half, re-run Phase 7's tests with an eBay fixture.
3. Do not start on eBay before step 2's spike — that's the one piece of this plan that depends on something we don't have yet.

## Risks

- **Matching false positives** are the main risk: relaxing the one-per-store rule means a matching mistake now shows up as "6 sellers" instead of a silently-dropped duplicate, which is more visible to a user. Mitigated by the existing strict variant-token matching (Phase 2's regression test makes this explicit, not assumed).
- **eBay's seller field is unverified** until Phase 0's spike runs against a live response — this is the project's second time hitting "guessed a field name because docs were unreachable" (see `scrapers/amazon.js`'s postmortem, now removed); the explicit spike step exists specifically to not repeat that for eBay.
- **PriceOye and AliExpress are deliberately excluded** pending evidence, not because they're assumed impossible — don't quietly expand scope to them without the same verification discipline applied to Daraz and eBay above.

# Review feedback — mapped to tasks

Source: user's project review, "What Needs Improvement & What's Currently Missing" (2026-10-07). Four points, mapped to concrete code changes against the current codebase, with effort and where each fits in `PLAN.md` §5's order. Current position: Checkpoint 2 done, next up is T14 (seller module).

## 1. Data freshness & out-of-stock transparency

**Review point:** featured products (e.g. Vivo Y29, Xiaomi Redmi Note 14) show as "saved out of stock" on the home page, which weakens trust.

**Finding:** `products.controller.js` `trending()` and `drops()` (lines 68–80) rank by popularity/price-drop only — no `inStock` filter, so out-of-stock listings can surface in the home page's featured rails.

**Fix:**
- Backend: exclude listings where `inStock === false` from the pool `trending`/`drops` draw from (or at minimum deprioritize them below in-stock items of the same rank).
- Frontend: `ProductCard.tsx` already renders `inStock`/`dataSource` — add a "last checked Xh ago" sub-label next to any remaining saved/out-of-stock badge (reuses `lastScrapedAt`, already on the `listings` schema; see point 4).

**Effort:** S (~2h). **Order:** do now, before T14 — it's a small, isolated fix to code already shipped (T10/T12), no schema change.

## 2. Store coverage & regional nuance

### 2a. AliExpress landed cost (customs/duties/shipping)

**Review point:** AliExpress prices don't reflect PTA customs/duties and shipping to Pakistan, so the retail-vs-supplier comparison isn't apples-to-apples.

**Finding:** T14 (margin calculator, not yet started) already takes `shippingPkr`/`customsPct`/`feePct` as inputs (`settings` collection, `PLAN.md` §3) for the seller margin tool — this is the same math, just needs to also apply to the plain product-comparison view, not only the seller opportunities page.

**Fix:** when building T14's margin service, also expose a `landedPricePkr` on supplier (`role: supplier`) listings in `GET /api/products/:id` and `GET /api/compare`, using `settings` defaults (editable fx rate/shipping/customs) rather than only inside the seller tool. Frontend: show "≈ landed cost PKR X (incl. est. duties & shipping)" next to the raw USD/PKR AliExpress price in `OfferTable.tsx`/`ProductView.tsx`.

**Effort:** +1h on top of T14 (reuses the same settings/calculation, just exposed in two places instead of one). **Order:** fold into T14 directly — don't do it separately.

### 2b. More local retailers (Telemart, Shophive, HF Smartphones)

**Finding:** each new retailer is a new scraper adapter (HTTP client + parser + fixture tests) plus matching-key updates, same shape as T3's Daraz/PriceOye work — not a small add-on. `PLAN.md` already has this as T21 ("third easy-to-scrape Pakistani store ... only if cheap"), currently NICE tier.

**Fix:** extend T21 to target one of the three named stores (whichever has a JSON/server-rendered search endpoint like Daraz/PriceOye, avoiding another headless-browser scraper like the legacy AliExpress one). Treat the other two as a documented limitation in `report_notes.md` if time runs out.

**Effort:** 3h per store (same estimate as existing T21), unchanged. **Order:** stays NICE-tier, after T17–T19 closing. Flagging now because the review specifically asks for named stores — confirm with you whether this should be promoted out of NICE given the ~41.5h already budgeted for T8b–T21.

## 3. Search & filter usability

### 3a. Auto-suggestions

**Fix:** typeahead dropdown on the search bar using data already available — `GET /api/search/trending` (popular queries) plus a lightweight `GET /api/products/suggest?q=` (product titles matching prefix, reuses existing title index). Frontend-only addition to the navbar search input, debounced.

**Effort:** M (2.5h, mostly frontend + one small endpoint). **Order:** after Checkpoint 2 work stabilizes, bundle with closing polish (before T17 test pass, so new code gets covered).

### 3b. Variant toggles (storage/color) & PTA-approval status

**Finding:** `listings` has no `variant` or `ptaApproved` field, and Daraz/PriceOye titles don't reliably label PTA status in a structured way (PriceOye shows it inconsistently in the title text; Daraz rarely at all) — this needs scraping investigation before committing to the effort, same category of risk as the existing matching limitation documented in `report_notes.md`.

**Fix (if data supports it):** add `listings.variant` (storage/color tokens, already partially parsed by `services/matching.js`'s normalization — promote that parsing to a stored field) and `listings.ptaApproved` (nullable boolean, only set when the store title/page explicitly states it); surface both as filter chips on `/search` and as a badge on `ProductCard`/`ProductView`.

**Effort:** L (5–6h: schema + matching service changes + scraper title parsing + two UI surfaces), with real risk the PTA signal isn't reliably scrapable. **Order:** recommend scoping as a NICE item (T22) after T21, pending a quick spike (30 min) to check how often PTA status actually appears in scraped titles — I'll run that spike before committing the full 5–6h if you want to prioritize this.

## 4. Trust signals & store links

**Finding:** `listings.lastScrapedAt` already exists in the schema (`PLAN.md` §3) and `listings.url` already links to the original store listing — this is mostly a UI surfacing gap, not new data.

**Fix:**
- Add "Last checked Xh ago" (from `lastScrapedAt`) next to every store's price in `OfferTable.tsx` and `ProductCard.tsx`, not just the page-level source banner that already exists.
- Make the existing `listings.url` a visible "View on {store}" link/button on each offer row (currently the store name may not be a clickable link everywhere — confirm during implementation).
- Affiliate links: no affiliate program exists for Daraz/PriceOye in this project, so true referral links aren't implementable without store-side credentials — note this honestly as a limitation in `report_notes.md` rather than faking tracking params.

**Effort:** S (~2h, UI-only, no schema/backend change). **Order:** do alongside point 1 (both are cheap, data-already-exists UI fixes) — before T14.

## Recommended order

| Order | Item | Effort | Fits in plan |
|---|---|---|---|
| 1 | §1 out-of-stock transparency + §4 trust signals (timestamps, store links) | ~4h | before T14, as a small standalone pass |
| 2 | §2a AliExpress landed cost | +1h | folded into T14 (seller/margin calculator) |
| 3 | §3a auto-suggestions | ~2.5h | bundled with closing polish, before T17 |
| 4 | §2b more retailers (named stores) | ~3h | T21 (NICE), scope the store name |
| 5 | §3b variant/PTA toggles | ~5–6h, spike first | new NICE item T22, pending a data-availability spike |

Items 4–5 add real hours to the ~41.5h already remaining in `PLAN.md` §5; let me know if either should be promoted ahead of NICE given the review's emphasis, or if the NICE tier should absorb them as-is.

# Ex-Comm — Launch Plan (Phases 1–4)

Built from AUDIT.md. Each phase stops after its report; nothing here is started until ali approves it
phase by phase (per the master brief). Owner-approval items are called out explicitly.

**Naming note:** the project already has a `docs/PLAN.md` (the university-report plan from
`docs/PROJECT_BRIEF.md`) and a root `STATUS.md`. This file is the brief's root-level `PLAN.md` — a
different document for a different purpose (launch readiness vs. report narrative). See the open
question in the PR description about whether to keep both or fold one into the other.

---

## Phase 1 — Trust and data (P0)

**Status (2026-11-20): items 1-5 of the brief's Phase 1 prompt are done, tested and pushed on
`claude/phase1-trust-data`** (PR to follow); stopped there per the brief to report before item 6. The
rows below are the original Phase 0 task list this phase was planned from - ticked where that work covers
them; the last row (DB counts) is still blocked on the new Action actually being run (needs this PR merged).

| Task | Depends on | Acceptance criteria | Needs owner approval? | Status |
|---|---|---|---|---|
| Add a `source: 'real' \| 'simulated'` field to `PriceHistory` (and backfill: treat all existing points as `'real'` unless a cheap heuristic can tell otherwise) | none | Every new point written by `simulate` mode is marked; `/history` and the chart can filter/label them | No — additive schema change | ✅ Done. Field added with a third state, `'unverified'` (not just `'real'`/`'simulated'`) - a pre-migration point defaults to `'unverified'`, never silently to `'real'`, since there's no way to prove it one way or the other without the DB counts. Backfill script written (`backend/scripts/backfill-pricehistory-source.js`, dry-run by default) but **not yet run** - needs ali's approval per the owner-decision data-change rule. |
| Price-status model: `checked_recently \| stale \| unavailable \| check_failed \| unknown`, shown with real last-checked time everywhere a price appears; "Live" badge only when `status === 'checked_recently'` AND age < a defined threshold | the field above | Spot-check: a listing not re-scraped in >X days never shows "Live" | No | ✅ Done (`services/priceStatus.js`, `StatusBadge`). A failed re-check now sets a new `lastCheckFailedAt` field and nothing else. |
| Fix search: call `relevance.js`'s `isRelevant()` as a **hard filter** in `liveSearch.js`, not just `relevanceScore()` for ranking; keep uncertain/boundary matches but label them, don't hide good-faith near-misses silently | none | "iphone 15 pro max" no longer returns 17/18 Pro Max as top hits in a live re-test | No — this is the AUDIT §4a root cause | ✅ Done - non-matches kept, moved to a collapsed "Other models" group, never ranked above real matches. 6 automated test cases added. |
| Replace savings text with one number + its basis (store spread vs. history change, with the time window stated) | price-status model | No page shows two unexplained "save Rs X" numbers at once | No | ✅ Done - one "Cheapest at X, Rs Y less than the next store" figure from `checked_recently` offers only; a second, clearly-labelled history figure appears only with ≥5 real observations over ≥7 days. |
| Best-deals: use real recorded history only; show "Not enough price history yet" otherwise | price-status + history-source field | A product with <2 real history points never appears in Best Deals | No | ✅ Mostly covered: `/products/drops` already excludes anything not fresh enough to trust (`isFreshEnough`) and `priceChange7d` is now computed only from `source: 'real'` history, so a fabricated/stale drop can't reach the homepage. Did not add a literal "Not enough price history yet" empty state in Best Deals itself - the product just doesn't appear, which satisfies the acceptance criterion but not the exact wording; flagging as a small follow-up, not re-opening Phase 1 for it. |
| Shipping/COD: show known/unknown, never default unknown to 0/zero-cost; keep international (AliExpress/eBay) prices separate with exclusions listed | none | Manual check of 3 product pages across categories | No | ⏳ Not started - out of the brief's 5-item Phase 1 stop point, carried to item 6+. |
| "Report a wrong price or product" + rate limiting | none (reuse `middleware/rateLimit.js` pattern) | Submitting from one IP repeatedly gets 429 after N tries | No | ⏳ Not started - item 6+. |
| Methodology, privacy, terms, contact, affiliate-disclosure pages; remove "university final-year project"/"sample data" footer wording from public pages | data-truth numbers from a real DB query (see below) | Pages exist and are linked from the footer; footer no longer says "university final-year project" | **Yes** — wording change is user-facing and the brief's rule 1 says preserve identity unless there's a clear reason; this is that reason, but the replacement copy should be reviewed before it goes live | ⏳ Not started - this is the brief's item 6 ("Honest pages and footer"), waiting for ali's go-ahead per the stop instruction. |
| One-time real DB query: count products/stores/offers/history points, seeded vs. live split, freshness distribution (fills in AUDIT §3's "not measured" cells) | Atlas access (ali or a script run with `MONGO_URI`) | AUDIT.md §3 gets real numbers | No, but needs ali to either run it or grant a way to run it (no Atlas shell per project memory) | 🟡 Tooling done (`data-truth-report.yml` Action), **not yet run** - only runnable from the default branch, so needs this PR merged first. |

**Also from AUDIT.md, cheap and worth doing early in this phase:** add `frontend/src/app/robots.ts` and
`sitemap.ts` (currently missing entirely — AUDIT §4j bonus finding). Low effort, unblocks nothing else,
but it's foundational for Phase 4 and arguably P0-adjacent since right now **zero** crawler guidance
exists.

---

## Phase 2 — Core shopping experience (P1)

| Task | Depends on | Acceptance criteria |
|---|---|---|
| Make search the homepage's main action; working autocomplete, typo tolerance, filters, sorting, loading/empty/error states | Phase 1's search fix | Typo ("ihpone") still finds iPhone; empty query state shown, not a blank page |
| Pakistan-specific filters (PTA-approved, warranty, new/refurbished, delivery/COD) where data exists | data-truth numbers (do we even have this data at scale?) | Filters only shown for fields with real coverage; no filter that always returns 0 results |
| Product card / product page: variant selector, one offers table, honest history + text alternative, price-alert action | Phase 1 | Manual walk-through at 390px and 1280px |
| Keep purple-orange cinematic identity; refine per the brief: solid high-contrast surfaces for prices/tables (WCAG AA), 44px+ touch targets, no horizontal scroll 320–1440px, acceptable perf on low-end Android | ali confirmed 2026-11-20: follow the brief (solid surfaces, glass sparingly) | Contrast-checker pass on price/table surfaces; manual low-end-device check |
| Hide empty sections instead of showing them with no data | Phase 1 (need to know what's real) | No section renders with 0 real items |

---

## Phase 3 — Reliability and retention (P1/P2)

| Task | Depends on | Acceptance criteria |
|---|---|---|
| Harden `catalogSync`/`priceCheck` as scheduled jobs: retries, timeouts, failure logging (partially exists — `JobRun` model already records status/summary/error) | none | A scrape failure never writes price 0 or `inStock: false` as a side effect of the failure itself (check `checkListing`'s failure branch does nothing to the listing — confirmed in AUDIT §1, re-verify after Phase 1 changes) |
| Alerts: dedupe, pause/resume, never fire from stale/sample data | Phase 1's price-status model | An alert on a `stale`/`unknown`-status listing does not fire |
| Security pass on accounts/wishlist: confirm per-user data isolation, re-check the auth rate-limit fix once the other thread's PR lands (don't re-fix it here) | the other thread's login-429 fix (coordinate, don't duplicate) | One user's token cannot fetch another user's wishlist/alerts (automated test) |
| Error monitoring + privacy-respecting analytics for search/product-view/store-click/alert-created | **owner decision: which paid/free service?** | Events show up in whatever dashboard is chosen, for a test session |

---

## Phase 4 — SEO and growth (P2)

| Task | Depends on | Acceptance criteria |
|---|---|---|
| Server-render category/search-landing/product pages (currently empty in raw HTML — AUDIT §4j, the single biggest SEO blocker found) | none, but touches the same pages Phase 2 touches — sequence after Phase 2 to avoid rework | `curl`'d raw HTML of `/search?q=...`, `/categories`, a product page all contain real product text, not just `<div>` shells |
| Add `robots.ts`/`sitemap.ts` (if not already done in Phase 1), titles/meta/canonical, Product + Breadcrumb structured data — accurate only | the SSR fix above | Google's Rich Results Test passes on a sample product page; sitemap lists real, live URLs |
| A small number of genuinely useful guides (PTA vs non-PTA, reading price history) with update dates | none | 2–3 pages exist, dated, factually reviewed |
| Search Console + Phase 3's events | Phase 3, SSR fix | Search Console verified and receiving data for >48h |
| Launch plan: channels + one measurable first goal, every number marked as a hypothesis | everything above | A one-page plan exists; no number in it is presented as a fact |

---

## Decisions from ali (2026-11-20)

1. **Visual identity: resolved.** Follow the new brief: solid, high-contrast surfaces for prices and
   tables; glass used sparingly elsewhere. This overrides the earlier "every surface must be glass, no
   opaque tiles anywhere" rule from the redesign work, specifically for price/table surfaces. Phase 2's
   plan above already follows this.

2. **Branching workflow: resolved.** No preview-deploy step for ordinary phase work — push straight to
   `main` as before, same as the redesign rounds. (This audit stays on its existing branch/PR since it's
   already done that way; future phases skip the branch-and-preview step unless ali asks for it on a
   specific change.)

3. **Two PLAN.md files: resolved.** Keep `docs/PLAN.md` (the university report's plan) as it is — no
   merge or retirement. This root `PLAN.md` is the separate launch-readiness plan.

## Open questions for ali (still open)

1. **Atlas access for the data-truth numbers — tooling built, action needed from you.** The one-off
   GitHub Action from option (a) below is now built and on this PR (`data-truth-report.yml`, reusing the
   existing `MONGO_URI` secret). It can only be triggered from the default branch, so: once this PR is
   merged, go to the Actions tab → "Data truth report" → Run workflow, and paste its output (or a
   screenshot of the log) back here so AUDIT §3 can get real numbers.

2. **Best-deals headline logic (issue f) — resolved without a separate fix.** Tracked it down this
   phase: the homepage's drop/deal rail (`/products/drops`) was already filtering to in-stock, recently-
   scraped products (`isFreshEnough`) before Phase 1 started, and `priceChange7d` (the "-53%" etc. figure)
   is now computed only from `source: 'real'` price-history points (never `simulated`/`unverified`). So
   the Rs 1,290/"-53%" case can no longer happen with current data - it was a symptom of the same
   simulated-data and stale-listing problems items 1 and 3 just fixed, not a separate bug in the deals
   code itself. Also fixed in passing: the "X% today" badge wording on the home page and product page,
   which was mislabelling a 7-day change as same-day.

3. **Browser/device testing.** No Playwright/browser run was done this phase (no sandbox used on this
   project can reach Edge/Chromium's download host either). Full user-journey testing at 390px/1280px
   (brief step 6) is still real work, not done yet. OK to fold it into Phase 1's item 6+ or Phase 2
   (whichever starts touching the relevant pages first) rather than as a separate pass?
   **Update:** the backend Jest suite itself is no longer blocked - added `.github/workflows/backend-tests.yml`
   on PR 35, so `npm test` now runs for real in GitHub Actions (where `mongodb-memory-server`'s download
   isn't blocked), not just the pure-logic checks the PR description describes. See item 5 below for what
   that first real run found.

5. **First-ever real run of the backend Jest suite (CI, PR 35) found pre-existing bugs, not caused by this
   phase's changes - flagging rather than fixing, to stay inside Phase 1's scope.** The full suite had
   never actually executed before (every sandbox on this project is blocked from `fastdl.mongodb.org`), so
   this is the first time these got to run at all:
   - `relevance.js`'s `ACCESSORY_WORDS` list includes `headphone(s)`/`earphone(s)`/`earbud(s)` - meant to
     stop a phone-accessory listing being mistaken for the device, but it also fires when the query itself
     *is* a pair of headphones/earbuds with no accessory word (e.g. "sony wh-1000xm5"), so `isRelevant()`
     wrongly rejects the product itself (`tests/search.test.js`, "model codes with hyphens", 4 cases).
   - `GET /api/platforms` only ever lists `daraz`/`priceoye`/`aliexpress`; eBay is a real platform
     elsewhere in the codebase (`src/scrapers/ebay.js`, `src/controllers/ebayCheck.js` etc.) but missing
     from that endpoint - looks like the route was never updated when eBay was added
     (`tests/categories.test.js`, "GET /api/platforms lists stores with their role").
   - `tests/singlestore.test.js`'s "same store never merged" describe block has 3 failures that trace to
     test-isolation, not product code: that file never clears `Product`/`Listing` between tests (by
     design - several tests depend on state earlier tests left behind), so a later test's query can match
     a product an earlier test already created with the same normalized title/brand (e.g. "iphone 16 pro
     max", "samsung galaxy a55"), pulling in listings/prices the test didn't expect. One of the three also
     throws a `TypeError` on `toMatchObject` that looks like the same root cause surfacing differently,
     not yet fully traced.
   None of these three are something this PR's trust-gating or relevance-hard-filter changes caused (the
   accessory-word list and the `/platforms` route are untouched by this phase; the test-isolation issue is
   about how the test file was written, not about any source file this phase touched) - flagging for a
   follow-up rather than expanding this PR's scope.

4. **Simulate-mode history question - checked via Render, answer in AUDIT §3.** Short version: no
   evidence found that `simulate` mode ever ran in production, but Render's logs only go back to
   2026-10-21 (30-day retention) against a service created 2026-10-07, so the first ~2 weeks can't be
   checked that way. All pre-2026-11-20 `PriceHistory` points still default to `source: 'unverified'`
   (never `'real'`) regardless, so nothing downstream depends on this answer being certain.

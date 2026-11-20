# Ex-Comm — Launch Plan (Phases 1–4)

Built from AUDIT.md. Each phase stops after its report; nothing here is started until ali approves it
phase by phase (per the master brief). Owner-approval items are called out explicitly.

**Naming note:** the project already has a `docs/PLAN.md` (the university-report plan from
`docs/PROJECT_BRIEF.md`) and a root `STATUS.md`. This file is the brief's root-level `PLAN.md` — a
different document for a different purpose (launch readiness vs. report narrative). See the open
question in the PR description about whether to keep both or fold one into the other.

---

## Phase 1 — Trust and data (P0)

| Task | Depends on | Acceptance criteria | Needs owner approval? |
|---|---|---|---|
| Add a `source: 'real' \| 'simulated'` field to `PriceHistory` (and backfill: treat all existing points as `'real'` unless a cheap heuristic can tell otherwise) | none | Every new point written by `simulate` mode is marked; `/history` and the chart can filter/label them | No — additive schema change |
| Price-status model: `checked_recently \| stale \| unavailable \| check_failed \| unknown`, shown with real last-checked time everywhere a price appears; "Live" badge only when `status === 'checked_recently'` AND age < a defined threshold | the field above | Spot-check: a listing not re-scraped in >X days never shows "Live" | No |
| Fix search: call `relevance.js`'s `isRelevant()` as a **hard filter** in `liveSearch.js`, not just `relevanceScore()` for ranking; keep uncertain/boundary matches but label them, don't hide good-faith near-misses silently | none | "iphone 15 pro max" no longer returns 17/18 Pro Max as top hits in a live re-test | No — this is the AUDIT §4a root cause |
| Replace savings text with one number + its basis (store spread vs. history change, with the time window stated) | price-status model | No page shows two unexplained "save Rs X" numbers at once | No |
| Best-deals: use real recorded history only; show "Not enough price history yet" otherwise | price-status + history-source field | A product with <2 real history points never appears in Best Deals | No |
| Shipping/COD: show known/unknown, never default unknown to 0/zero-cost; keep international (AliExpress/eBay) prices separate with exclusions listed | none | Manual check of 3 product pages across categories | No |
| "Report a wrong price or product" + rate limiting | none (reuse `middleware/rateLimit.js` pattern) | Submitting from one IP repeatedly gets 429 after N tries | No |
| Methodology, privacy, terms, contact, affiliate-disclosure pages; remove "university final-year project"/"sample data" footer wording from public pages | data-truth numbers from a real DB query (see below) | Pages exist and are linked from the footer; footer no longer says "university final-year project" | **Yes** — wording change is user-facing and the brief's rule 1 says preserve identity unless there's a clear reason; this is that reason, but the replacement copy should be reviewed before it goes live |
| One-time real DB query: count products/stores/offers/history points, seeded vs. live split, freshness distribution (fills in AUDIT §3's "not measured" cells) | Atlas access (ali or a script run with `MONGO_URI`) | AUDIT.md §3 gets real numbers | No, but needs ali to either run it or grant a way to run it (no Atlas shell per project memory) |

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

1. **Atlas access for the data-truth numbers.** AUDIT §3's product/store/offer/history counts need a
   real DB query. You've said before you have no Atlas shell and no local checkout. Options: (a) a
   one-off GitHub Action (like the existing cleanup workflow) that runs a read-only report script and
   prints counts to the Action log, using the same `MONGO_URI` secret the cleanup workflow already has —
   no new secret needed; (b) a temporary authenticated API endpoint behind `x-job-key` that returns the
   counts as JSON (no raw data, just numbers). (a) is less code and reuses an existing pattern. OK to
   build either as part of Phase 1?

2. **Best-deals headline logic (issue f).** I didn't locate the homepage's specific "headline deal"
   selection code in the time available this phase, so issue (f) (Rs 1,290 smartwatch at "-53%") is
   unconfirmed, not disproven. Phase 1 will track it down properly when touching the Best Deals logic
   anyway — flagging now so you know it's not forgotten, not ignored.

3. **Browser/device testing.** No Playwright/browser run was done this phase (curl-only verification).
   Full user-journey testing at 390px/1280px (brief step 6) is real work, not done yet. OK to fold it into
   Phase 1 or 2 (whichever starts touching the relevant pages first) rather than as a separate pass?

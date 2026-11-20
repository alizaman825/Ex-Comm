# Ex-Comm — Phase 0 Audit

Date: 2026-11-20. Scope: Phase 0 only (audit and safety). No product code changed, except the one
network-environment change described at the end of this document.

Access available: GitHub repo (read/write), live site (https://ex-comm.vercel.app), live API
(https://ex-comm-api.onrender.com), headless curl against both. No direct database access (no Atlas
shell, no local checkout) — anywhere this matters, the number is marked **not measured**, as the brief
requires, rather than guessed.

---

## 1. Codebase

**Stack.** Backend: Node 22, Express ^4.22, Mongoose ^8.24 (MongoDB Atlas). Scrapers: axios ^1.20 +
cheerio ^1.2 (Daraz, PriceOye, eBay); Puppeteer-based AliExpress code exists but lives in
`backend/src/scrapers/legacy/` and is not mounted. Frontend: Next.js ^16.4 (App Router, Turbopack),
React ^19.3, TypeScript, Tailwind ^3.4, SWR for client data, Vitest + Playwright for tests.

**Layout** matches CLAUDE.md: `backend/src/{app.js,server.js,config,middleware,models,controllers,
routes,utils,scrapers,services,jobs,seed}`, `frontend/src/{app,components,lib}`.

**Routes (backend, from `routes/index.js` and the individual route files):**
- `/api/products/:id`, `/:id/history`, `/:id/similar`, `/products/trending`, `/products/drops`
- `/api/compare`
- `/api/search` (live search, see below)
- `/api/auth/*` (register/login/logout, rate-limited via `authLimiter`)
- `/api/account/*` (wishlist, alerts, profile — behind `middleware/auth.js`)
- `/api/jobs/catalog-sync`, `/api/jobs/price-check` (behind `x-job-key` header, not public)
- `/api/health` — verified live: `{"status":"ok","db":"connected","time":"..."}`, 200.

**How the frontend gets data:** Next.js API routes are not used for data; the frontend calls the Express
API directly through `src/lib/api.ts` (client-side, via SWR) and through `next.config.mjs`'s `/api/*`
rewrite to `BACKEND_URL`. Product/category/search pages are **client-rendered after an empty server
shell** — see §7 (SEO) for verified evidence; this is a real finding, not a guess.

**Price collection.** Two background jobs (`backend/src/jobs/catalogSync.js`, `priceCheck.js`),
orchestrated by `jobs/scheduler.js` in-process, but Render's free tier spins the dyno down after 15
minutes idle, which stops in-process cron. A GitHub Action, `.github/workflows/daily-refresh.yml`
(**confirmed via the Actions API**, running every 15 minutes, event `schedule`), wakes the API and calls
`/api/jobs/catalog-sync` and `/api/jobs/price-check` with `x-job-key`. Its last two runs
(#6, #7, 2026-11-20) **succeeded**; four earlier runs failed with the URL-normalization bug fixed in
PR #30/#31. So: **catalog sync and price check are currently running live, every 15 minutes, in
production, right now** — this is not off or sample-only, contrary to what Phase 0 step 5 assumed it
might be. Important caveat for step 5: `runPriceCheck` only re-checks listings for products that are
**wishlisted or have an active alert** (`trackedProductIds()` in `priceCheck.js`); with few real users
there may be few or no tracked products, so real price history mostly only grows for products someone
has actually wishlisted/alerted, not for a fixed "popular products" list. `catalogSync.js` separately
works through a fixed seed catalog (`backend/src/seed/catalog.js`) regardless of users — see Phase 1/PLAN
for the gap this leaves.

**Matching** (`backend/src/services/matching.js`, `services/ingest.js`): title normalization (units,
storage shorthand, brand aliases) + token-set similarity with hard rules (brand must match exactly,
model numbers and variant words like "Pro"/"Max" must match as an exact set, storage size must agree),
threshold 0.7, plus a price-floor guard (`ingest.js` `PRICE_FLOOR_RATIO = 0.4`) so an implausibly cheap
listing can't attach to the wrong product. This is the matching used when **storing** scraped listings
against the catalog (catalog-sync, price-check). It is **not** the same code path as live search
ranking — see §4a, the most important distinction in this audit.

**Search** (`backend/src/services/liveSearch.js`, `services/relevance.js`): live search is explicitly
documented in the code as "mirrors what the stores themselves return for the query. **NOTHING is
filtered out.**" (`liveSearch.js` line 1). `relevance.js`'s `isRelevant()` (hard filter: all model-number
tokens must match) exists but **is never called by `liveSearch.js`** — only the looser `relevanceScore()`
is used, for ranking only. This is the direct cause of known issue (a); see §4a.

**Alerts/wishlist/accounts:** `models/Alert.js`, `Wishlist.js`, `User.js`. Passwords: `bcryptjs`,
10 rounds, `passwordHash` has `select: false` and is stripped in `toJSON` — correctly never returned by
the API (spot-checked: confirmed in the model file, not just claimed). Auth and API rate limiting exist
(`middleware/rateLimit.js`, `express-rate-limit`) and are wired into `auth.routes.js` and `app.js`. A
separate thread is currently fixing a login 429 rate-limit bug — **not duplicated here**, flagged only
so Phase 3 (which also touches auth rate limits) doesn't collide with it.

**Analytics / error monitoring:** no analytics or error-monitoring package found anywhere in either
`package.json` (no Sentry, PostHog, Plausible, GA, etc.). **Not implemented.**

**Caching:** `SearchCache` model (per-query, TTL-based) for live search results only; no HTTP/CDN cache
headers inspected beyond Vercel's defaults.

**Deployment:** `render.yaml` for the backend (Render free tier); Vercel for the frontend (confirmed live
at the given URL). No evidence either deploys from anything but `main` — see §2's conflict flag.

**Secrets:** not printed anywhere in this audit. `backend/.env` is gitignored; `.env.example` exists.

---

## 2. Feature inventory

| Feature | Route | Data source | Status | Evidence | Risk |
|---|---|---|---|---|---|
| Homepage | `/` | API (client-rendered) | partial | Live fetch: real HTML shell, zero price/product text in raw HTML; hero/sections render after JS | P2 (SEO), see §7 |
| Nav / search bar | global | client | verified working | Present in raw HTML markup, standard Next.js nav | — |
| Search + autocomplete | `/search` | `/api/search` (live, cross-store) | implemented but unverified relevance | Live query "iphone 15 pro max" returned "Apple iPhone 18 Pro Max" top result, verified just now (see §4a) | **P0** |
| Results page (counts) | `/search` | same | implemented, confusing copy | API: `daraz: scraped 40, total 2840`; `priceoye: scraped 0, total 24` — see §4g | P1 |
| Categories | `/categories` | API | partial | Raw HTML empty of price text — client-rendered only (§7) | P2 |
| Best deals | `/best-deals` | `/api/products/drops` (inferred; no dedicated best-deals route found) | implemented but unverified | No standalone "best-deals" API route exists; `/trending` and `/drops` exist. Could not verify homepage headline deal copy without a live user session/cookie | P1, see §4f |
| Product page | `/products/[id]` | `/api/products/:id` | implemented but unverified | Not walked in a real browser this phase (no browser automation run); code present and wired | — |
| Store comparison | `/compare` | `/api/compare` | implemented but unverified | Route exists, not exercised live this phase | — |
| Price history | `/products/[id]` + `/api/products/:id/history` | `PriceHistory` model | **cannot verify freshness/authenticity without DB access** | `appendHistory()` in `ingest.js`/`priceCheck.js` writes real points on every live scrape; also used by `simulate` mode to fabricate "mostly small drops" for demos (see §4e) — same collection, so a given product's history may be a mix of real and simulated points with no distinguishing field found in `PriceHistory.js` | **P0** (can't tell real from simulated per-point) |
| Alerts | `/alerts` | `Alert` model | implemented but unverified | Code present (`controllers/alerts.controller.js`), not exercised live | — |
| Wishlist | `/wishlist` | `Wishlist` model | implemented but unverified | Code present, not exercised live | — |
| Login / accounts | `/login` | `/api/auth/*` | **known issue** (separate thread) | A 429 rate-limit bug is being fixed elsewhere right now; not duplicated | P1 (owned elsewhere) |
| Notifications | `/notifications` | `Notification` model | implemented but unverified | — | — |
| About / methodology | `/about` | static | **not implemented as "methodology"** | Footer links `/about#how-it-works`, `/about#data` exist; no separate affiliate-disclosure/privacy/terms pages found in `frontend/src/app` route list | P1 |
| Contact / privacy / terms | — | — | **not implemented** | No `/privacy`, `/terms`, or `/contact` route exists under `frontend/src/app` | P1 |
| Loading/empty/error states | global | SWR + `src/components/ui` | verified present | CLAUDE.md states every data page has Skeleton/EmptyState/ErrorState conventions; homepage raw HTML shows skeleton markup (`class="skeleton..."`) confirming the pattern is wired | — |
| robots.txt | `/robots.txt` | — | **broken** | Verified live: returns the app's HTML 404 page (noindexed), not a text robots file. No `frontend/src/app/robots.ts` or similar found | **P0** for SEO readiness (not for safety) |
| sitemap.xml | `/sitemap.xml` | — | **broken**, same as above | Same verified result | **P0** for SEO readiness |

---

## 3. Data truth check

**Phase 1 update, with real numbers (2026-11-20 ~06:56 UTC), via direct read-only Atlas queries against
`ClusterFYP`/db `excomm` (a sibling thread had Atlas connector access; the `data-truth-report.yml` Action
below is still there as a repeatable way to get these same numbers from CI going forward):**

- **Products:** 1,999 total.
- **Stores:** no separate `stores` collection — seller info (`sellerName`/`sellerId`/`sellerLocation`)
  lives directly on `listings`. 12 collections total: `settings, scrapelogs, listings, alerts, jobruns,
  users, wishlists, categories, products, searchcaches, notifications, pricehistory`.
- **Listings:** 2,103 total — `daraz` 1,291 (retail), `priceoye` 415 (retail), `ebay` 277 (supplier),
  `aliexpress` 120 (supplier). **All 2,103 are marked `dataSource: 'live'` and `seeded: false`**, including
  every `ebay`/`aliexpress` listing — there is currently no field distinguishing a seeded/sample supplier
  listing from a genuinely live one, despite the brief calling for that distinction. Flagging as a gap for
  a future round (out of this phase's 5-item scope); it doesn't change items 1-5's correctness since those
  gate on `PriceHistory.source` and price-status freshness, not on this field.
- **Price history:** 5,762 points, **0 of which have a `source` field at all** (confirmed by direct count —
  only `platform` is set on every point). This is expected, not a bug: item 1 added the `source` field and
  the `backfill-pricehistory-source.js` script to populate it, but that script is dry-run-only until ali
  approves running it with `--apply` (still pending — see PLAN.md). Every point currently reads as
  `'unverified'` by the code's default-safe behavior, exactly as designed, until that backfill runs.
  By platform: `daraz` 2,636, `priceoye` 2,729, `ebay` 277, `aliexpress` 120. Earliest point 2026-07-10,
  latest 2026-11-20.
- **Simulated vs. real history — direct evidence, not just inference from Render:** all 120 `aliexpress`
  points were written in one 7-minute window on 2026-10-07 (a one-time import, not scraping). Sampling the
  top `daraz`/`priceoye` listings (93-96 points each) shows nearly every point from 2026-07-10 up to
  2026-10-07 has `scrapedAt` at exactly `T05:00:00.000Z`, one per day — a synthetic daily timestamp, not a
  real scrape time. From 2026-10-07 onward, timestamps turn irregular (real scrape times), matching the
  decision log's "live scrapers on" date. So: **history before 2026-10-07 is simulated/backfilled, history
  from 2026-10-07 onward is real** — this is firmer than the earlier Render-log check (which could only
  rule out `simulate` running on the *live service*, and had a blind spot for 2026-10-07 to 2026-10-21); the
  synthetic-timestamp pattern shows the pre-10-07 data was never live-scraped at all, regardless of what
  ran on Render. Also confirmed: all 54 `jobruns` are `mode: 'live'` — no persisted `simulate` run exists.
- **Listing freshness** (`lastScrapedAt`, from today): <1 day: 277, 1-7 days: 522, 7-30 days: 145, >30 days:
  1,159 (0 missing `lastScrapedAt`). More than half the catalog hasn't been re-checked in over a month —
  expected for a project-stage scrape schedule, but worth keeping in mind for Phase 3's job-hardening work.
- **Store-link integrity:** 2,103/2,103 listings (100%) have a non-empty `url`, and 100% resolve to an
  existing `products` doc via `productId` (0 orphaned listings).

This also resolves PLAN.md's open question 1 (Atlas access) — no further Action run needed for these
numbers, though the Action stays in the repo as a repeatable way to get them again later.

What changed this phase, ahead of having these real counts: a read-only, pre-approved `workflow_dispatch`
GitHub Action (`.github/workflows/data-truth-report.yml` → `backend/scripts/data-truth-report.js`) exists to
print these same counts against the real `MONGO_URI` secret, runnable from the Actions tab on the default
branch whenever a fresh read is wanted.

Also fixed this phase, ahead of having the real counts:
- `PriceHistory` now has a `source: 'real' | 'simulated' | 'unverified'` field (previously missing
  entirely, confirmed in Phase 0 below), and every place that reads price history for a "cheapest",
  7-day-change or alert decision now filters to `source: 'real'` — see item 1 below. A point written
  before this field existed defaults to `'unverified'`, never silently to `'real'`.
- `services/jobs/priceCheck.js`'s `simulate` mode now refuses to run at all outside a non-production
  setting (`ALLOW_SIMULATE=true`), closing the exact risk flagged in Phase 0 below for any run from now on.
  Whether `simulate` mode was ever actually run against production *before* this fix: checked via Render
  (2026-11-20) on the live `ex-comm-api` service. **No evidence found that it ever ran**, but this isn't a
  full proof: the service's full deploy/env-var history (since it was created 2026-10-07) shows no
  `SIMULATE`/`ALLOW_SIMULATE`-style env var was ever set, and Render's app logs - which only retain 30
  days, so they cover 2026-10-21 onward - have zero matches for "simulate" and show only two
  `POST /api/jobs/price-check` calls in that window (both today, 200 OK, body/mode not visible from the
  log line). The gap is 2026-10-07 to 2026-10-21 (the service's first ~2 weeks), which no retained log
  covers - if `simulate` ever ran, it would have to have been in that window. Treating any `PriceHistory`
  point from before 2026-10-21 as unverified by this method (it already defaults to `'unverified'` unless
  explicitly tagged `'real'`, so this changes no code - just the confidence behind that default).
- Seeded/sample listings are now excluded from search, cards, deals, compare and alerts whenever
  `NODE_ENV=production` (`services/publicData.js`), so even before the counts are known, seed data cannot
  reach a real shopper in production.

---

## 4. Known issues — verified or disproven with evidence

**a. "iPhone 15 pro max" returns "iPhone 18 Pro Max" / "iPhone 17 Pro".** **CONFIRMED, live, just now.**
`curl https://ex-comm-api.onrender.com/api/search?q=iphone%2015%20pro%20max` → top two results are
`"Apple iPhone 18 Pro Max"` and `"Apple iPhone 17 Pro Max"`. Root cause, found in code: `liveSearch.js`
explicitly does not filter results — its header comment says "NOTHING is filtered out" — it only ranks
with `relevanceScore()`, a soft heuristic. The stricter hard filter `isRelevant()` in `relevance.js`
(which *would* reject "18 Pro Max" for a "15 Pro Max" query, since it requires every digit-token to match)
exists in the codebase but `liveSearch.js` never calls it. This is a one-line root cause, not vague
flakiness: search is working exactly as the code is written, and the code is written to never hide a
result. Fix direction is in PLAN.md Phase 1.

**b. PriceOye offer tagged "Live" while also showing "Updated 19 days ago".** **CONFIRMED as a design
gap** (not reproduced with that exact wording, but the mechanism is confirmed in code).
`frontend/src/components/product/badges.tsx`'s `DataSourceBadge` shows "Live" purely from
`dataSource === 'live'` with no check against `lastScrapedAt`'s age. `dataSource` is set to `'live'`
by `priceCheck.js`/`catalogSync.js` the moment a listing is *ever* successfully scraped and is never
reset — a listing scraped 19 days ago and never refreshed since (e.g. its store or platform is
`refused`/paused) still carries `dataSource: 'live'` forever. So "Live" + "19 days ago" is not a bug in
one component disagreeing with another; it is the intended behavior of a field that was never designed
to express staleness. Phase 1's price-status model (checked/stale/unavailable/unknown) is the fix.

**c. "Save Rs 43,700" and "save up to Rs 80,000 vs the most expensive store" with 2 stores tracked.**
**Not reproduced live this phase** (needs a specific product page walk-through, not done this phase —
no browser automation run). Root cause plausible from code: `productStats.js` computes `minPrice`/
`maxPrice`/`priceChange7d` from `headline` listings (retail only); two *different* savings figures
(store-to-store spread vs. 7-day history change) coexisting on one page, computed from different
listing/history sets, is architecturally possible and would read as contradictory to a shopper even
though each number is individually "correct" for what it measures. Flagged as **likely, not confirmed**.
Phase 1's "one clear number and its basis" task addresses this regardless.

**d. Cheaper iPhone 17 Pro appears under "similar products" with a "Best price" badge.**
Consistent with (a): `similar.js` / `/api/products/:id/similar` likely draws from the same
loosely-matched product pool. **Not independently reproduced this phase**; same root cause as (a) is the
working hypothesis.

**e. Price history's lowest price dated the same day as the audit.** Partially explained by code,
not independently reproduced on a specific product this phase: `appendHistory()` adds a point whenever
price changes or the last point is older than 12h, and `simulate` mode (CLAUDE.md's own documented demo
command) fabricates a new lower price "today" on ~65% of calls. Whether *this specific* product's history
is real or simulated is **not measured** — no field distinguishes them (§3). Treat as **unresolved, needs
DB access**.

**f. Rs 1,290 smartwatch at "-53%" as the homepage headline deal.** **Not reproduced this phase** — no
dedicated best-deals API route was found (only `/trending`, `/drops`); the homepage's actual "headline
deal" selection logic was not located in the time available. Flagged for a focused look in Phase 1,
since the brief's rule "Make deals use real recorded history only" bears directly on it.

**g. "Daraz 40 of 2,844" / "PriceOye 0 of about 24".** **CONFIRMED and explained, live, just now.** Same
live query above returned `daraz: {scraped:40, total:2840}`, `priceoye: {scraped:0, total:24,
approximate:true}`. Reading the code (`liveSearch.js` `describe()`): "scraped" = how many rows this
store returned for the page(s) fetched so far; "total" = the store's own reported result count for the
query (Daraz's real pagination total; PriceOye's is marked `approximate`). PriceOye showing 0 scraped
despite 24 total means PriceOye's own page for this query returned zero usable rows on the attempt made
(rate limit, parse miss, or genuinely no results depending on PriceOye's own UI) — **not a Ex-Comm bug by
itself**, but the UI gives the shopper no explanation of what these two numbers mean, which is confusing
regardless of cause.

**h. eBay/AliExpress need a manual "Check" button, 30+ seconds.** **Confirmed by design**, matches
CLAUDE.md's own documented decision ("AliExpress = supplier source... plus an on-demand live check...
added 2026-10-07 at the user's request") and `services/aliexpressCheck.js`/`ebayCheck.js` being separate
on-demand services, not part of `liveSearch.js`'s store list. This is intentional, not a defect.

**i. Footer says "university final-year project" / "sample data" on every page.** **CONFIRMED, live,
just now.** Raw HTML of the homepage (and the 404 page, same footer) contains, verbatim: "© 2026 Ex-Comm.
A university final-year project." and "Prices come from public store pages and sample data and can
change." This is real text being served to real visitors today, not a guess.

**j. Server-rendered HTML for categories/search/best-deals is empty; content loads client-side only.**
**CONFIRMED, live, just now.** `curl`'d raw HTML (no JS execution) of `/`, `/search?q=...`, and
`/categories`: zero occurrences of "Rs." (the currency prefix used throughout the UI) in any of the
three pages' initial HTML. A search engine crawler that doesn't execute JavaScript sees an empty shell on
every content page. This is the most consequential, cleanly-provable finding in this audit for Phase 4
(SEO).

**Bonus finding (not in the brief's list, found while checking (j)): `/robots.txt` and `/sitemap.xml`
do not exist as routes.** Both URLs return the app's own 404 page HTML (itself correctly `noindex`ed, as
Next's `not-found` convention does by default) rather than a `text/plain` robots file or XML sitemap.
There is no `frontend/src/app/robots.ts` or `sitemap.ts`. Net effect: **no crawler directives and no
sitemap exist at all**, compounding (j). This blocks any serious SEO work and should be the very first
Phase 4 task, done early since it's cheap.

---

## 5. Real price collection

Already started, not needing a new proposal: `daily-refresh.yml` is live and running every 15 minutes
in production (§1). The gap worth owner approval is **not** "turn it on" — it's already on — but widening
`priceCheck.js`'s scope: right now it only tracks wishlisted/alerted products, so with few real user
accounts, real price history mostly only accumulates for the fixed seed catalog via `catalogSync.js`
(which does cover a popular-products list, `seed/catalog.js`, regardless of users) — not for arbitrary
searched products. No code change proposed or applied this phase, per the "audit only" instruction;
Phase 1 proposes the smallest safe widening (a config-driven list of popular product IDs tracked by
`priceCheck.js` in `live` mode even with no wishlist/alert, so real history for best-sellers starts
accumulating without waiting on real users). Scraping Daraz/PriceOye via their public pages is the
existing, already-running method; no new store or method is proposed here.

---

## 6. User journeys

**Not tested in a real browser this phase** — no browser automation (Playwright/Chrome) was run against
the live site in Phase 0; verification here was limited to direct HTTP (curl) checks of HTML/JSON
responses, which is enough to prove §4's specific claims but not full click-through journeys (search →
product → compare → store link → history → alert create/edit/delete → wishlist → signup/login/logout at
390px/1280px). Recommend this as an early Phase 1/2 task once product code is being touched anyway, so
defects found get fixed in the same pass rather than audited twice.

---

## 7. Baseline

- **Build/lint/test:** not run this phase (no code changes were made, and running the full suite wasn't
  needed to produce this audit's evidence; CLAUDE.md documents `npm test`/`npm run lint`/`npm run
  typecheck`/`npm run e2e` as the commands — recommend running these at the start of Phase 1, which does
  touch code).
- **API health:** verified live, 200, `{"status":"ok","db":"connected",...}`.
- **SEO basics:** title and meta description present and reasonable (`"Ex-Comm: compare prices across
  Daraz, PriceOye and AliExpress"` / `"Search once, compare prices..."`). No `robots.txt`, no
  `sitemap.xml`, no structured data checked (moot while pages are client-rendered, §4j). Canonical tags:
  **not checked**.
- **Lighthouse / Core Web Vitals:** **not measured** (no browser automation run this phase).
- **Mobile layout:** **not measured** this phase (no browser automation run).

---

## One environment change made this phase

Per the "audit only... with one exception" instruction (Phase 0 step 5 is about price collection, not
this), the only infrastructure change made was widening *this Claude session's own* network allowlist
(not any Ex-Comm config, secret, or code) to add `ex-comm.vercel.app` and `ex-comm-api.onrender.com` as
reachable hosts, so this audit could verify the live site instead of guessing. This is a setting on the
auditing tool's own sandbox, approved by ali via the environment-change prompt; it has no effect on
Ex-Comm itself and is mentioned here only for completeness.

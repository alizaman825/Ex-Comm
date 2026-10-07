# Ex-Comm — Phase 1 Plan

Status: **approved** (2026-10-07), **revised with scope addendum** (`docs/PLAN_ADDENDUM.md`, adopted 2026-10-07). Decisions:
- Live sources: **Daraz + PriceOye** (retail). AliExpress is the **supplier source for the seller module from seed/cached data only** (no live adapter; labelled "saved"). Decided after Checkpoint 1.
- Positioning: primary users are online sellers/dropshippers (compare supplier price vs local retail price, estimate margin); secondary users are regular shoppers.
- Priority tiers (cut from the bottom if time runs short): **MUST** core product, **SHOULD** seller module, **NICE** landing animation / third store. See §5.
- Database: MongoDB Atlas (user's cluster). Orders feature and old CRA app (`backend/frontend`) deleted.
- T1 fixes security first: no password hashes in responses, auth on every user-modifying route, helmet, rate limiting on login/register, auth middleware path, production crash.
- After T1, before T2: generate `docs/requirements.md`, `docs/use_cases.md`, `docs/erd.dbml`.
- Matching: title normalization + fuzzy matching, manual selection as fallback; documented as a limitation in `docs/report_notes.md`.
- Frontend: one design system (single palette, Tailwind, consistent type/spacing), loading/empty/error states on every page.

## 1. Audit of existing backend (`/backend`)

| Area | Finding |
|---|---|
| Stack | Node.js + Express 4, Mongoose 6 (MongoDB Atlas), JWT (jsonwebtoken) + bcryptjs, Puppeteer 10 + cheerio |
| Scraping | `util/getData.js`: launches **headful** Chromium per request, opens a hard-coded AliExpress *category* URL, auto-scrolls, returns raw HTML of `._1OUGS` cards; `routes/getData.js` parses with cheerio. 11 copy-pasted routes (`/getdata/mens-clothing`, …). No search by keyword. |
| Fields per product | `productName`, `productUrl`, `productImage`, `productPrice` (string, unparsed). No rating, reviews, stock, IDs, currency. |
| Platforms | **AliExpress only.** No Daraz despite the brief. |
| Storage | MongoDB: `users` (email, password hash), `orders` (drop-shipping leftover). Scraped data is **never stored**. |
| Other code | `routes/order.js` (orders CRUD, out of scope), `routes/user.js` (register/login), old CRA frontend at `backend/frontend`. |

**Weaknesses / bugs**
- AliExpress hashed class names (`_1OUGS`, `_2mXVg`…) no longer exist on the page (verified 2026-10-07: 0 matches) → scraper returns nothing.
- `headless:false` (needs a display), `setDefaultNavigationTimeout(0)` (can hang forever), a waitForSelector on pagination *after* scraping (throws), new browser per request (slow, ~10–30 s).
- Implicit globals (`getData`, `products`, `$`, `obj`) → concurrent requests overwrite each other.
- No try/catch in scrape routes → requests hang on failure.
- `server.js` uses `path` without requiring it (prod crash); `authMiddleware` requires `../model/User` (wrong path, crashes when used).
- Security: `GET /users` returns all users **with password hashes**, `DELETE /users/delete/:id` unauthenticated, orders routes unauthenticated; `/users/register` has no validation or duplicate-email check.

**Live probe (2026-10-07)**
- Daraz `https://www.daraz.pk/catalog/?ajax=true&q=…` → JSON, 40 items/page with name, price, originalPrice, ratingScore, review count, image, itemId, brand. No browser needed.
- PriceOye `https://priceoye.pk/search?q=…` → server-rendered HTML, 25 `.productBox` cards; cheerio-parseable.
- AliExpress search → embeds JSON (`salePrice`, `formattedPrice`) but USD, anti-bot (slider captcha) prone.

**Data migration:** none. Old DB belonged to the previous owner and only held test users/orders. Fresh seed.

## 2. Architecture

```
Next.js 14 (App Router, TS, Tailwind, Recharts)  --/api/* rewrite-->  Express API (Node, existing language)
                                                                        ├─ routes → controllers → services
                                                                        ├─ scrapers/ (adapter per platform: daraz, priceoye, aliexpress)
                                                                        ├─ jobs/ node-cron price-check
                                                                        └─ Mongoose → MongoDB Atlas
```
- Keep MongoDB/Mongoose (already in place; user's Atlas cluster configured).
- Auth: JWT in an httpOnly cookie (same-origin via Next.js rewrite proxy); bcrypt hashing.
- Scraper adapters share one interface `search(query) → Listing[]` with timeouts, retries (1), randomized 1.5–3 s polite delay, per-platform concurrency 1, and a circuit breaker after repeated failures.
- Search is **cache-first**: fresh cache (< 6 h) served instantly; else live scrape → upsert → cache; on scrape failure → stale cache → seed data. Response states `source: live|cache|fallback`.
- Cross-platform matching: normalize title → brand + model + variant tokens (e.g. `apple iphone 15 128gb`) → `products.matchKey`; listings with the same key group under one product. Seed data is pre-grouped.
- Security: helmet, CORS, express-rate-limit (API + stricter on auth and live search), zod validation, central error handler.
- Tests: Jest + supertest + mongodb-memory-server; scraper parsers tested against saved HTML/JSON fixtures (offline).

## 3. Database collections

| Collection | Key fields | Relations / indexes |
|---|---|---|
| `users` | name, email (unique), passwordHash, emailAlerts (bool), marginDefaults {shippingPkr, customsPct, feePct}, createdAt | — |
| `products` | title, matchKey (unique), brand, category, image, minPrice, maxPrice, createdAt | 1 → N listings |
| `listings` | productId, **role** (`retail` \| `supplier`), platform, externalId, title, url, image, price, originalPrice, currency, rating, reviewCount, inStock, lastScrapedAt | N → 1 product; unique (platform, externalId) |
| `pricehistory` | listingId, productId, price, scrapedAt | N → 1 listing; index (listingId, scrapedAt) |
| `searchcache` | queryKey (normalized q + platform), query, productIds[], fetchedAt, status, **hits**, **lastSearchedAt** | unique queryKey; `hits` drives trending searches |
| `wishlists` | userId, productId, createdAt | unique (userId, productId) |
| `alerts` | userId, productId, **type** (`price` \| `supplier_drop` \| `margin`), targetPrice, **targetMargin** (%), platform (optional, null = any), active, lastTriggeredAt | N → 1 user, N → 1 product |
| `notifications` | userId, alertId, productId, message, price, read, createdAt | index (userId, read) |
| `scrapelogs` | platform, query, status, itemCount, durationMs, error, createdAt | used for reliability + report |
| `categories` | slug (unique), name, icon, keywords[] (search presets), sortOrder | 6 categories: Mobiles, Laptops, Audio, Watches, Home Appliances, Fashion; `products.category` holds the slug |
| `settings` | key (unique), value | `usdToPkr` exchange rate, default shipping/customs/fee for the margin calculator, `fxUpdatedAt` |

**Addendum fields on existing collections:** `listings.priceUsd` (supplier listings keep the original USD price), `listings.dataSource` (`live` \| `saved`, shown as a badge), `products.supplierMinPrice` (PKR, cheapest AliExpress listing), `products.retailMinPrice` (PKR, cheapest Daraz/PriceOye listing), `products.estMargin` (% with default assumptions, for ranking opportunities).

## 4. API endpoints (prefix `/api`)

| Group | Method & path | Auth |
|---|---|---|
| Health | `GET /health` | – |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | –/–/✓/✓ |
| Profile | `PATCH /users/me`, `PATCH /users/me/password`, `DELETE /users/me` | ✓ |
| Search | `GET /search?q&category&platform&minPrice&maxPrice&minRating&sort&page&live` | – (rate-limited) |
| Products | `GET /products/trending`, `GET /products/:id` (with listings), `GET /products/:id/history?days=` | – |
| Compare | `GET /compare?ids=a,b,c` | – |
| Meta | `GET /platforms`, `GET /categories` (with keyword presets and product counts), `GET /search/trending` (popular searches from cache) | – |
| Wishlist | `GET /wishlist`, `POST /wishlist` {productId}, `DELETE /wishlist/:productId` | ✓ |
| Alerts | `GET /alerts`, `POST /alerts` {productId, type, targetPrice \| targetMargin, platform?}, `PATCH /alerts/:id`, `DELETE /alerts/:id` | ✓ |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | ✓ |
| Seller | `GET /seller/settings` (fx rate + default assumptions), `PATCH /seller/settings` (user defaults), `POST /seller/margin` {productId \| supplierPrice, retailPrice, shipping, customsPct, feePct} → profit, margin %, assumptions used | – / ✓ |
| Seller | `GET /seller/opportunities?category&minMargin&sort&page` (products ranked by estimated margin, with supplier "live/saved" label) | – |
| Jobs | `POST /jobs/price-check` (manual trigger for demo; requires `JOB_KEY`) | key |

## 5. Task list (revised after Checkpoint 1)

Execution order: **(a)** T8b, then frontend MUST screens T9–T12 (all 10+ screens end to end, Checkpoint 2); **(b)** seller module T14, T16 (T15 optional); **closing** T17–T19 (Checkpoint 3); **(c)** NICE last. Estimates in hours.

| # | Task | Est. | Status |
|---|---|---|---|
| T1 | Backend foundation, security fixes, auth + profile API | 3 | done |
| T2 | Models + matching + seed + docs (requirements, use cases, ERD) | 4 | done |
| T3 | Scrapers: Daraz, PriceOye, polite queue, fixture tests | 5 | done |
| T4 | Search service: relevance, grouping, cache-first + fallback, filters, sort, pagination | 3.5 | done |
| T5 | Categories, trending, seed reshaped to 6 × 15 products | 3 | done |
| T6 | Products, compare, history, wishlist, alerts, notifications APIs | 3.5 | done |
| T7 | node-cron price-check job, alert notifications, email, demo simulate | 2 | done |
| T8 | Search sweep (23 live terms) → **Checkpoint 1: backend API** | 2.5 | done |

### (a) Frontend MUST screens
| # | Task | Est. | Status |
|---|---|---|---|
| T8b | Price job re-fetches each tracked listing by its stored URL/ID (no re-search); fuzzy matching kept only for discovering cross-store matches | 3 | |
| T9 | Next.js scaffold, Tailwind design system, layout/nav, API client, login/register | 4 | |
| T10 | Landing (trending, categories, drops), categories page, search results (filters/sort/states), about, 404 | 4 | |
| T11 | Product detail + price chart, compare view | 3.5 | |
| T12 | Wishlist, alerts, notifications, profile → **Checkpoint 2: end-to-end** | 4 | |

### (b) Seller module (seeded supplier data, labelled "saved")
| # | Task | Est. | Status |
|---|---|---|---|
| T13 | ~~AliExpress live adapter~~ **dropped** (supplier listings come from seed/cached data only) | 0 | dropped |
| T14 | Margin calculator service + API, fx/assumption settings, opportunities ranking API + tests | 3 | |
| T16 | Seller UI: margin calculator, opportunities page (category filter), "saved" labels | 4 | |
| T15 | Alerts extension: `supplier_drop` and `margin` alert types (optional; first to cut) | 2 | |

### Closing
| # | Task | Est. | Status |
|---|---|---|---|
| T17 | Run all tests, ≥ 20 test cases in `test_cases.md` (incl. seller module) | 3 | |
| T18 | Finish docs: seller use cases, diagrams (context, DFD 0/1, activity, class, sequence), screenshots checklist | 3 | |
| T19 | Demo hardening: `DEMO_MODE` rehearsal → **Checkpoint 3: testing** | 1 | |

### (c) NICE: last
| # | Task | Est. |
|---|---|---|
| T20 | Landing-page polish: GSAP ScrollTrigger hero scrubbing a frame sequence/3D model (asset in `frontend/public/hero/`), lazy-loaded, static fallback for `prefers-reduced-motion`/slow devices; landing page only | 4 |
| T21 | Third easy-to-scrape Pakistani store for non-electronics, only if cheap | 3 |

**Remaining:** T8b 3 + frontend 15.5 + seller 9 (T14 3, T16 4, T15 2) + closing 7 = **34.5 h**; NICE 7 h; **41.5 h** in total.

Docs (`requirements.md`, `use_cases.md`, `erd.dbml`, `report_notes.md`) are updated within each task, finished in T18.

## 6. Demo risks & fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| AliExpress anti-bot / layout change | n/a | No live AliExpress adapter; supplier data is seed/cached and labelled "saved" |
| Daraz blocks IP / changes JSON | Medium | Timeout 8 s → serve cache/seed; `source` badge shown in UI |
| PriceOye markup change | Medium | Selector fixture tests catch it; same fallback |
| Slow scrapes (> 8 s) during demo | Medium | Cache-first; pre-warm demo queries via seed + one job run before demo |
| Wrong cross-platform match | Medium | Conservative matcher; seed data pre-grouped; compare also allows manual selection |
| Atlas unreachable (venue Wi-Fi) | Low–Med | Document local MongoDB fallback (`MONGO_URI=mongodb://localhost/excomm`) + seed |
| No internet at all | Low | `DEMO_MODE=true` → cache/seed only, full UI still works |

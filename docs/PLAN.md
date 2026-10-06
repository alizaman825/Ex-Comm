# Ex-Comm — Phase 1 Plan

Status: **approved** (2026-10-07) with these decisions:
- Live sources: **Daraz + PriceOye**. AliExpress adapter is the **last task, only if time remains**; seed data still includes AliExpress listings so compare shows three stores.
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
| `users` | name, email (unique), passwordHash, emailAlerts (bool), createdAt | — |
| `products` | title, matchKey (unique), brand, category, image, minPrice, maxPrice, createdAt | 1 → N listings |
| `listings` | productId, platform, externalId, title, url, image, price, originalPrice, currency, rating, reviewCount, inStock, lastScrapedAt | N → 1 product; unique (platform, externalId) |
| `pricehistory` | listingId, productId, price, scrapedAt | N → 1 listing; index (listingId, scrapedAt) |
| `searchcache` | queryKey (normalized q + platform), productIds[], fetchedAt, status | unique queryKey |
| `wishlists` | userId, productId, createdAt | unique (userId, productId) |
| `alerts` | userId, productId, targetPrice, platform (optional, null = any), active, lastTriggeredAt | N → 1 user, N → 1 product |
| `notifications` | userId, alertId, productId, message, price, read, createdAt | index (userId, read) |
| `scrapelogs` | platform, query, status, itemCount, durationMs, error, createdAt | used for reliability + report |

## 4. API endpoints (prefix `/api`)

| Group | Method & path | Auth |
|---|---|---|
| Health | `GET /health` | – |
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | –/–/✓/✓ |
| Profile | `PATCH /users/me`, `PATCH /users/me/password`, `DELETE /users/me` | ✓ |
| Search | `GET /search?q&platform&minPrice&maxPrice&minRating&sort&page&live` | – (rate-limited) |
| Products | `GET /products/trending`, `GET /products/:id` (with listings), `GET /products/:id/history?days=` | – |
| Compare | `GET /compare?ids=a,b,c` | – |
| Meta | `GET /platforms`, `GET /categories` | – |
| Wishlist | `GET /wishlist`, `POST /wishlist` {productId}, `DELETE /wishlist/:productId` | ✓ |
| Alerts | `GET /alerts`, `POST /alerts`, `PATCH /alerts/:id`, `DELETE /alerts/:id` | ✓ |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | ✓ |
| Jobs | `POST /jobs/price-check` (manual trigger for demo; requires `JOB_KEY`) | key |

## 5. Task list (6-day schedule, ~44 h)

| Day | # | Task | Est. |
|---|---|---|---|
| 1 | T1 | Backend foundation: `src/` layout, config, error handler, helmet/CORS/rate limit, health; remove orders + old CRA frontend (if approved); fix bugs | 3 h |
| 1 | T2 | Mongoose models + seed script (~60 products × 2–3 platforms, 60 days price history, demo user) + `erd.dbml`, `requirements.md` | 4 h |
| 2 | T3 | Scraper adapters: Daraz (JSON), PriceOye (cheerio), AliExpress (refactor existing Puppeteer code, best-effort); polite delays, timeouts, fixture tests | 5 h |
| 2 | T4 | Search service: matching/grouping, cache-first + fallback, filters, sort, pagination | 3 h |
| 3 | T5 | Auth + profile API, JWT cookie, validation, tests | 2.5 h |
| 3 | T6 | Products/compare/history, wishlist, alerts, notifications APIs + tests | 3.5 h |
| 3 | T7 | node-cron price-check job → price history → alert notifications (+ optional email); manual trigger → **Checkpoint: backend API** | 2 h |
| 4 | T8 | Next.js scaffold, Tailwind design system, layout/nav, API client, auth pages (login, register) | 4 h |
| 4 | T9 | Landing, search results (filters/sort, loading/empty/error states), about, 404 | 3 h |
| 5 | T10 | Product detail + price-history chart, compare view | 3.5 h |
| 5 | T11 | Wishlist, alerts list/create, notifications, profile/settings → **Checkpoint: frontend E2E** | 4 h |
| 6 | T12 | Run all tests, write ≥20 test cases in `test_cases.md`, fix bugs | 3 h |
| 6 | T13 | Finish docs: use cases, diagrams (context, DFD 0/1, activity, class, sequence), screenshots checklist | 2.5 h |
| 6 | T14 | Demo hardening: `DEMO_MODE` (cache-only), rehearsal of demo script → **Checkpoint: testing** | 1 h |

Docs (`requirements.md`, `use_cases.md`, `erd.dbml`, `diagrams/`) are updated within each task, finished in T13.

## 6. Demo risks & fallbacks

| Risk | Likelihood | Fallback |
|---|---|---|
| AliExpress captcha / layout change | High | Best-effort adapter, off by default for live search; seed data covers it |
| Daraz blocks IP / changes JSON | Medium | Timeout 8 s → serve cache/seed; `source` badge shown in UI |
| PriceOye markup change | Medium | Selector fixture tests catch it; same fallback |
| Slow scrapes (> 8 s) during demo | Medium | Cache-first; pre-warm demo queries via seed + one job run before demo |
| Wrong cross-platform match | Medium | Conservative matcher; seed data pre-grouped; compare also allows manual selection |
| Atlas unreachable (venue Wi-Fi) | Low–Med | Document local MongoDB fallback (`MONGO_URI=mongodb://localhost/excomm`) + seed |
| No internet at all | Low | `DEMO_MODE=true` → cache/seed only, full UI still works |

# Status

_Last updated: 2026-10-07 — T5 (categories + trending + seed reshape) done_

## Built
- Phase 0–1: repo restructured, fresh history, plan approved (`docs/PLAN.md`), `CLAUDE.md`.
- T1: backend in `backend/src` (Express 4, Mongoose 8). Helmet, CORS, rate limits (API 300/15 min, login/register 10/15 min), zod validation, JSON errors, `/api/health`.
  - Auth: `POST /api/auth/register|login|logout`, `GET /api/auth/me` (httpOnly JWT cookie or Bearer). Profile: `PATCH /api/users/me`, `PATCH /api/users/me/password`, `DELETE /api/users/me` (auth required).
  - Removed orders feature, old CRA app, unauthenticated user list/delete routes, crashing production static block. JWT secret rotated.
- Docs: `requirements.md` (33 FR, 16 NFR), `use_cases.md` (14 UCs), `erd.dbml`, `report_notes.md`.
- T2: 9 Mongoose models (users, products, listings, pricehistory, searchcaches, wishlists, alerts, notifications, scrapelogs).
  - `services/matching.js`: title normalization + fuzzy match (brand/model/variant/storage/accessory rules).
  - `services/productStats.js`: min/max price, platforms, rating, 7-day change.
  - Seed (`npm run seed`; auto on empty DB): 60 products, 161 listings (Daraz/PriceOye/AliExpress), 90 days of daily history, demo user `demo@excomm.pk` / `demo1234` with wishlist, alerts, notifications.
- T3: scraper adapters `backend/src/scrapers`: Daraz (JSON), PriceOye (cheerio), shared HTTP client (8 s timeout, 1 retry), PoliteQueue (1 request at a time, 1.5–3 s random delay, circuit breaker after 3 failures, 10 min cooldown), registry with ScrapeLog logging and DEMO_MODE skip. Offline fixture tests in `tests/fixtures`. `node scripts/live-check.js "query"` hits the real sites.
- T4: `GET /api/search?q&category&platform&minPrice&maxPrice&minRating&sort&page&pageSize&live`. Cache-first (6 h) → live scrape (10 s budget, per-platform failure isolation) → fallback to stored/sample data; response has `source` live|cache|fallback and per-platform status. Query-relevance filter (model numbers must match, accessories dropped unless asked), ingestion groups listings into products by fuzzy match, adopts seeded listings (keeps history), appends price history. Search rate limit 60/15 min. Verified live: "samsung galaxy a56", "air fryer", "men's sneakers".
- T5: `categories` + `settings` collections; `GET /api/categories`, `GET /api/platforms`, `GET /api/search/trending`, `category` filter on search (slug or name; browse without `q`). Classifier assigns scraped products a category. Seed reshaped to 6 categories × 15 = 90 products (Fashion has 2 stores, rest up to 3), AliExpress listings are `role: supplier`, `priceUsd`, `dataSource: saved`, with category-specific source discounts; 10 trending queries seeded as fresh cache (instant, work in DEMO_MODE). `products.retailMinPrice/supplierMinPrice` added.
- Tests: 113 passing.

## Working
- API runs in dev and production mode with the embedded DB (`MONGO_URI=memory`); auto-seed and demo login verified.
- Daraz JSON search and PriceOye search HTML reachable without a browser (probed 2026-10-07).

## Broken / blocked
- **`MONGO_URI` in `backend/.env` points to `cluster0.qp8uz.mongodb.net`, which no longer exists (DNS NXDOMAIN).** Probably the old owner's cluster. Needs the user's own Atlas URI. Until then, use `MONGO_URI=memory`.
- Legacy AliExpress scraper parked in `backend/src/scrapers/legacy` (not mounted); AliExpress is the last, optional task.

## Next
- T6: products/compare/history, wishlist, alerts (price type), notifications APIs + tests. Then T7 (price-check job), T8 (15-term search sweep → Checkpoint 1).

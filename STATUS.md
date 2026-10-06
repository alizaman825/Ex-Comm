# Status

_Last updated: 2026-10-07 — T2 (models + seed) done_

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
- Tests: 42 passing (foundation, auth, matching, catalog matching, seed).

## Working
- API runs in dev and production mode with the embedded DB (`MONGO_URI=memory`); auto-seed and demo login verified.
- Daraz JSON search and PriceOye search HTML reachable without a browser (probed 2026-10-07).

## Broken / blocked
- **`MONGO_URI` in `backend/.env` points to `cluster0.qp8uz.mongodb.net`, which no longer exists (DNS NXDOMAIN).** Probably the old owner's cluster. Needs the user's own Atlas URI. Until then, use `MONGO_URI=memory`.
- Seed products have no images yet (frontend will show a placeholder; T3 may fill real images from live scrapes).
- Legacy AliExpress scraper parked in `backend/src/scrapers/legacy` (not mounted); AliExpress is the last, optional task.

## Next
- T3: Daraz + PriceOye scraper adapters (polite delays, timeouts, circuit breaker, fixture tests).

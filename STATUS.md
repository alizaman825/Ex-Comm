# Status

_Last updated: 2026-10-07 — T1 done, report docs generated_

## Built
- Phase 0: repo restructured (`/backend`, `/frontend`, `/docs`), fresh git history, secrets moved to `backend/.env`, pushed to github.com/alizaman825/Ex-Comm (private).
- Phase 1: audit + plan in `docs/PLAN.md` (approved with changes); `CLAUDE.md` created.
- T1: backend restructured into `backend/src` (Express 4, Mongoose 8). Helmet, CORS, API rate limit (300/15 min), auth rate limit (10/15 min on login/register), zod validation, central JSON error handler, `/api/health`.
  - Auth: `POST /api/auth/register|login|logout`, `GET /api/auth/me` (JWT in httpOnly cookie or Bearer). Profile: `PATCH /api/users/me`, `PATCH /api/users/me/password`, `DELETE /api/users/me` (all require auth).
  - Removed: orders feature, old CRA app, unauthenticated `GET /users` (leaked hashes) and `DELETE /users/delete/:id`, production static-serving block (crashed on missing `path`).
  - JWT secret rotated (`SECRET_TOKEN` → `JWT_SECRET`).
  - Tests: 18 passing (Jest + supertest + in-memory MongoDB).

- Docs: `docs/requirements.md` (33 FR, 16 NFR), `docs/use_cases.md` (14 use cases, brief table format), `docs/erd.dbml` (9 collections), `docs/report_notes.md` (matching limitation).

## Working
- API runs in dev and production mode; register/login verified against the embedded DB.
- Daraz JSON search endpoint and PriceOye search HTML reachable without a browser (probed 2026-10-07).

## Broken / blocked
- **`MONGO_URI` in `backend/.env` points to `cluster0.qp8uz.mongodb.net`, which no longer exists (DNS NXDOMAIN).** Probably the old owner's cluster. Needs the user's own Atlas URI. Until then, use `MONGO_URI=memory`.
- Legacy AliExpress scraper (stale selectors, headful); parked in `backend/src/scrapers/legacy`, not mounted. AliExpress is the last, optional task.

## Next
- T2: Mongoose models + seed script.

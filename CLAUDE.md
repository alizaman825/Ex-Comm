# Ex-Comm — project memory

Price comparison platform (Daraz, PriceOye, AliExpress). University final-year project; the report needs docs in `/docs`.

- Full instructions: `docs/PROJECT_BRIEF.md` (phases, scope, checkpoints, working rules). Approved plan: `docs/PLAN.md`. Progress: `STATUS.md`.
- Stack: backend Node/Express + Mongoose (MongoDB Atlas), scrapers (axios/cheerio, Puppeteer for AliExpress); frontend Next.js + TypeScript + Tailwind.
- Layout: `/backend` (API + scrapers + jobs), `/frontend` (Next.js), `/docs` (report material; `docs/reference/` = report template, old site.pdf).
- Secrets live in `backend/.env` (gitignored); keep `backend/.env.example` in sync. Never commit secrets. Do not use the previous owner's database.

## Rules
- After every task: update `STATUS.md`, run app + tests, commit with a clear message, push to `origin main`.
- Keep `docs/` (requirements, use_cases, erd.dbml, diagrams/, test_cases, screenshots_checklist) updated as features land.
- Ask before big decisions (paid services, changing backend language, deleting code).
- Checkpoints: stop and summarize in under 15 lines.
- Shell: Windows; Bash tool works (`/d/Code/Ex-Comm`). `gh` lives at `C:\Program Files\GitHub CLI\gh.exe`. Node 22.

## Decisions (approved 2026-10-07)
- Live scrapers: Daraz + PriceOye only. AliExpress = supplier source for the seller module from seed/cached data only (no live adapter), labelled "saved". Order after Checkpoint 1: T8b, frontend T9–T12, seller T14/T16, closing T17–T19, NICE T20–T21 last (PLAN.md §5).
- Matching: normalized title + fuzzy match, manual selection fallback (limitation in `docs/report_notes.md`).
- Run tasks in PLAN.md §5 order (T1→T19, NICE T20–T21 after checkpoint 2) without pausing; stop only at checkpoints (T8 backend, T12 end-to-end, T19 testing) or for decisions.

## Backend conventions
- `backend/src`: `app.js` (createApp factory), `server.js`, `config/`, `middleware/`, `models/`, `controllers/`, `routes/`, `utils/`, `scrapers/` (old AliExpress code in `scrapers/legacy`, not mounted).
- Errors: throw `AppError(status, msg)`; wrap async handlers in `utils/asyncHandler`; zod schemas via `middleware/validate`.
- Error shape: `{ error: { message, details? } }`. `User.passwordHash` is `select:false` and stripped in toJSON.
- Tests: Jest + supertest + mongodb-memory-server (`tests/helpers.js`); never touch Atlas.

## Run commands
- Backend: `cd backend && npm install && npm run dev` (API on :5000); `npm test` runs Jest; `npm run seed` resets sample data (demo login demo@excomm.pk / demo1234).
- Live checks: `node scripts/live-check.js "query"`, `node scripts/search-sweep.js ../docs/search_sweep.md`. Price job demo: `POST /api/jobs/price-check` with header `x-job-key` and body `{"mode":"simulate"}`.
- Frontend: `cd frontend && npm install && npm run dev` (http://localhost:3000, proxies /api to the backend on :5000; set `BACKEND_URL` to change it). Checks: `npm run lint`, `npm run typecheck`, `npm test` (Vitest), `npm run e2e` (Playwright; builds the app, starts an ephemeral demo backend, uses installed Edge). Screenshots: `npx playwright test e2e/screens.spec.ts --project=desktop` → `docs/screenshots/`.
- Frontend conventions: design tokens in `tailwind.config.ts`, shared classes in `globals.css` (`btn-*`, `card`, `input`, `badge-*`, `skeleton`, `t-*`); primitives in `src/components/ui`; every data page needs loading (Skeleton), empty (EmptyState) and error (ErrorState with retry) states; client data via SWR + `src/lib/api.ts`. Over plain http set `COOKIE_SECURE=false` on the backend if it runs with NODE_ENV=production.
- `MONGO_URI=memory` in `backend/.env` = embedded MongoDB persisted in `backend/.data/` (dev/demo fallback).
- Tooling quirk: backslashes in text sent through Write/Edit/node -e get dropped or turned into control characters (a regex digit class loses its backslash). In code use [0-9] and space-padded text instead of backslash escapes, and check the file afterwards.
- Git Bash: prefix commands with `MSYS_NO_PATHCONV=1` when passing `/api/...` paths as args. Write multi-line files with the Write tool, not heredocs containing backticks.

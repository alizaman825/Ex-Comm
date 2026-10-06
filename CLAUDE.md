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

## Run commands
(filled in as built)

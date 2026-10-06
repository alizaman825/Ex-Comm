## PROJECT
This folder holds my finished backend: a scraper collecting products from e-commerce platforms such as Daraz. I need a full web app on top of it: a PRICE COMPARISON PLATFORM. (Propose a good project name at the checkpoint.)

## PHASE 0: Repo setup
- Check `git config user.name` and `user.email` are mine; if not, ask me.
- Restructure into: /backend (existing code), /frontend, /docs.
- Remove any old git history/remote from the previous owner; `git init` fresh.
- Create a proper .gitignore (node_modules, venv, __pycache__, .env, db files, build output). Scan for hardcoded secrets/API keys and move them to .env plus a committed .env.example.
- Commit. I will give you my new GitHub remote URL; ask me for it, then push to main.

## PHASE 1: Audit and plan (do not write feature code yet)
Read the backend and report briefly: language/framework, how scraping runs, data fields per product, supported platforms, existing storage, known weaknesses (blocking, fragility, speed). Then propose:
1. Architecture (keep the existing backend language; add a REST API layer; Next.js + TypeScript + Tailwind frontend; simplest database that works, such as SQLite or Postgres via an ORM)
2. Database schema (tables, relations)
3. API endpoint list
4. Ordered task list, small enough for one session each, with rough effort
5. Risks, especially scraper reliability for a live demo
Then STOP and wait for my approval.

## FEATURE SCOPE
- Auth: register, login, logout, profile (JWT or session)
- Search products across platforms; filter (platform, price range, rating) and sort
- Compare the same product across platforms side by side
- Product detail page with price history chart
- Wishlist: add/remove/view
- Price alerts: user sets a target price; a scheduled job re-scrapes tracked products, stores price history, and creates in-app notifications (email optional)
- OUT OF SCOPE: admin panel, analytics dashboards, payments

## UI REQUIREMENTS (my report needs at least 10 distinct screens for screenshots)
Landing/home, register, login, search results, product detail with price chart, compare view, wishlist, alerts list/create, notifications, profile/settings, 404/about. Responsive, clean, consistent design, with loading, empty and error states.

## DEMO RELIABILITY (critical)
Live scraping can fail or get blocked during my demo. Add: result caching in the database, a seed script with realistic sample data (products plus price history on multiple platforms), and graceful fallback to cached data when a scrape fails. Add rate limiting and polite delays to the scrapers.

## DOCUMENTATION FOR MY REPORT (maintain throughout, in /docs)
I must write a formal report with the sections below, so keep these files updated as you build; I will turn them into diagrams and chapters:
- docs/requirements.md: numbered functional and non-functional requirements
- docs/use_cases.md: each use case in this table format: Use Case Title, Use Case ID, Requirement ID, Description, Pre-conditions, Task Sequence (steps in a column, with an Exceptions column), Post-conditions
- docs/erd.dbml: database schema in DBML (for dbdiagram.io)
- docs/diagrams/: text sources for the context diagram, DFD (level 0 and 1), activity diagrams for main flows, architecture diagram description, class diagram (yUML syntax), and sequence diagrams for login, search, wishlist, and price alert (sequencediagram.org syntax)
- docs/test_cases.md: at least 20 test cases in a table (ID, feature, steps, expected result, actual result, pass/fail), updated as you actually run tests
- docs/screenshots_checklist.md: list of screens with the URL and how to reach each

## WORKING RULES
- Be token-efficient: do not re-read files unnecessarily and do not paste large files back at me. Use CLAUDE.md for project memory (stack, structure, run commands, conventions); create it in Phase 1.
- After every task, update STATUS.md (built, working, broken, next) and make a git commit with a clear message.
- Do not rewrite working scraper code without a good reason.
- Run the app and tests yourself after each task and fix errors before moving on.
- Ask me before big decisions (new paid services, changing the backend language, deleting code).
- Never commit secrets.
- Checkpoints (stop and summarize in under 15 lines): after Phase 0, after Phase 1, after backend API works, after frontend works end to end, and after testing.
What to do with it

Create the empty GitHub repo first, because the agent will ask for its URL.
After each checkpoint, copy me the agent's short summary (and STATUS.md when it changes). I'll check it against the report requirements and write your next prompt.
Take screenshots from docs/screenshots_checklist.md once the UI works, and keep the /docs folder intact. That's the raw material I need for the report.
I'll also need your group member names and IDs, the project name once chosen, and the program name (e.g. BSCS) to fill the title page and certificate. Collect them while the agent is working. Go start Phase 0, and come back with the checkpoint summary.



# Source expansion research — permission review

Report only. No code, scraper behaviour, data, or configuration was changed. No store was signed up
for, logged into, or contacted beyond fetching public `robots.txt`, sitemap, and terms/privacy
pages. Reviewed 2026-11-20 (re-run; this session's network allowlist could reach all target hosts).

## Summary table

| # | Store/program | A. robots.txt | B. ToS | C. Data options | D. Search method | E. Verdict |
|---|---|---|---|---|---|---|
| 1 | Czone (czone.com.pk) | **Could not read at all** — every request (robots.txt and homepage) returns HTTP 403, from two independent fetch tools | Unreadable (blocked before reaching any page) | None found (blocked) | Blocked | **RED** |
| 2 | Shophive (shophive.com) | Empty file, HTTP 200 — no rules at all for any user-agent | No ToS page found; only a generic Magento privacy policy (no automated-access clause) | None found: no `sitemap.xml` at common paths, no JSON-LD on product pages | No robots.txt restriction on any path, but no sitemap/feed to use instead of search | **YELLOW** |
| 3 | Telemart (telemart.pk) → Telex.pk | Shopify default; `User-agent: *` broadly `Allow: /`, with the usual Shopify disallows (admin/cart/checkout/account/sort/filter traps) | Confirmed same company (see below); Shopify platform ToS + store's own `agents.md` explicitly invites read-only automated access | Sitemap (`https://www.telex.pk/sitemap.xml`), explicit `agents.md` agent-access doc, UCP/MCP shopping API at `/api/ucp/mcp` | `/search` not disallowed; sitemap is the documented discovery path | **GREEN** |
| 4 | Mega.pk | `User-agent: *` **disallows `?q=`** (confirmed) plus `?sort=/?filter=/?brand=` etc.; explicitly **allows** `/product/`, `/products/`, category paths, and `Sitemap: https://www.mega.pk/sitemap.xml` | Terms page reachable (`terms_of_services.php`) but has no automated-access/scraping clause either way | Sitemap present (200 OK); category/product paths explicitly allowed | Query-string search (`?q=`) is blocked; category + sitemap paths are allowed instead | **YELLOW** |
| 5 | Daraz affiliate program | N/A | N/A | The specific landing page URL from the original brief now 302-redirects to Daraz's generic page shell (campaign page no longer live); no feed/API details found on the live site | N/A | **UNVERIFIED** (page gone, not a permission finding) |
| 6 | AliExpress Affiliate/Open Platform API | N/A (it's an API program, not a scraping target) | Reachable: `open.aliexpress.com` (Open Platform portal) and `portals.aliexpress.com` (Affiliate Portal, redirects to `affiportals/web/portals.htm`) both load; `affiliates.aliexpress.com` did not resolve/connect | API docs (`open.aliexpress.com/doc/api.htm`) require login to view — could not read endpoint/rate-limit details without an account | A product-search affiliate API (`aliexpress.affiliate.product.query`) is publicly known to exist under this program, but its exact terms/limits are behind the login wall | **YELLOW** (program exists and is reachable, but approval + login needed for specifics) |
| 7 | Daraz (reference, from Step D review) | Disallows `/catalog/` — our scraper hits exactly that path | Unreadable (JS shell) | None found | Blocked path in use today | **RED** (already known, carried forward, unchanged) |
| 8 | PriceOye (reference, from Step D review) | Disallows `?q=`/`?...&` query strings — our scraper hits exactly that | Unreadable (JS shell) | None found | Blocked path in use today | **RED** (already known, carried forward, unchanged) |

## Store/program details

### 1. Czone (czone.com.pk) — RED

- `https://www.czone.com.pk/robots.txt` returns a Cloudflare "Just a moment..." JS-challenge page on
  a plain fetch (verified directly). A second, independent fetch (a separate tool/IP) got a flat
  **HTTP 403 Forbidden** with no body at all, for both the robots.txt URL and the bare homepage.
- This means the site blocks non-browser clients at the infrastructure level before robots.txt can
  even be read. No rules, terms, sitemap, or any other page content could be read.
- I did not attempt to solve the Cloudflare challenge or spoof a browser to get past it — that would
  be circumventing an access control, which the task's own rules (and good practice) rule out.
- **Verdict: RED.** Not just "terms unclear" — the site actively prevents automated reads of even its
  own robots.txt. Nothing here supports adding Czone to the pipeline.

### 2. Shophive (shophive.com) — YELLOW

- `https://www.shophive.com/robots.txt` returns HTTP 200 with an empty body (confirmed 0 bytes, not
  a fetch failure — headers show a real Magento/Cloudflare response, `x-magento-cache-debug: HIT`).
  An empty robots.txt means no `Disallow` rules exist for any crawler — technically permissive.
  Confirmed via both `www.shophive.com` and `shophive.com` (the bare domain 301-redirects to `www`).
- No Terms of Service page was found: checked `/terms-and-conditions`, `/terms-conditions`,
  `/terms-of-service`, `/terms-of-use`, `/term-and-condition`, and two nested guesses — all 404. The
  homepage itself contains no link with the word "terms" anywhere in its HTML. `/privacy-policy`
  **does** exist (200 OK) but is a generic template with no automated-access, scraping, or data-reuse
  clause (checked for "scrape/crawl/bot/automat/spider/data mining/robot/api" — only unrelated "Google
  Maps API key" hit).
- No official data option found: no `sitemap.xml` at `/sitemap.xml`, `/sitemap/sitemap.xml`,
  `/media/sitemap/sitemap.xml`, or `/pub/sitemap.xml` (all 404). No JSON-LD structured data on the
  homepage or on a sampled product page (`apple-macbook-air-2026-m5-13-6-16gb-1tb-ssd`) — zero
  `application/ld+json` blocks on either. Product pages are server-rendered plain HTML with the price
  in visible text (e.g. "Rs 469,999"), so a page fetch does get real data, just not via a feed.
- Search method: robots.txt places no restriction on any path, including a query-string search, but
  there's no sitemap to use as an alternative, so a sync job would have to crawl category pages
  (which do exist, e.g. `/apple/ipad/ipad-pro-m5`) to discover products rather than reading a feed.
- **Verdict: YELLOW.** Clearly allowed by robots.txt, but with no official feed, no sitemap, and an
  unreadable/absent ToS, this is "permitted by omission," not an explicit invitation — same shape as
  the Mega.pk entry.

### 3. Telemart (telemart.pk) / Telex.pk — GREEN, confirmed same company

- `https://telemart.pk/` returns an HTTP 301 with header `x-redirect-reason: primary_domain_redirection`
  straight to `https://www.telex.pk/`, with Shopify cookies (`_shopify_essential`) and
  `powered-by: Shopify` on the response. This confirms Telemart and Telex.pk are the same Shopify
  store, not just a coincidental redirect.
- **Direct confirmation of the same-company question:** Telex.pk's own `robots.txt` names itself, and
  its `/agents.md` document's title is literally **"Agent Instructions — TeleX (Telemart)"** — the
  site identifies itself by both names in a page meant to be read by automated agents.
- `robots.txt` (`https://www.telex.pk/robots.txt`) is the standard Shopify template: broad
  `User-agent: *` / `Allow: /`, with the usual Shopify-internal disallows (`/admin`, `/cart/`,
  `/checkout`, `/account`, filter/sort crawl traps, `/cart.js`, `/recommendations/products`). It does
  **not** disallow `/search` or product/collection pages. It also links `Sitemap:
  https://www.telex.pk/sitemap.xml` and a store-specific `https://www.telex.pk/agents.md`.
- `agents.md` is the most useful find in this whole review: it's an explicit, store-published policy
  for automated agents. Relevant points, quoted/paraphrased:
  - "You may also read public HTML pages for additional context, provided your requests follow the
    agent-identification guidance" — under a "Read-only browsing" heading.
  - It explicitly names the permitted read paths: discover URLs via `/sitemap.xml`, read product
    pages at `/products/{handle}`, browse `/collections/all` or `/collections/{handle}`.
  - It separately asks that "agent-initiated" requests (i.e. ones that take shopping actions, not
    just reads) identify themselves and, for server-to-server traffic, use Shopify's "Web Bot Auth."
    This condition is written for transactional/agentic actions (carts, checkout); plain page reads
    are covered by the more general "read public HTML pages... provided your requests follow the
    agent-identification guidance" line, so a polite, identifying `User-Agent` string (not a browser
    impersonation) is the practical minimum even for the read-only sync case.
  - Terms/privacy/refund/shipping policy URLs are all listed and all return HTTP 200 (e.g.
    `https://www.telex.pk/policies/terms-of-service`).
- No "requires login/payment/agreement to read" condition was hit: everything above is on public,
  unauthenticated pages.
- **Verdict: GREEN.** This is the clearest "yes" in the whole review — robots.txt allows it, and the
  store has gone out of its way to publish machine-readable permission for exactly this use case
  (sitemap discovery + product/collection page reads).

### 4. Mega.pk — YELLOW (confirms the brief's known belief)

- `https://www.mega.pk/robots.txt`: `User-agent: *` / `Allow: /` as a base rule, but then explicitly
  `Disallow: /*?q=` — **this confirms the brief's "known: Mega.pk blocks `?q=` search" belief with
  direct evidence.** Also disallows `?sort=`, `?filter=`, `?brand=`, `?page=`, `?color=`, `?size=`,
  `?condition=`, `?price=`, and various tracking params, plus `/cart/`, `/checkout/`, `/account/`,
  `/admin/`.
- The same file explicitly **allows** `/product/`, `/products/`, `/laptops/`, `/used/laptops/`,
  `/DSLRcameras/`, `/actioncameras/`, `/accessories/`, and comparison pages — and publishes
  `Sitemap: https://www.mega.pk/sitemap.xml`, which returned HTTP 200.
- Terms page: found via the homepage footer at `terms_of_services.php` (not the `terms-and-conditions`
  guess from the original UNVERIFIED pass, which 404'd) — HTTP 200, but the page content has no
  automated-access/scraping/data-reuse language either permitting or forbidding it (checked for the
  same keyword set as Shophive, no relevant hits).
- **Verdict: YELLOW**, same shape as the brief anticipated: search is blocked but there's a real,
  working, explicitly-allowed alternative (sitemap + category/product paths) to reach the same data
  without touching the blocked `?q=` path.

### 5. Daraz affiliate program — page no longer live (not a permission finding)

- The specific URL from the original review,
  `https://pages.daraz.pk/wow/i/pk/landingpage/daraz-affiliate-program`, now returns an HTTP 302 to
  `https://pages.daraz.pk/?from=icms:offline` — a generic campaign-page shell, not an affiliate
  program page. The campaign this URL pointed to appears to have ended or been renamed.
- I did not search for a replacement URL, since finding and reading a different page wasn't in the
  original list of exact URLs to check, and guessing at marketing URLs risks misattributing content.
- **Not rated.** This isn't a site blocking us — the specific page is simply gone. If ali wants the
  current Daraz affiliate program page checked, that needs a fresh URL (e.g. found via Daraz's own
  site navigation) rather than re-trying this dead link.

### 6. AliExpress Affiliate/Open Platform API — YELLOW (reachable, but specifics are gated)

- `https://open.aliexpress.com/` (AliExpress Open Platform) loads: HTTP 200, page title "AliExpress
  Open Platform", with visible nav links to API docs (`open.aliexpress.com/doc/api.htm`) and a
  finance/API-management console.
- `https://portals.aliexpress.com/` redirects (302) to
  `http://portals.aliexpress.com/affiportals/web/portals.htm` (HTTP 200, title "AliExpress Affiliate
  Portals") — this is the Affiliate Portal proper. The page is a thin JS-app shell (~4KB of HTML with
  no readable body text), so its content couldn't be read without executing JavaScript.
- `https://open.aliexpress.com/doc/api.htm` loads (200) but the word "login" appears multiple times
  in the page — the actual API method documentation (parameters, rate limits, data terms) is gated
  behind signing in to a developer account. I did not attempt to log in or create an account.
- `https://affiliates.aliexpress.com/` failed to connect (connection closed before a response), and
  `https://developers.aliexpress.com/` returned a server error (HTTP 500) — neither looks like a
  real, current entry point; `open.aliexpress.com` and `portals.aliexpress.com` are the two that
  actually work.
- It's publicly known (not verified here beyond the reachable portal pages) that AliExpress's
  Affiliate API includes a product-search method (`aliexpress.affiliate.product.query`), gated by an
  approved App Key/Secret. This review could not confirm exact rate limits or data-reuse terms, since
  that detail sits behind the login wall above.
- No login/payment/agreement was required to reach the portal and marketing pages themselves — only
  to read the detailed method docs, which is normal for a developer program and not the kind of
  "requires login to read the store" condition the task asked me to stop for.
- **Verdict: YELLOW.** The program demonstrably exists and has a reachable entry point, but approval
  (an App Key) and a login are required before the real terms can be read — this can't be upgraded to
  GREEN without that approval step, which ali would need to initiate.

## What's already established (reused from the Step D review, not re-done)

A prior report-only review (project file `phase1-step-d-scraping-review.md`, discussed on PR #41)
already checked Daraz and PriceOye — our two current live scrapers. Unchanged, carried forward:

- **Daraz** (`https://www.daraz.pk/robots.txt`): `User-agent: *` disallows `/catalog/` among other
  paths. Our scraper (`backend/src/scrapers/daraz.js`) builds every search as
  `https://www.daraz.pk/catalog/?ajax=true&page=N&q=...` — a direct hit on a disallowed path, on
  every search, regardless of volume. Daraz's terms page is a JS shell with no server-rendered text;
  unreadable, not verified either way.
- **PriceOye** (`https://priceoye.pk/robots.txt`): `User-agent: *` disallows any URL with a `?` or
  `&` except `?page=` and `?source=ppc`. Our scraper (`backend/src/scrapers/priceoye.js`) always
  requests `https://priceoye.pk/search?q=...`, which falls under the disallow. Same JS-shell problem
  on PriceOye's terms pages.

## Architecture proposal — unified search without hitting store search pages per query

- **Pattern:** a background job (same shape as the existing `daily-refresh.yml` /
  `catalogSync.js` / `priceCheck.js` jobs already in this repo) periodically pulls from each GREEN or
  YELLOW store's permitted surface and writes normalized listings into our own database (same
  `listings`/`products` shape as today). User search then queries only our database, so no
  user-triggered request ever touches a store's search endpoint.
- **Per-store sync source, now that stores are actually verified:**
  - **Telex.pk (Telemart) — GREEN:** use `/sitemap.xml` to discover product URLs, then read
    `/products/{handle}` pages (or, better, the documented UCP/MCP shopping endpoint at
    `/api/ucp/mcp`, which returns structured product data rather than HTML to parse). This is the one
    store where the site itself asks agents to use the sitemap for discovery — follow that directly.
  - **Mega.pk — YELLOW:** use `Sitemap: https://www.mega.pk/sitemap.xml` plus the explicitly-allowed
    category paths (`/laptops/`, `/DSLRcameras/`, `/actioncameras/`, `/accessories/`, etc.) to
    enumerate products; never call the disallowed `?q=` search path.
  - **Shophive — YELLOW:** no sitemap exists, so the only enumeration path is crawling the allowed
    category pages (e.g. `/apple/ipad/...`) and following in-page product links — more fragile than a
    sitemap and more pages to fetch for the same catalog coverage.
  - **AliExpress Affiliate API — YELLOW:** would need ali to apply for API approval (App Key) before
    any sync could use it at all; until then this isn't actionable as a sync source, only as the
    existing on-demand button.
  - **Czone — RED:** no sync source; the site can't be read by any method tried.
- **Rate:** a gentle, fixed interval (e.g. once every few hours per store, under any crawl-delay the
  site specifies — none of the four reviewed robots.txt files set an explicit `Crawl-delay`, but a
  conservative default like one request every 2–5 seconds with a real, identifying `User-Agent` and
  backoff on 429/5xx matches what the existing jobs already do for Daraz/PriceOye).
- **Risk/freshness trade-off:** sync-based search is honest about staleness — a product's price is
  only as fresh as the last sync, not live at query time. This should be surfaced in the UI (e.g.
  "price as of ...") rather than implied to be live. It's also a bigger engineering lift than
  scrape-on-search (storage, scheduling, de-duplication, staleness UI).
- **Daraz/PriceOye today:** this proposal doesn't ask to change `backend/src/scrapers/daraz.js` or
  `priceoye.js` — out of scope here. The same sync-based pattern would not by itself fix the
  robots.txt violations already found in the Step D review, because the violation is about which
  *path* is requested (`/catalog/`, `?q=`), not about *when* or *how often* it's requested. That needs
  a different allowed path or an official feed/API for those two, independent of this question.
- **eBay and AliExpress:** unchanged — both stay on-demand/button-triggered, not part of the
  background sync or ordinary live search, per the existing 2026-10-07 decision.
- **Nothing is recommended for Czone (RED).**

## Risks

- Telex.pk's `agents.md` ties "agent-initiated" (transactional) requests to Web Bot Auth, but is
  looser about plain reads. A sync job should still send an honest, identifying `User-Agent` (not a
  browser-spoofing one) — this review deliberately avoided testing what happens with a bot-identifying
  UA, so the practical rate limit / blocking behavior for a labeled bot is still unverified.
  Recommend a short real-world test (a handful of requests with an honest UA) before building the
  full sync job, as a separate, small follow-up — not part of this report-only task.
- Shophive and Mega.pk are both "permitted by omission or explicit category access," not explicit
  invitations like Telex.pk — robots.txt technically allows it, but neither publishes a feed, and
  their terms pages say nothing either way. This is the same legal-grey-area pattern already flagged
  for Daraz/PriceOye, just one notch less severe (no actively disallowed path is being hit).
  Treat this as a decision for ali, not a settled "safe."
  - Note: Mega.pk's own robots.txt contains a comment, verbatim: "`/items_images/` was disallowed
    until 2026-10-30; that hid every product image from Google Images, Product rich results and
    Merchant Center." This shows Mega.pk actively tunes its robots.txt for its own SEO/data-feed
    reasons, which is a mild positive signal that the file reflects real current intent, not a stale
    default.
- Czone blocking even robots.txt reads is a stronger signal than "scraping forbidden" — it suggests
  the operator runs aggressive bot mitigation generally, so even a "polite," low-rate sync attempt
  could trip it (CAPTCHAs, IP blocks) without ever reaching product data. Not worth attempting further.
- AliExpress's affiliate API approval process, timeline, and exact terms are unknown without actually
  applying — this report can't tell ali how long that would take or what commitments it carries
  (e.g. minimum traffic, exclusivity) because that's behind the login wall.

## Decisions needed from ali

1. **Add Telex.pk (Telemart) as the first new synced store**, using its sitemap + `/products/{handle}`
   pages (or the UCP/MCP endpoint, which is more work to integrate but returns structured data).
   This is the one store this review found with an unambiguous GREEN. Recommend yes.
2. **Shophive and/or Mega.pk as second-tier additions** (YELLOW — technically allowed, no explicit
   invitation, terms don't address it either way). Mega.pk has a sitemap and explicit category
   allow-list, which makes it the easier of the two to sync; Shophive needs link-crawling instead of a
   sitemap. Decide whether "allowed by omission" is an acceptable bar for the report, given this is a
   university project rather than a commercial scraper — or whether to hold off until each site's
   owner can be asked directly.
3. **Whether to pursue AliExpress affiliate API approval** (an application + login, not something
   this review could do on your behalf) — if approved, it could eventually replace the on-demand
   AliExpress button with a real sync, but that's a separate, longer-term decision.
4. **Czone: drop it from consideration**, or is there a reason to keep trying (e.g. a known contact
   at the company)? This review found no technical way in.
5. Separately from this report: the Step D review found that the **current live Daraz and PriceOye
   scrapers already violate those sites' own robots.txt** today, independent of anything about new
   stores. That's a standing risk this report surfaced again by reusing it, not a new one — do you
   want a decision on that now, or should it wait for its own thread?

## Recommended order to add stores

1. **Telex.pk (Telemart)** — GREEN, sitemap + documented agent-read permission, lowest risk and
   lowest engineering effort (a real feed/API to build against).
2. **Mega.pk** — YELLOW, but has a sitemap and an explicit allow-list of category paths, so
   enumeration is nearly as easy as a GREEN store; just avoid the one disallowed `?q=` path.
3. **Shophive** — YELLOW, technically open robots.txt, but no sitemap means link-crawling category
   pages — more fragile and slower to build than #1/#2, for a less certain legal footing.
4. **AliExpress Affiliate API** — gate on ali applying for and receiving approval; not actionable
   today.
5. **Czone** — do not pursue; no technical access path was found.
6. **Daraz affiliate program** — needs a fresh URL before it can be assessed at all; the one in the
   original brief no longer resolves to a live page.

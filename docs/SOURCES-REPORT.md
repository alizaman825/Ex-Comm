# Source expansion research — permission review

Report only. No code, scraper behaviour, data, or configuration was changed. No store was signed up
for, logged into, or contacted beyond fetching public `robots.txt` and terms pages. Reviewed
2026-11-20.

**Important limitation up front:** this review's sandbox could reach `daraz.pk` and `priceoye.pk`
(already allowed from earlier work — see Step D review below) but could not resolve
`czone.com.pk`, `shophive.com`, `telemart.pk`/`telex.pk`, `mega.pk`, or any AliExpress
affiliate/developer subdomain (`portals.aliexpress.com`, `open.aliexpress.com`,
`developers.aliexpress.com`, `affiliates.aliexpress.com`), or Daraz's own affiliate landing page
(`pages.daraz.pk`). I added all of these to this cloud environment's network allowlist
(`update_environment`, saved — confirmed via `get_environment`), but the change did not take effect
in this running session even after retrying three times over several minutes. **Items 1–7 below for
those stores/programs are therefore unverified, not researched-and-cleared.** The hosts are now
saved in the environment's allowlist, so a fresh session (or this one after a restart) should be
able to complete the live checks — ask me to re-run and I'll fill in the real findings and update
this report and the PR.

## Summary table

| # | Store/program | A. robots.txt | B. ToS | C. Data options | D. Search method | E. Verdict |
|---|---|---|---|---|---|---|
| 1 | Czone (czone.com.pk) | Not verified — host unreachable this session | Not verified | Not verified | Not verified | **UNVERIFIED** |
| 2 | Shophive (shophive.com) | Not verified — host unreachable this session | Not verified | Not verified | Not verified | **UNVERIFIED** |
| 3 | Telemart (telemart.pk) / Telex.pk | Not verified — host unreachable this session | Not verified | Not verified | Not verified | **UNVERIFIED** |
| 4 | Mega.pk | Not verified — host unreachable this session (known belief: `?q=` search blocked, unconfirmed) | Not verified | Not verified | Not verified | **UNVERIFIED** |
| 5 | Daraz affiliate program | N/A (program page unreachable) | N/A | Not verified — could not confirm whether it's commission-link-only or includes a feed | N/A | **UNVERIFIED** |
| 6 | AliExpress Affiliate/Open Platform API | N/A | N/A | Not verified — could not reach any of the 4 program/docs subdomains | N/A | **UNVERIFIED** |
| 7 | Daraz (reference, from Step D review) | Disallows `/catalog/` — our scraper hits exactly that path | Unreadable (JS shell) | None found | Blocked path in use today | **RED** (already known, see below) |
| 8 | PriceOye (reference, from Step D review) | Disallows `?q=`/`?...&` query strings — our scraper hits exactly that | Unreadable (JS shell) | None found | Blocked path in use today | **RED** (already known, see below) |

## What's already established (reused from the Step D review, not re-done)

A prior report-only review (project file `phase1-step-d-scraping-review.md`, discussed on PR #41)
already checked Daraz and PriceOye — our two current live scrapers:

- **Daraz** (`https://www.daraz.pk/robots.txt`): `User-agent: *` disallows `/catalog/` among other
  paths. Our scraper (`backend/src/scrapers/daraz.js`) builds every search as
  `https://www.daraz.pk/catalog/?ajax=true&page=N&q=...` — a direct hit on a disallowed path, on
  every search, regardless of volume. Daraz's terms page is a JS shell with no server-rendered text;
  unreadable, not verified either way.
- **PriceOye** (`https://priceoye.pk/robots.txt`): `User-agent: *` disallows any URL with a `?` or
  `&` except `?page=` and `?source=ppc`. Our scraper (`backend/src/scrapers/priceoye.js`) always
  requests `https://priceoye.pk/search?q=...`, which falls under the disallow. Same JS-shell problem
  on PriceOye's terms pages.

Nothing about these two changed in this review — they're carried forward as-is, per the
coordinator's instruction to reuse rather than redo that work.

## Store/program details — why each is unverified

For items 1–6, the only fact established is a DNS-resolution failure
(`getaddrinfo ENOTFOUND <host>`) from every fetch attempt, which this sandbox's error message
attributes to the session's network allowlist rather than to the target site. No robots.txt, terms
text, API docs, sitemap, or JSON-LD was read for any of them. Specifically attempted and failed:

- `https://czone.com.pk/robots.txt`, `https://www.czone.com.pk/robots.txt`, `https://czone.com.pk/`
- `https://shophive.com/robots.txt`, `https://www.shophive.com/robots.txt`, `https://shophive.com/`
- `https://telemart.pk/`, `https://telex.pk/robots.txt`, `https://www.telex.pk/robots.txt`
- `https://mega.pk/robots.txt`, `https://www.mega.pk/robots.txt`
- `https://pages.daraz.pk/wow/i/pk/landingpage/daraz-affiliate-program`, `https://www.involve.asia/`
- `https://portals.aliexpress.com/`, `https://open.aliexpress.com/`,
  `https://developers.aliexpress.com/`, `https://affiliates.aliexpress.com/`

I confirmed via `get_environment` that all of these hosts are now saved in this cloud environment's
allowlist, but the live fetches still failed after the save, including after a delay. This looks
like either a propagation delay longer than the ~30 seconds the tool describes, or a step (e.g. a
container restart) that this running session hasn't gone through yet.

**Do not treat the blank cells above as "allowed" or as "likely fine."** They mean exactly what they
say: not read. In particular, the task's stop condition ("stop and ask if a store requires login,
payment, or an agreement to read its pages") could not even be checked for these six items — I don't
yet know if any of them hit that condition.

## Architecture proposal — unified search without hitting store search pages per query

This can be stated in general terms now and filled in with real per-store detail once the six
unverified items are re-run:

- **Pattern:** a background job (same shape as the existing `daily-refresh.yml` / `catalogSync.js` /
  `priceCheck.js` jobs already in this repo) periodically pulls from each **GREEN or YELLOW** store's
  *permitted* surface — a product sitemap, a JSON feed (e.g. a Shopify `/products.json` if Telex.pk
  turns out to allow it), a partner/affiliate feed, or JSON-LD on category pages reached through an
  allowed path — and writes normalized listings into our own database (same `listings`/`products`
  shape as today). User search then queries only our database, so no user-triggered request ever
  touches a store's search endpoint.
- **Per-store sync source:** cannot be filled in honestly until items 1–6 are verified — the right
  mechanism (sitemap vs. feed vs. API) depends entirely on what each site's robots.txt and terms
  actually allow, which is exactly what's missing right now.
- **Rate:** a gentle, fixed interval (e.g. once every few hours per store, well under any crawl-delay
  the site specifies, with a real `User-Agent` and backoff on errors) — the existing jobs already
  follow this shape for Daraz/PriceOye's catalog sync, so the same code path extends naturally.
- **Risk/freshness trade-off:** sync-based search is honest about staleness — a product's price is
  only as fresh as the last sync, not live at query time. For a university-scope project this is an
  acceptable trade for a large reduction in direct-request volume and in robots.txt exposure, but it
  should be surfaced in the UI (e.g. "price as of ...") rather than implied to be live, and it is a
  bigger engineering lift (storage, scheduling, de-duplication, staleness UI) than the current
  scrape-on-search design.
- **Daraz/PriceOye today:** this proposal doesn't ask to change `backend/src/scrapers/daraz.js` or
  `priceoye.js` — that's explicitly out of scope here. But it's worth noting for ali's decision: the
  same sync-based pattern, if it were ever applied to Daraz/PriceOye too, would not by itself fix the
  robots.txt violations already found in the Step D review, because the violation is about which
  *path* is requested (`/catalog/`, `?q=`), not about *when* or *how often* it's requested. That
  problem needs a different allowed path or an official feed/API for those two, independent of this
  architecture question.
- **eBay and AliExpress:** unchanged — both stay on-demand/button-triggered, not part of the
  background sync or the ordinary live search, per the existing 2026-10-07 decision.
- **Nothing is recommended for RED stores.** None of items 1–6 are rated RED here only because none
  of them could be rated at all; this is not a finding that any of them are safe.

## Risks

- The biggest risk right now is reporting confidence that doesn't exist: 6 of 8 rows in the summary
  table have no real evidence behind them. Treat every "UNVERIFIED" as a TODO, not as a soft yes.
- Once real data comes in, the general scraping-legality risk pattern already seen with Daraz/
  PriceOye (robots.txt technically allowing a path while terms are unreadable, or robots.txt
  explicitly disallowing the only practical search path) is likely to recur with at least some of
  Czone/Shophive/Telemart/Mega — none of these are large enough to have dedicated affiliate APIs the
  way Daraz or AliExpress might.
- A sync-based architecture is a bigger build than today's scrape-on-search design. It shouldn't be
  started until there's at least one real GREEN/YELLOW store to build it for.

## Decisions needed from ali

1. Should I re-run the 6 unverified items now that the hosts are saved in the environment allowlist
   (may just need a fresh session), or would you rather restart/approve the environment change
   yourself first?
2. Separately from this report: the Step D review found that the **current live Daraz and PriceOye
   scrapers already violate those sites' own robots.txt** today, independent of anything about new
   stores. That's a standing risk this report surfaced again by reusing it, not a new one — do you
   want a decision on that now, or should it wait for its own thread?

## Recommended order to add stores (provisional — depends entirely on verification)

Cannot be given honestly yet. Ranking which store to add first requires knowing which ones are
GREEN/YELLOW, which this report could not determine. Once re-run with real network access, the order
should favor: (a) any store with an official feed/API over scraping, (b) any store whose terms are
actually readable and permissive, (c) lower-effort sync sources (a sitemap) over ones needing
approval (an affiliate program).

# Report notes

Material for the report's design, limitations, and future-work chapters. Updated as the project is built.

## Design decisions
- **Backend kept in Node.js/Express.** The original scraper was written in it. MongoDB (Mongoose) was kept because the existing code already used it.
- **Live sources are Daraz and PriceOye.** Both expose search results without a headless browser: Daraz returns JSON from its catalog endpoint, and PriceOye serves server-rendered HTML. This makes scraping fast (about 1–2 s) and reliable.
- **AliExpress is the supplier source, from saved data only.** There is no live AliExpress scraper: its pages need a headless browser, prices are in USD, and it shows slider captchas to automated clients. Supplier listings and prices are seeded sample data (USD converted to PKR at a configurable rate) and are always labelled "saved".
- **eBay is a second supplier source, checked live via its official Browse API (OAuth2 client credentials), not scraped.** No headless browser and no blocking risk, since it is a real authenticated API call; this is why it works the same locally and deployed, unlike a scraper on a datacenter IP. Prices come back in USD and are converted to PKR with the same configurable exchange rate as AliExpress. Like AliExpress, it is on demand only ("Check on eBay"), not part of the default live search, and is never the "cheapest" price.
- **Amazon is a third supplier source, via Bright Data's managed scraping API (not a direct scrape).** Amazon blocks datacenter IPs (Render, Vercel, AWS...) aggressively; Bright Data runs the request through its own proxy/anti-bot network and returns structured JSON, so Ex-Comm never talks to Amazon directly. Collection is asynchronous (trigger a job, poll until ready) and can take up to a minute, longer than the other on-demand checks. Same on-demand pattern, USD→PKR conversion and "never cheapest" rule as eBay.
- **AliExpress can optionally route through Bright Data's Web Unlocker too**, when `BRIGHTDATA_API_KEY`/`BRIGHTDATA_ZONE` are set: the existing HTML parser is unchanged, only the transport (direct request vs. Bright Data's proxy) changes, so a block only costs the Bright Data request budget, not a code change. Falls back to the original direct request when Bright Data is not configured.
- **Bright Data free-tier caution for the report:** this was deliberately kept on-demand (not folded into the default live search) because Bright Data's free tier (~5,000 requests/month at the time of writing) would be exhausted quickly if every ordinary search triggered Amazon/AliExpress requests by default, and the extra latency (its own fetch plus, for Amazon, async polling) would slow down every search, not just the ones that want international pricing.
- **Seed price history is generated sample data.** The 90 days of daily prices for every sample listing are produced by a deterministic generator (gentle trend, noise, short sales, occasional recent drops), not recorded from the stores. Only prices captured after the app starts (live searches and the price-check job) are real observations. Charts and "price drop" figures built from seed data illustrate the feature and must not be read as real market history.
- **Supplier prices are saved data.** AliExpress prices are derived from retail prices with category-specific discounts, stored with their USD value, and never refreshed by the price-check job.
- **Live search, saved in our database.** Every search scrapes Daraz and PriceOye live; what it finds is stored in the database (so products can be compared, charted, wishlisted and alerted on) and the results are then read back from the database. An identical search within 15 minutes reuses that result instead of hitting the stores again, and the page says how long ago the stores were checked; a "Refresh from stores" button forces a new check. If the stores cannot be reached, stored data is shown and labelled as such.

## Known limitations

### Product matching across platforms
Each store names the same product differently, e.g. "Apple iPhone 15 (128GB) - Black - PTA Approved" on one and "iPhone 15 128 GB Black" on another. There is no shared product identifier (such as a GTIN or barcode) in the public data, so Ex-Comm matches products heuristically:

1. **Title normalization:** lowercase, remove punctuation, marketing words ("official", "PTA approved", "free delivery", "original"), colours, and bracketed text. Units are normalized ("128 GB" → "128gb"), and the brand and model/variant tokens are extracted.
2. **Fuzzy matching:** listings whose normalized tokens are similar above a threshold (token-set similarity) and that share the same storage/variant numbers are grouped under one product.
3. **Manual selection fallback:** when automatic matching misses a pair or groups products wrongly, the user can pick products manually on the compare page.

Limitations to state in the report:
- Matching can produce **false negatives** (the same product not grouped). Example: a missing brand in one title. These are covered by manual comparison.
- Matching can produce **false positives** (different variants grouped). Example: "Galaxy A15" vs "Galaxy A15 5G". To reduce this, the matcher is conservative and requires numeric tokens (storage, model numbers) to match exactly.
- Accessories (cases, chargers) can look like the main product. Very cheap listings in a group are flagged rather than trusted.
- Accuracy is measured on a small hand-labelled sample, not a large benchmark.
- **Future work:** use barcodes/GTINs where stores publish them, add learned similarity (text embeddings), and let user feedback ("not the same product") improve matching.

### Seller module (dropshipping margins)
- **Margin figures are estimates.** They use a configurable USD→PKR rate and adjustable shipping, customs and platform-fee assumptions; the UI always shows the assumptions used. Real costs vary by product, courier and customs valuation.
- **Supplier data may be saved data.** AliExpress needs a browser and often shows a captcha, so supplier prices are seeded/cached and labelled "saved" unless a live scrape succeeded ("live").
- **Cross-store matching is fuzzy with manual fallback**, and cross-platform comparison is strongest in electronics, where model names are standardized; fashion and generic goods match poorly.

### Scraping
- Scrapers depend on each store's current page structure and endpoints. A redesign can break them; fixture tests detect this quickly, and the cache/seed fallback keeps the app usable.
- Prices are scraped at most every few hours, so a shown price can be slightly out of date. The UI shows "last updated" times.
- Only public search pages are read, with polite random delays, one request at a time per store, and a circuit breaker. No login-protected or personal data is collected.

### Live search mirrors the stores (nothing is filtered)
Decision after user testing: an earlier design checked every scraped title against the query and dropped the rest. A search for "iphone 16 pro max" then showed 1 product while Daraz itself listed about 4,000, so the filter was removed. The rules now:
- **Live search shows what the stores show.** Each store's own search is asked for the query; its results are stored in our database (so they can be compared, charted, wishlisted and alerted on) and listed in the stores' order. Nothing is dropped for being an accessory, loosely related or a duplicate.
- **A product from any one store is a result.** Nothing requires a second store to carry it. One-store products show as "Only on Daraz"; the compare view marks the other stores "Not available".
- **Ranking only.** Inside each loaded batch, the best matches are placed first (model numbers matching in any spelling, brand, accessory words when the query contains one; accessory-like or "for iPhone ..." titles are ranked lower when the query is not about accessories). Ranking never removes an item. Sorting and filters (store, price, rating, category) apply to the results loaded so far.
- **Show more.** The first request loads one page per store (Daraz 40, PriceOye 24) and shows 24 results; "Show more" raises the count by 24 and loads further store pages only when needed (at most 3 pages per store per request; the page says "Showing N of about X" and each store chip "40 of 4,063"). The totals come from the stores (Daraz reports its item count; PriceOye's is estimated from its last page number and marked "about").
- **Same-store listings are never merged** (two sellers of the same title stay separate products); listings from different stores are grouped into one product by exact normalised key or fuzzy match, with threshold 0.7.
- **Reuse window.** The ordered list for a query is kept in the database and reused for 15 minutes (10 minutes if it was empty). "Refresh from stores" bypasses it and also closes the per-store circuit breaker.
- **Stored data** (relevance-filtered search over our database) is used only for demo mode, category browsing, `live=false`, and when no store answers; it keeps the model-number, brand and accessory rules (`services/relevance.js`), including spacing/glue tolerance ("15promax" = "15 pro max") and a property-style test that the database pre-filter never excludes what the relevance check accepts.

Consequences to state in the report: mirrored results include accessories and spam that the store itself returns (they are ranked below real products, not hidden); PriceOye's search returns loosely related items for most queries; the store-reported totals are what the store claims, and a store may stop paging earlier (Daraz serves about 100 pages). The earlier relevance-filter audit (glued model names, accessory words, Levi's brand spelling, pre-filter tolerances, cache of empty results, time budget) still applies to the stored-data path and is covered by tests.
### When a store cannot be reached
The results banner never says only "could not be reached". Each store that did not answer is listed with its reason, taken from the error the scraper reported:

| Reason shown | Cause | What the user can do |
|---|---|---|
| took too long to answer | request timed out (8 s per request) | try again; a slow connection can also hit the 25 s search time limit |
| refused the request | HTTP 403/429 or a captcha page: the store is blocking automated access | wait, avoid repeated searches, or try another network |
| is paused for a few minutes after repeated failures | the circuit breaker: 3 failures in a row pause a store for 10 minutes so it is not hammered | **Refresh from stores** closes the breaker and tries immediately |
| was still working when the time limit was reached | the 25 s live-search budget ended; anything found before that is still shown | refresh, or search a narrower phrase |
| returned a page we could not read | the store changed its page layout | report it; fixture tests detect this |
| could not be reached: ... | DNS, firewall, VPN or no internet | `npm run check:stores` in `backend/` tests both stores from the machine and explains the failure |

A store that answered but has no matching product is not a problem and is not listed as one. `GET /api/platforms` also exposes each store's last error, last success time and breaker state.

### Items that only say what they fit
Keyword-stuffed listings such as "Mini Pearl Handbag for iPhone 15 Pro Max" are shown in live search (nothing is filtered) but ranked below real phones. In stored-data search, where relevance filtering still applies, a model number that only appears after "for / compatible with / fits" counts as an accessory.
### Search sweep (live test of 29 terms)
Full results: `docs/search_sweep.md` (regenerate with `node scripts/search-sweep.js ../docs/search_sweep.md` from `backend/`). For each term the sweep reads the first page of each live store, as the app does, and records the store's reported total. Terms cover the six categories, non-electronics and six accessory queries.
- **Reliability:** all 58 term-and-store requests succeeded.
- **Volume:** Daraz reports 2,500 to 4,080 results for every term (it pads short queries with loosely related items); PriceOye reports from 1 to about 2,800 (electronics only).
- **"Looks like the product"** counts first-page titles that contain the query's model/words, which measures the stores' own ranking, not our filtering (we do not filter). Examples: "air fryer" 40 of 40 on Daraz; "iphone 16" 1 of 40 (Daraz puts cases and cables first), "macbook air m3" 0 of 40 on Daraz and 2 of 24 on PriceOye.
- Ranking moves such matches to the top of each loaded batch; Show more reaches the rest.
### Price check job
- The job re-fetches only tracked listings (wishlisted or with an active alert), at most 60 per run, one request at a time per store. Each listing is re-fetched **by its own store link**, not by searching again: Daraz by item id (the catalog endpoint returns exactly that item), PriceOye by its product page (price, stock and rating from the page's structured data). Fuzzy title matching is used only when a search discovers listings, to group the same product across stores; it plays no part in price updates, so a price can never be taken from a similar-looking product.
- A listing the store no longer shows (item removed, page gone) is counted as "not found" and keeps its last price. **Sample (seeded) listings have no real store link, so the job does not re-fetch them**: they are reported as "unlinked" and stay as sample data until a live search finds the real item and adopts the listing. Real-store titles are noisy (warranty text, screen sizes, marketing words); normalization removes the common noise when grouping search results.
- Demo "simulate" mode changes stored prices randomly; it exists only so alerts and notifications can be demonstrated offline, and its results are not real prices.

### Which price is "the" price
- The price shown as a product's headline (cards, search sort and price filters, wishlist, alerts, price chart summary) is the **retail** price a shopper pays locally (Daraz, PriceOye). AliExpress is listed on every product as the **supplier** price and labelled as such; it excludes shipping and customs, so it is never presented as the "cheapest" or the lowest price. Products with no retail listing fall back to the supplier price.

### Other
- Prices are shown in PKR. AliExpress seed prices were converted from USD at a fixed rate, so they are approximate.
- Email alerts are optional and need SMTP settings. In-app notifications always work.

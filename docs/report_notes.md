# Report notes

Material for the report's design, limitations, and future-work chapters. Updated as the project is built.

## Design decisions
- **Backend kept in Node.js/Express.** The original scraper was written in it. MongoDB (Mongoose) was kept because the existing code already used it.
- **Live sources are Daraz and PriceOye.** Both expose search results without a headless browser: Daraz returns JSON from its catalog endpoint, and PriceOye serves server-rendered HTML. This makes scraping fast (about 1–2 s) and reliable.
- **AliExpress is the supplier source, from saved data only.** There is no live AliExpress scraper: its pages need a headless browser, prices are in USD, and it shows slider captchas to automated clients. Supplier listings and prices are seeded sample data (USD converted to PKR at a configurable rate) and are always labelled "saved".
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

### Search relevance and the "show every match" rule
Stores return loose results, so each scraped title is checked against the query before it is stored. The rules:
- **A product from any one store is a result.** Nothing in search, grouping, caching or browsing requires a second store to carry a product. Products on one store are shown as their own result ("Only on Daraz"), and the compare view lists all three stores with "Not available on this store" for the ones that do not have it.
- **Model numbers must match, in any spelling:** case, spacing, hyphens and word order are ignored and glued forms are split ("15promax" = "15 pro max", "iphone15" = "iphone 15", "s24ultra" = "s24 ultra"). "15 inch" also matches "15.6 inch".
- **Other words** need at least two thirds present; a recognised brand in the query is binding against titles that name a different brand (a Tefal search does not return a Philips), but titles with no recognisable brand (common on Daraz) stay eligible. Equivalent words match ("laptop" ~ "MacBook", "headphones" ~ "headset").
- **Accessory words in the query (cover, case, charger, cable, strap, sleeve, protector, stand, skin ...) are a preference, never a requirement.** The accessory filter is not applied, and titles containing those words rank first. Without an accessory word in the query, accessories are dropped so that "iphone 15" does not return cases.

Pipeline audit for the bug "iphone 15 pro max cover returns nothing" (traced with `scripts/trace-search.js`). Places where a matching product could be lost, and the fix:

| Stage | How a match was lost | Fix |
|---|---|---|
| Store search | Daraz ranks generic covers first for "cover" (0 of 120 results named the phone) but answers "case" with dozens of matches; the query was sent once | Up to 3 phrasings per store (synonyms such as cover/case, strap/band; the family word dropped), tried while fewer than 5 relevant items were found |
| Store search | The matching product sits below the first page (amazfit gts: 0 on page 1, 5 on pages 2-3) | Pages 2 and 3 are read when the previous page was full and results are still thin (at most 4 requests per store) |
| Relevance | Glued model names (15PROMAX, iphone15) did not match "15", "pro", "max" | Normalisation splits glued forms |
| Relevance | Accessory words were treated as required, and accessory titles were filtered out of accessory searches | Accessory words are a ranking preference; the accessory filter only applies to non-accessory queries |
| Relevance | "Levi's" (normalised "levi") did not equal the query "levis" once brand became binding (27 results dropped to 1) | Brand spellings are canonicalised; found by the sweep before release |
| Ingest | Only the first 25 relevant items per store were stored | One full store page (40) is stored |
| Grouping | none: single-store products already become their own product; identical items from different sellers are grouped, and every listing stays visible on the product page | unchanged, covered by tests |
| Local search | The final relevance check ran on the shortened product title, so a product vanished although its store listing matched | A product matches if any of its listing titles does (`altTitles`) |
| Local search | The database pre-filter was stricter than the relevance check ("15 inch" vs "15.6 inch", plural vs singular, equivalent words) | The pre-filter mirrors every tolerance; a property-style test checks it never excludes what the relevance check accepts |
| Local search | Candidate lists were capped at 300 and category browsing sorted after the cap | Cap raised, and browsing sorts in the database before limiting |
| Cache | A search that found nothing was cached as "fresh" for 6 hours, hiding a product that appears later | Empty results are cached for 10 minutes only |
| Time budget | Results already found were discarded when the 10 s budget ran out | Partial results are returned and the store is marked "time budget reached" |

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
Keyword-stuffed listings such as "Mini Pearl Handbag for iPhone 15 Pro Max" matched searches for the phone. For a search that names a model number (and no accessory word), the model number must now appear before "for / compatible with / fits"; titles where it only appears after are treated as accessories. Searches without a model number ("men's sneakers" ~ "Sneakers for Men") are unaffected. A sweep before and after the change differed in 3 of 58 store results, all of them dropped accessory or spam items.

Honest limits: a store that genuinely has no matching product contributes nothing (for "iphone 15 pro max cover" no matching PriceOye product could be found with 3 phrasings, 2 pages and its suggest endpoint, so only Daraz results are shown). Stores that sell only unbranded copies (Ray-Ban) cannot be matched by brand.

### Search sweep (live test of 29 terms)
Full results: `docs/search_sweep.md` (regenerate with `node scripts/search-sweep.js ../docs/search_sweep.md` from `backend/`). The sweep uses the same gather stage as the app. Terms cover the six categories, three non-electronics and six accessory queries (cover, case, charger, sleeve, strap).
- **Reliability:** all 58 term-and-store searches succeeded (no blocks or timeouts).
- **Daraz** returned relevant products for 26 of 29 terms and **PriceOye** for 16 of 29 (PriceOye sells electronics only). 28 of 29 terms returned at least one result from at least one store; the exception, "ray-ban sunglasses", is only sold on Daraz as unbranded copies.
- **Accessory queries:** "iphone 15 pro max cover" 36 Daraz results (found through the "case" phrasing; 0 before the fix), "samsung a15 case" 38 + 1, "airpods pro case" 25 + 9, "iphone 15 charger" 15, "laptop sleeve 15 inch" 26 + 3, "apple watch strap" 9 + 24.
- **Zero results are sometimes correct:** "macbook air m3" and "apple watch series 10" return only cases and straps on Daraz (shown as "no results on this store" rather than wrong matches).
- **Categories:** products are classified from title keywords; items outside the six categories (bed sheet, protein powder) get no category and are found by search but not by category browsing.

### Price check job
- The job re-fetches only tracked listings (wishlisted or with an active alert), at most 60 per run, one request at a time per store. Each listing is re-fetched **by its own store link**, not by searching again: Daraz by item id (the catalog endpoint returns exactly that item), PriceOye by its product page (price, stock and rating from the page's structured data). Fuzzy title matching is used only when a search discovers listings, to group the same product across stores; it plays no part in price updates, so a price can never be taken from a similar-looking product.
- A listing the store no longer shows (item removed, page gone) is counted as "not found" and keeps its last price. **Sample (seeded) listings have no real store link, so the job does not re-fetch them**: they are reported as "unlinked" and stay as sample data until a live search finds the real item and adopts the listing. Real-store titles are noisy (warranty text, screen sizes, marketing words); normalization removes the common noise when grouping search results.
- Demo "simulate" mode changes stored prices randomly; it exists only so alerts and notifications can be demonstrated offline, and its results are not real prices.

### Which price is "the" price
- The price shown as a product's headline (cards, search sort and price filters, wishlist, alerts, price chart summary) is the **retail** price a shopper pays locally (Daraz, PriceOye). AliExpress is listed on every product as the **supplier** price and labelled as such; it excludes shipping and customs, so it is never presented as the "cheapest" or the lowest price. Products with no retail listing fall back to the supplier price.

### Other
- Prices are shown in PKR. AliExpress seed prices were converted from USD at a fixed rate, so they are approximate.
- Email alerts are optional and need SMTP settings. In-app notifications always work.

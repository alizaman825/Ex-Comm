# Report notes

Material for the report's design, limitations, and future-work chapters. Updated as the project is built.

## Design decisions
- **Backend kept in Node.js/Express.** The original scraper was written in it. MongoDB (Mongoose) was kept because the existing code already used it.
- **Live sources are Daraz and PriceOye.** Both expose search results without a headless browser: Daraz returns JSON from its catalog endpoint, and PriceOye serves server-rendered HTML. This makes scraping fast (about 1–2 s) and reliable.
- **AliExpress is the supplier source, from saved data only.** There is no live AliExpress scraper: its pages need a headless browser, prices are in USD, and it shows slider captchas to automated clients. Supplier listings and prices are seeded sample data (USD converted to PKR at a configurable rate) and are always labelled "saved".
- **Seed price history is generated sample data.** The 90 days of daily prices for every sample listing are produced by a deterministic generator (gentle trend, noise, short sales, occasional recent drops), not recorded from the stores. Only prices captured after the app starts (live searches and the price-check job) are real observations. Charts and "price drop" figures built from seed data illustrate the feature and must not be read as real market history.
- **Supplier prices are saved data.** AliExpress prices are derived from retail prices with category-specific discounts, stored with their USD value, and never refreshed by the price-check job.
- **Cache-first search.** Results are stored in the database. Fresh cache (under 6 hours) is served at once; otherwise the stores are scraped live. If scraping fails, stale cache or seed data is shown, and the UI labels where the data came from.

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

### Search sweep (live test of 23 terms)
Full results: `docs/search_sweep.md` (regenerate with `node scripts/search-sweep.js ../docs/search_sweep.md` from `backend/`). Terms covered mobiles, laptops, audio, watches, home appliances, fashion, and three non-electronics (kurta, bed sheet, protein powder).
- **Reliability:** all 46 platform requests succeeded (no blocks or timeouts), about 0.7–2.4 s each.
- **Daraz** returned relevant products for 20 of 23 terms, with images on 100% and ratings on 20–100% (new listings have no reviews yet). It is the only store with results for fashion and other non-electronics.
- **PriceOye** returned relevant products for 10 of 23 terms, all electronics. For non-electronics it returns unrelated phones, which the relevance filter removes. Ratings are often missing for laptops and air conditioners (the site shows none).
- **Loose store search:** both stores pad results with accessories and neighbouring models (Daraz: cases, straps, sleeves; PriceOye: other phones). The relevance filter requires model numbers to match, drops accessories unless asked for, and tolerates spacing variants ("g-shock" ~ "G Shock", "air fryer" ~ "airfryer").
- **Zero results are sometimes correct:** "macbook air m3" and "apple watch series 10" return only cases and straps on Daraz; "ray-ban sunglasses" returns only unbranded "RB" listings with no brand name. These are shown as "no results on this store" rather than wrong matches.
- **Categories:** products are classified from title keywords. Items outside the six categories (bed sheet, protein powder) get no category and are found by search but not by category browsing.
- **Fixes made from the sweep:** spacing/gluing tolerance in relevance, brand terms for the watches category (Amazfit, Garmin, Fitbit), warranty/decimal noise removal in matching.

### Price check job
- The job re-fetches only tracked listings (wishlisted or with an active alert), at most 60 per run, one request at a time per store. Each listing is re-fetched **by its own store link**, not by searching again: Daraz by item id (the catalog endpoint returns exactly that item), PriceOye by its product page (price, stock and rating from the page's structured data). Fuzzy title matching is used only when a search discovers listings, to group the same product across stores; it plays no part in price updates, so a price can never be taken from a similar-looking product.
- A listing the store no longer shows (item removed, page gone) is counted as "not found" and keeps its last price. **Sample (seeded) listings have no real store link, so the job does not re-fetch them**: they are reported as "unlinked" and stay as sample data until a live search finds the real item and adopts the listing. Real-store titles are noisy (warranty text, screen sizes, marketing words); normalization removes the common noise when grouping search results.
- Demo "simulate" mode changes stored prices randomly; it exists only so alerts and notifications can be demonstrated offline, and its results are not real prices.

### Other
- Prices are shown in PKR. AliExpress seed prices were converted from USD at a fixed rate, so they are approximate.
- Email alerts are optional and need SMTP settings. In-app notifications always work.

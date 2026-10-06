# Report notes

Material for the report's design, limitations, and future-work chapters. Updated as the project is built.

## Design decisions
- **Backend kept in Node.js/Express.** The original scraper was written in it. MongoDB (Mongoose) was kept because the existing code already used it.
- **Live sources are Daraz and PriceOye.** Both expose search results without a headless browser: Daraz returns JSON from its catalog endpoint, and PriceOye serves server-rendered HTML. This makes scraping fast (about 1–2 s) and reliable.
- **AliExpress is the supplier source and best-effort.** Its pages need a headless browser, prices are in USD, and it often shows a slider captcha to automated clients. The seed data includes AliExpress listings so the comparison view still shows three stores.
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

### Price check job
- The job re-scrapes only tracked listings (wishlisted or with an active alert), at most 60 per run, one request at a time per store. A listing is found again by exact store id, otherwise by fuzzy title match; if the store no longer shows a matching offer it is counted as "not found" and keeps its last price.
- Real-store titles are noisy (warranty text, screen sizes, marketing words). Normalization removes the common noise, but some products are still not re-found. In a live run on the sample wishlist (12 listings) 6 prices were updated and 6 listings were not found.
- Demo "simulate" mode changes stored prices randomly; it exists only so alerts and notifications can be demonstrated offline, and its results are not real prices.

### Other
- Prices are shown in PKR. AliExpress seed prices were converted from USD at a fixed rate, so they are approximate.
- Email alerts are optional and need SMTP settings. In-app notifications always work.

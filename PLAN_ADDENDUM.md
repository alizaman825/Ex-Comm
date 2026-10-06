# PLAN ADDENDUM: Ex-Comm scope update

## Positioning
Primary users: online sellers / dropshippers. Secondary users: regular shoppers.
Core idea: compare supplier prices (AliExpress) against local retail prices (Daraz, PriceOye) and estimate profit margins.

## Priority tiers (build in this order; cut from the bottom if time runs short)

### MUST (core product)
- Auth, search, product detail with price history chart, compare view, wishlist, price alerts, notifications (already in PLAN.md)
- Categories page + category filter on search (Mobiles, Laptops, Audio, Watches, Home Appliances, Fashion) using keyword presets
- Seed data: 6 categories, about 15 products each, with price history, matched across stores where possible
- Popular/trending searches on the home page, served from cache
- DEMO_MODE and cache fallback (already in PLAN.md)

### SHOULD (seller module)
- Margin calculator: supplier price (USD, converted to PKR via configurable exchange rate) plus adjustable shipping, customs and platform fee, compared to the local selling price; show profit, margin % and the assumptions used
- Opportunities page: products ranked by estimated margin, filterable by category
- Alerts extension: notify on supplier price drop or when estimated margin exceeds the user's target
- AliExpress is the supplier source: live scraping best-effort, strong seeded/cached supplier data so the module works fully in DEMO_MODE, with listings labeled "live" or "saved"

### NICE (only after the end-to-end checkpoint)
- Landing page polish: GSAP ScrollTrigger animations; one hero section that scrubs a frame sequence or 3D model on scroll (asset supplied by me in frontend/public/hero/); lazy-load assets; static fallback for prefers-reduced-motion and slow devices. Landing page only, never on functional pages.
- A third easy-to-scrape Pakistani store for non-electronics, if the investigation shows it is cheap to add.

## Out of scope
Inventory, orders, store integrations (Shopify etc.), automated supplier ordering, payments, admin panel.

## Testing requirement
Before the backend checkpoint, test at least 15 varied search terms across categories (including non-electronics like "air fryer" and "men's sneakers"), report which work on each platform, and fix per-category field parsing.

## Docs requirement
Update docs/requirements.md, use_cases.md, erd.dbml and report_notes.md to reflect the seller module. In report_notes.md, record these limitations: margin figures are estimates; supplier data may be saved data; cross-store matching is fuzzy with manual fallback; cross-platform comparison is strongest in electronics.

## Process
Revise PLAN.md's task list and time estimates to include MUST and SHOULD items, with NICE items listed last. Report the revised total hours before continuing.
# Software Requirements — Ex-Comm Price Comparison Platform

_Version 1.0 — 2026-10-07. Derived from the approved plan (`docs/PLAN.md`)._

## 1. Scope

Ex-Comm lets shoppers in Pakistan search one product across several online stores, compare prices side by side, follow price changes over time, keep a wishlist, and get a notification when a price drops to their target.

- **Live data sources:** Daraz (daraz.pk) and PriceOye (priceoye.pk).
- **Optional source:** AliExpress (aliexpress.com). It is in the sample (seed) data and gets a live adapter only if time allows.
- **Out of scope:** admin panel, analytics dashboards, payments, ordering, and checkout.

**Actors**

| Actor | Description |
|---|---|
| Visitor | Not signed in. Can search, filter, compare, and view products. |
| Registered user | Signed in. Can do everything a visitor can, plus use the wishlist, alerts, notifications, and profile. |
| Scheduler (system) | Timed job that re-checks prices of tracked products and raises alerts. |
| E-commerce platform (external) | Daraz, PriceOye, and AliExpress websites that supply product data. |

## 2. Functional requirements

### 2.1 Account and authentication
| ID | Requirement |
|---|---|
| FR-01 | The system shall let a visitor register with name, email, and password (minimum 8 characters). Each email may be used for only one account. |
| FR-02 | The system shall let a registered user log in with email and password and keep them signed in with a secure session. |
| FR-03 | The system shall let a signed-in user log out, which ends the session. |
| FR-04 | The system shall let a signed-in user view and update their profile (name, email-alert preference). |
| FR-05 | The system shall let a signed-in user change their password after confirming the current one. |
| FR-06 | The system shall let a signed-in user delete their account after confirming their password. The account's wishlist, alerts, and notifications are deleted with it. |

### 2.2 Search
| ID | Requirement |
|---|---|
| FR-07 | The system shall let any user search products by keyword across all supported platforms at once. |
| FR-08 | The system shall let the user filter results by platform. |
| FR-09 | The system shall let the user filter results by price range (minimum and maximum, PKR). |
| FR-10 | The system shall let the user filter results by minimum customer rating. |
| FR-11 | The system shall let the user sort results by relevance, lowest price, highest price, or rating. |
| FR-12 | The system shall paginate search results. |
| FR-13 | The system shall show where results came from (live, cached, or sample data) and when they were last updated. |

| FR-34 | The system shall organise products into six categories (Mobiles, Laptops, Audio, Watches, Home Appliances, Fashion), let the user browse a category and filter search results by category, and show preset searches per category. |
| FR-35 | The system shall show popular (trending) searches on the home page, based on how often queries were searched. |

### 2.3 Products and comparison
| ID | Requirement |
|---|---|
| FR-14 | The system shall show a product detail page listing each platform's price, original price, discount, rating, review count, stock status, and a link to the store page. |
| FR-15 | The system shall show a price-history chart per platform on the product detail page, with a selectable range (7, 30, or 90 days). |
| FR-16 | The system shall show the same product from different platforms side by side and highlight the lowest price. |
| FR-17 | The system shall group listings of the same product from different platforms using title normalization and fuzzy matching. |
| FR-18 | The system shall let the user pick products manually for comparison when automatic matching did not group them. |
| FR-19 | The home page shall show trending products and the biggest current price drops. |

### 2.4 Wishlist
| ID | Requirement |
|---|---|
| FR-20 | The system shall let a signed-in user add a product to their wishlist. |
| FR-21 | The system shall let a signed-in user remove a product from their wishlist. |
| FR-22 | The system shall let a signed-in user view their wishlist with each product's current lowest price. |

### 2.5 Price alerts and notifications
| ID | Requirement |
|---|---|
| FR-23 | The system shall let a signed-in user create a price alert for a product with a target price, for any platform or one chosen platform. |
| FR-24 | The system shall let a signed-in user view, edit, pause, resume, and delete their price alerts. |
| FR-25 | A scheduled job shall regularly re-scrape products that have active alerts or are on a wishlist, and store each new price in the price history. |
| FR-25a | A protected endpoint (job key) shall let the operator run the price check on demand; a demo "simulate" mode shall apply small random price changes to tracked listings instead of scraping, so alerts can be shown without internet access. Each run shall be recorded (duration, prices changed, alerts triggered, failures). |
| FR-26 | When a tracked price is at or below an alert's target, the system shall create an in-app notification. The same alert shall not notify again for 24 hours. |
| FR-27 | The system shall show the user's notifications, an unread count, and let the user mark one or all as read. |
| FR-28 | If the user has enabled email alerts and email is configured, the system shall also send the notification by email (optional). |

### 2.6 Data collection and reliability
| ID | Requirement |
|---|---|
| FR-29 | The system shall collect product data (title, price, original price, rating, reviews, image, URL, stock) from Daraz and PriceOye by scraping their public search pages. |
| FR-30 | The system shall cache search results in the database and serve fresh cached results (less than 6 hours old) without scraping again. |
| FR-31 | If a live scrape fails or times out, the system shall serve the most recent cached results, or sample data if there is no cache, instead of an error. |
| FR-32 | The system shall provide a seed script that loads realistic sample products, listings on three platforms, and 90 days of price history. |
| FR-33 | The system shall log every scrape attempt (platform, query, status, item count, duration, error). |

## 3. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Security | Passwords shall be hashed with bcrypt. Password hashes shall never be returned by any API response. |
| NFR-02 | Security | Sessions shall use signed JWTs stored in an httpOnly, SameSite cookie. Every route that reads or changes user data shall require authentication. |
| NFR-03 | Security | The API shall set secure HTTP headers (Helmet), restrict CORS to the frontend origin, and validate all input. |
| NFR-04 | Security | Login and registration shall be rate-limited (10 requests per 15 minutes per IP). The rest of the API shall be limited to 300 requests per 15 minutes per IP. |
| NFR-05 | Security | No secrets (database URI, JWT secret, SMTP credentials) shall be stored in the source repository. |
| NFR-06 | Performance | Search served from cache shall respond in under 1 second. A live search shall finish within 10 seconds, or fall back to cached data. |
| NFR-07 | Performance | Each platform scraper shall time out after 8 seconds per request. |
| NFR-08 | Reliability | Failure of one platform shall not prevent results from the other platforms being shown. |
| NFR-09 | Reliability | A demo mode (`DEMO_MODE=true`) shall serve cached and sample data only, so the app works without internet access to the stores. |
| NFR-10 | Scraping etiquette | Scrapers shall wait a random 1.5–3 seconds between requests to the same platform, run one request at a time per platform, and stop calling a platform for 10 minutes after 3 consecutive failures (circuit breaker). |
| NFR-11 | Usability | The UI shall be responsive from 360 px phone width to desktop, and use one consistent design system (palette, typography, spacing). |
| NFR-12 | Usability | Every page shall show a loading state, an empty state, and an error state with a retry option where data is fetched. |
| NFR-13 | Maintainability | The backend shall use a layered structure (routes, controllers, services, models). Each platform shall be a separate scraper adapter with a common interface. |
| NFR-14 | Testability | Automated tests shall cover the API and scraper parsers. Parser tests shall run offline against saved fixtures. Tests shall never use the production database. |
| NFR-15 | Portability | All configuration shall come from environment variables. The app shall run on Windows, macOS, and Linux with Node.js 20 or later. |
| NFR-16 | Compatibility | The frontend shall work in current versions of Chrome, Edge, and Firefox. |

# Use Cases — Ex-Comm

_Version 1.0 — 2026-10-07. Requirement IDs refer to `docs/requirements.md`._

**Actors:** Visitor, Registered User (a Visitor who has signed in), Scheduler (system), E-commerce Platform (external: Daraz, PriceOye, AliExpress).

| ID | Use case | Primary actor | Requirements |
|---|---|---|---|
| UC-01 | Register | Visitor | FR-01 |
| UC-02 | Log in | Visitor | FR-02 |
| UC-03 | Log out | Registered User | FR-03 |
| UC-04 | Manage profile | Registered User | FR-04, FR-05, FR-06 |
| UC-05 | Search products | Visitor | FR-07, FR-12, FR-13, FR-29–FR-31 |
| UC-06 | Filter and sort results | Visitor | FR-08–FR-11 |
| UC-07 | View product detail and price history | Visitor | FR-14, FR-15 |
| UC-08 | Compare products across platforms | Visitor | FR-16–FR-18 |
| UC-09 | Add product to wishlist | Registered User | FR-20 |
| UC-10 | View and manage wishlist | Registered User | FR-21, FR-22 |
| UC-11 | Create price alert | Registered User | FR-23 |
| UC-12 | Manage price alerts | Registered User | FR-24 |
| UC-13 | View notifications | Registered User | FR-27, FR-28 |
| UC-14 | Run scheduled price check | Scheduler | FR-25, FR-26, FR-33 |

---

## UC-01 Register

| Field | Detail |
|---|---|
| **Use Case Title** | Register |
| **Use Case ID** | UC-01 |
| **Requirement ID** | FR-01 |
| **Description** | A visitor creates an account so they can use the wishlist, price alerts, and notifications. |
| **Pre-conditions** | The visitor is not signed in. The system is online. |

| Task Sequence | Exceptions |
|---|---|
| 1. Visitor opens the Register page. | |
| 2. Visitor enters name, email, and password. | 2a. A field is empty or invalid (name under 2 characters, malformed email, password under 8 characters): the system shows a message next to the field. |
| 3. Visitor submits the form. | 3a. Too many attempts from this device: the system asks the visitor to try again later. |
| 4. System checks that the email is not already registered. | 4a. Email already registered: the system shows "An account with this email already exists" and offers a link to Log in. |
| 5. System stores the account with a hashed password and starts a session. | 5a. Database unavailable: the system shows an error and the visitor can retry. |
| 6. System redirects the user to the home page, signed in. | |

| **Post-conditions** | A new user account exists and the user is signed in. |
|---|---|

---

## UC-02 Log in

| Field | Detail |
|---|---|
| **Use Case Title** | Log in |
| **Use Case ID** | UC-02 |
| **Requirement ID** | FR-02 |
| **Description** | A registered user signs in with email and password. |
| **Pre-conditions** | The user has an account and is not signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. User opens the Login page (directly or after trying a protected action). | |
| 2. User enters email and password and submits. | 2a. A field is empty or the email is malformed: the system shows a validation message. |
| 3. System verifies the credentials. | 3a. Email or password is wrong: the system shows "Invalid email or password" without saying which one. |
| | 3b. Too many attempts from this device: the system blocks further attempts for 15 minutes. |
| 4. System creates a session (httpOnly cookie). | |
| 5. System returns the user to the page they came from, or the home page. | |

| **Post-conditions** | The user is signed in and can access protected features. |
|---|---|

---

## UC-03 Log out

| Field | Detail |
|---|---|
| **Use Case Title** | Log out |
| **Use Case ID** | UC-03 |
| **Requirement ID** | FR-03 |
| **Description** | A signed-in user ends their session. |
| **Pre-conditions** | The user is signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. User selects "Log out" from the account menu. | |
| 2. System clears the session cookie. | 2a. The session had already expired: the system treats the user as logged out. |
| 3. System shows the home page in signed-out state. | |

| **Post-conditions** | The session has ended; protected pages redirect to Login. |
|---|---|

---

## UC-04 Manage profile

| Field | Detail |
|---|---|
| **Use Case Title** | Manage profile |
| **Use Case ID** | UC-04 |
| **Requirement ID** | FR-04, FR-05, FR-06 |
| **Description** | A user updates their name and email-alert preference, changes their password, or deletes their account. |
| **Pre-conditions** | The user is signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. User opens Profile / Settings. | 1a. Session expired: the system redirects to Login (UC-02). |
| 2. System shows the current name, email, and email-alert setting. | |
| 3. User edits name or toggles email alerts and saves. | 3a. Name is invalid: the system shows a validation message. |
| 4. System saves the changes and confirms. | |
| 5. (Optional) User enters current and new password and saves. | 5a. Current password wrong: the system shows "Current password is incorrect". |
| | 5b. New password under 8 characters: the system shows a validation message. |
| 6. (Optional) User chooses "Delete account" and confirms with their password. | 6a. Password wrong: the account is not deleted. |
| 7. System deletes the account and related data and logs the user out. | |

| **Post-conditions** | Profile changes are saved, or the account and its data are removed. |
|---|---|

---

## UC-05 Search products

| Field | Detail |
|---|---|
| **Use Case Title** | Search products |
| **Use Case ID** | UC-05 |
| **Requirement ID** | FR-07, FR-12, FR-13, FR-29, FR-30, FR-31 |
| **Description** | A visitor searches for a product by keyword and sees matching products from all platforms, grouped by product. |
| **Pre-conditions** | None (sign-in not required). |

| Task Sequence | Exceptions |
|---|---|
| 1. Visitor enters a keyword in the search bar and submits. | 1a. Keyword is empty or under 2 characters: the system asks for a longer keyword. |
| 2. System checks the cache for recent results (less than 6 hours old). | 2a. Fresh cache found: skip to step 5 with source "cache". |
| 3. System requests results from each platform (Daraz, PriceOye) in parallel, with a time limit. | 3a. One platform fails or times out: results from the others are still shown and the failed platform is marked. |
| | 3b. All platforms fail: the system shows the latest cached results, or sample data, labelled as such. |
| 4. System saves listings, groups the same product across platforms, records prices, and updates the cache. | |
| 5. System shows result cards with image, title, lowest price, platform badges, and rating, plus where the data came from and when. | 5a. No results: the system shows an empty state with search suggestions. |
| 6. Visitor moves between result pages. | |

| **Post-conditions** | Results are shown, and listings, price history, and cache are updated in the database. |
|---|---|

---

## UC-06 Filter and sort results

| Field | Detail |
|---|---|
| **Use Case Title** | Filter and sort results |
| **Use Case ID** | UC-06 |
| **Requirement ID** | FR-08, FR-09, FR-10, FR-11 |
| **Description** | A visitor narrows search results by platform, price range, and rating, and changes the sort order. |
| **Pre-conditions** | Search results are displayed (UC-05). |

| Task Sequence | Exceptions |
|---|---|
| 1. Visitor selects one or more platforms. | |
| 2. Visitor enters a minimum and/or maximum price. | 2a. Minimum is greater than maximum: the system shows a validation message and does not apply the filter. |
| 3. Visitor selects a minimum rating. | |
| 4. Visitor selects a sort order (relevance, price low→high, price high→low, rating). | |
| 5. System updates the results and the page URL (so the view can be shared or bookmarked). | 5a. No result matches: the system shows an empty state with a "Clear filters" button. |

| **Post-conditions** | The displayed results match the chosen filters and sort order. |
|---|---|

---

## UC-07 View product detail and price history

| Field | Detail |
|---|---|
| **Use Case Title** | View product detail and price history |
| **Use Case ID** | UC-07 |
| **Requirement ID** | FR-14, FR-15 |
| **Description** | A visitor opens a product to see its price on every platform and how prices changed over time. |
| **Pre-conditions** | The product exists (reached from search, home, wishlist, alert, or notification). |

| Task Sequence | Exceptions |
|---|---|
| 1. Visitor selects a product. | 1a. Product does not exist: the system shows a "Product not found" page. |
| 2. System shows the product image, title, and a table of platform listings (price, original price, discount, rating, reviews, stock, last updated), with the lowest price highlighted. | |
| 3. System shows a price-history chart with one line per platform for the last 30 days. | 3a. No history yet: the chart shows an empty state. |
| 4. Visitor changes the range (7, 30, or 90 days). | |
| 5. Visitor selects "Go to store" for a listing. | 5a. The store link opens in a new tab. |
| 6. (Optional) Visitor adds the product to the wishlist (UC-09) or creates an alert (UC-11). | 6a. Not signed in: the system asks the visitor to log in first. |

| **Post-conditions** | None (read-only). |
|---|---|

---

## UC-08 Compare products across platforms

| Field | Detail |
|---|---|
| **Use Case Title** | Compare products across platforms |
| **Use Case ID** | UC-08 |
| **Requirement ID** | FR-16, FR-17, FR-18 |
| **Description** | A visitor compares the same product on different platforms, or up to four manually chosen products, side by side. |
| **Pre-conditions** | At least one product is available. |

| Task Sequence | Exceptions |
|---|---|
| 1. Visitor selects "Compare" on a product (automatic match) or ticks products in search results (manual selection). | 1a. More than 4 products selected: the system asks the visitor to remove one. |
| 2. System shows a column per platform listing (or per chosen product) with price, original price, discount, rating, reviews, stock, and store link. | 2a. A product has a listing on only one platform: the system says so and suggests manual comparison. |
| 3. System highlights the lowest price and the best rating. | |
| 4. Visitor removes or adds a product in the comparison. | |

| **Post-conditions** | None (read-only). |
|---|---|

---

## UC-09 Add product to wishlist

| Field | Detail |
|---|---|
| **Use Case Title** | Add product to wishlist |
| **Use Case ID** | UC-09 |
| **Requirement ID** | FR-20 |
| **Description** | A user saves a product to their wishlist so its price is tracked. |
| **Pre-conditions** | The user is signed in and viewing a product or a result card. |

| Task Sequence | Exceptions |
|---|---|
| 1. User selects the heart / "Add to wishlist" button. | 1a. Not signed in: the system redirects to Login and returns afterwards. |
| 2. System saves the product to the user's wishlist. | 2a. Already in the wishlist: the system keeps one entry and shows it as saved. |
| 3. System shows the button as "Saved" and a confirmation message. | 3a. Request fails: the system shows an error and the button returns to its previous state. |

| **Post-conditions** | The product is in the user's wishlist and is tracked by the scheduled price check. |
|---|---|

---

## UC-10 View and manage wishlist

| Field | Detail |
|---|---|
| **Use Case Title** | View and manage wishlist |
| **Use Case ID** | UC-10 |
| **Requirement ID** | FR-21, FR-22 |
| **Description** | A user views saved products with current lowest prices and removes products. |
| **Pre-conditions** | The user is signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. User opens the Wishlist page. | |
| 2. System shows saved products with image, title, current lowest price, platform, and price change since saving. | 2a. Wishlist is empty: the system shows an empty state with a link to search. |
| 3. User selects "Remove" on a product. | |
| 4. System removes the product and updates the list. | 4a. Request fails: the system shows an error and keeps the item. |
| 5. (Optional) User selects a product to view it (UC-07) or sets an alert (UC-11). | |

| **Post-conditions** | The wishlist reflects the user's changes. |
|---|---|

---

## UC-11 Create price alert

| Field | Detail |
|---|---|
| **Use Case Title** | Create price alert |
| **Use Case ID** | UC-11 |
| **Requirement ID** | FR-23 |
| **Description** | A user sets a target price for a product to be notified when the price drops to it. |
| **Pre-conditions** | The user is signed in and viewing a product (or the Alerts page). |

| Task Sequence | Exceptions |
|---|---|
| 1. User selects "Set price alert". | 1a. Not signed in: the system redirects to Login. |
| 2. System shows the current lowest price and suggests a target 10% below it. | |
| 3. User enters a target price and optionally picks one platform (default: any). | 3a. Target is empty, zero, or negative: the system shows a validation message. |
| 4. User saves the alert. | 4a. An active alert already exists for this product and platform: the system updates its target instead of creating a duplicate. |
| 5. System saves the alert as active and confirms. | 5a. The current price is already at or below the target: the system creates a notification straight away. |

| **Post-conditions** | An active alert exists and the product is tracked by the scheduled price check. |
|---|---|

---

## UC-12 Manage price alerts

| Field | Detail |
|---|---|
| **Use Case Title** | Manage price alerts |
| **Use Case ID** | UC-12 |
| **Requirement ID** | FR-24 |
| **Description** | A user views alerts and edits, pauses, resumes, or deletes them. |
| **Pre-conditions** | The user is signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. User opens the Alerts page. | |
| 2. System lists alerts with product, target price, current lowest price, platform, status, and last triggered time. | 2a. No alerts: the system shows an empty state explaining how to create one. |
| 3. User edits a target price, or pauses/resumes an alert. | 3a. Invalid target: the system shows a validation message. |
| 4. User deletes an alert and confirms. | |
| 5. System saves the change and updates the list. | 5a. Request fails: the system shows an error and keeps the previous state. |

| **Post-conditions** | Alerts reflect the user's changes; paused alerts are skipped by the price check. |
|---|---|

---

## UC-13 View notifications

| Field | Detail |
|---|---|
| **Use Case Title** | View notifications |
| **Use Case ID** | UC-13 |
| **Requirement ID** | FR-27, FR-28 |
| **Description** | A user reads price-drop notifications and marks them as read. |
| **Pre-conditions** | The user is signed in. |

| Task Sequence | Exceptions |
|---|---|
| 1. System shows the unread count on the bell icon in the navigation bar. | |
| 2. User opens the Notifications page. | |
| 3. System lists notifications, newest first, with message, product, price, platform, and time; unread ones are highlighted. | 3a. No notifications: the system shows an empty state. |
| 4. User selects a notification. | |
| 5. System marks it as read and opens the product (UC-07). | |
| 6. (Optional) User selects "Mark all as read". | 6a. Request fails: the system shows an error. |

| **Post-conditions** | Selected notifications are marked as read and the unread count is updated. |
|---|---|

---

## UC-14 Run scheduled price check

| Field | Detail |
|---|---|
| **Use Case Title** | Run scheduled price check |
| **Use Case ID** | UC-14 |
| **Requirement ID** | FR-25, FR-26, FR-28, FR-33 |
| **Description** | At a fixed interval, the system re-scrapes tracked products, stores new prices, and notifies users whose alert targets are met. |
| **Pre-conditions** | The scheduler is enabled. At least one product is on a wishlist or has an active alert. |

| Task Sequence | Exceptions |
|---|---|
| 1. Scheduler starts the price-check job (every 6 hours, or manually for the demo). | 1a. A previous run is still in progress: the new run is skipped. |
| 2. System collects products that are wishlisted or have active alerts. | 2a. No tracked products: the job ends and is logged. |
| 3. For each listing, system re-fetches the current price from its stored store link / item id, one at a time with polite delays. | 3a. The platform fails or the circuit breaker is open: the listing keeps its last price and the failure is logged. |
| | 3b. Demo mode is on: the system skips live scraping. |
| 4. System saves the new price to the listing and to the price history. | |
| 5. For each active alert, system compares the lowest matching price with the target. | |
| 6. If price ≤ target and the alert has not triggered in the last 24 hours, system creates a notification and records the trigger time. | 6a. User enabled email alerts and email is configured: an email is also sent. If sending fails, the in-app notification still exists. |
| 7. System logs the run (products checked, prices changed, alerts triggered, duration). | |

| **Post-conditions** | Price history is extended, product prices are up to date, and notifications exist for met targets. |
|---|---|

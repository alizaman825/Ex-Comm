# Proposal: separating "saved supplier reference" from "live scrape" (Step C)

Status: **proposal only — nothing in this PR changes the schema, the data, or any
running code.** It is here for ali to review and pick an option (or ask for changes)
before any implementation PR is opened.

## The problem

`Listing` has two fields that look like they already answer "is this real, live
data?":

```js
seeded: { type: Boolean, default: false },              // true = sample data, not scraped
dataSource: { type: String, enum: ['live', 'saved'], default: 'live' },
```

In practice every *newly ingested* listing — regardless of how it was produced —
gets `seeded: false, dataSource: 'live'`. That pair is set in exactly one shared
place, `ingestListings()` in `backend/src/services/ingest.js`, which is called by
four different code paths:

| Call site | What it is |
|---|---|
| `jobs/catalogSync.js` | continuously scheduled Daraz/PriceOye catalog refresh |
| `jobs/priceCheck.js` | continuously scheduled Daraz/PriceOye price re-check |
| `services/ebayCheck.js` | one-off, user-triggered "Check on eBay" (official API) |
| `services/aliexpressCheck.js` | one-off, user-triggered "Check on AliExpress" |

So a Daraz listing refreshed every few hours by the scheduled job, and an
AliExpress listing written once because a visitor clicked "Check on AliExpress"
three weeks ago, carry the identical `seeded: false, dataSource: 'live'` pair.
Nothing in the stored data says one is a standing live feed and the other is a
one-time snapshot.

This mostly doesn't affect what shoppers see — `priceStatus.js` already
special-cases AliExpress (`platform === 'aliexpress'` → always `saved_reference`,
never trustworthy for cheapest/deals/alerts) by reading the platform, not a stored
flag. The gap shows up for anyone reading the *data itself*: the data-truth report,
an admin export, or a future report that tries to say "how much of this listing
set is actively, continuously checked vs. a one-off supplier lookup" has no field
to group on, and `seeded`/`dataSource` actively mislead if taken at face value
(they say "live" for both).

## Option A — a new `checkTrigger` field (recommended)

Add one field to `Listing`:

```js
checkTrigger: { type: String, enum: ['scheduled', 'on_demand'], required: true },
```

Set explicitly at every write site (no default, so a call site can't forget it
silently):
- `jobs/catalogSync.js`, `jobs/priceCheck.js` → `'scheduled'`
- `services/ebayCheck.js`, `services/aliexpressCheck.js` → `'on_demand'`
- `seed/seed.js` → `'scheduled'` for the seeded "live-looking" retail rows it
  already marks `seeded: true`, or omit/leave unset if seed data should stay
  outside this classification entirely (ali's call)

`ingestListings(listings, { checkTrigger })` would take the trigger as a required
option instead of inferring anything, so the four call sites each pass their own
literal and nothing is guessed.

Existing listings would need a one-time backfill (same dry-run-then-apply pattern
as `fix-aliexpress-import-source.js`): infer `scheduled` for daraz/priceoye,
`on_demand` for aliexpress/ebay, by platform — since today, in practice, that split
happens to be exactly the historical truth (Daraz/PriceOye have only ever been hit
by the scheduled jobs; eBay/AliExpress have only ever been hit by the on-demand
checks). **Not run as part of this PR** — only proposed here, same as the field
itself.

Pros: explicit, queryable, survives a future where e.g. eBay gets a scheduled job
of its own (role/platform alone could no longer be used to infer it). Cons: a
schema change + a backfill, i.e. exactly the kind of "schema/data change" that
needs ali's sign-off under the Phase 1 branching rule.

## Option B — a rule, no schema change

Don't store anything new. Add a small pure function next to `priceStatus.js`:

```js
// backend/src/services/checkTrigger.js
function checkTriggerOf(listing) {
  return listing.platform === 'daraz' || listing.platform === 'priceoye'
    ? 'scheduled'
    : 'on_demand'; // aliexpress, ebay
}
```

Anywhere that wants to show or report the distinction (a reports/admin view, the
data-truth report script) calls this instead of reading a field. Zero migration,
zero schema change, ships as an ordinary logic PR under the existing branching
rule (no approval needed).

Pros: no data change, no risk, done in one small PR. Cons: it's a platform-level
rule, not a per-listing fact — it would be silently wrong the day any platform is
checked both ways (e.g. if PriceOye ever got an on-demand "check now" button, or
eBay ever got a scheduled job). Today that doesn't happen, so the rule is accurate,
but it's worth ali knowing that assumption is baked in rather than recorded.

## Option C — reuse/extend `role` instead of a new field

Change `role`'s enum from `['retail', 'supplier']` to add a third value, e.g.
`'retail_on_demand'`, and set it at the same four call sites. Rejected as the
recommendation: `role` is already used by the frontend and by `fullListing()`/
`toCard()` to mean "is this a normal retail offer or a supplier reference" (a
pricing/display distinction), and overloading it with a second, unrelated
meaning (how the data was produced) would make both harder to reason about later.
A separate field (Option A) keeps the two concerns apart.

## Recommendation

Option A if ali is fine with a small schema addition + a reviewed, dry-run-first
backfill (same pattern already used for the AliExpress import-source fix).
Option B if ali would rather avoid any data change at all right now — it is
strictly weaker (a rule instead of a recorded fact) but ships with no approval
needed and no risk, and can always be upgraded to Option A later without losing
anything, since the rule and the field would agree on every record that exists
today.

No code or data has been changed to produce this document. Nothing here is wired
into the app; it's for ali to pick from (or reject) before any implementation PR.

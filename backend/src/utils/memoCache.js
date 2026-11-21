// Phase 2 Part E (E6): a tiny in-process, short-TTL memo for read-mostly, low-personalization endpoints
// (home page rails, category/platform lists). It never changes what's INSIDE a cached response - every
// field such as lastScrapedAt/fetchedAt is computed once, by the real controller logic, and simply
// replayed verbatim for the rest of the TTL window, so a cache hit can never make a price or "checked X
// ago" label look fresher than it actually was at that moment (hard limit 8). It only saves the repeated
// database work of recomputing the identical response for a burst of near-simultaneous requests.
//
// Deliberately NOT a replacement for SearchCache (the Mongo-backed, cross-restart cache used by search):
// this is a process-local fast path on top of already-fast DB reads, and is expected to be empty again
// after every Render cold start - which is fine, since its whole job is smoothing out a few seconds of
// traffic, not surviving a restart.
const store = new Map(); // key -> { value, expiresAt }

/**
 * Returns the cached value for `key` if it hasn't expired, otherwise calls `load()`, caches the result
 * for `ttlMs` and returns it. Concurrent calls for the same key while nothing is cached yet share one
 * in-flight `load()` call instead of each repeating it.
 */
async function memoize(key, ttlMs, load) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.promise;
  const promise = Promise.resolve().then(load);
  store.set(key, { promise, expiresAt: now + ttlMs });
  try {
    return await promise;
  } catch (err) {
    store.delete(key); // never cache a failure
    throw err;
  }
}

function clearMemoCache() {
  store.clear();
}

module.exports = { memoize, clearMemoCache };

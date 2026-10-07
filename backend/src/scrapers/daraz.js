// Daraz adapter: the catalog page returns JSON when called with ajax=true (no browser needed).
const http = require('./http');

const { ScrapeError } = http;
const { parsePrice, parseNumber, parseRating, absoluteUrl } = require('./parse');

const BASE = 'https://www.daraz.pk';

function searchUrl(query, page = 1) {
  return `${BASE}/catalog/?ajax=true&page=${page}&q=${encodeURIComponent(query)}`;
}

// Parses the catalog JSON into normalized listings.
function parse(json) {
  if (!json || typeof json !== 'object' || !json.mods) {
    throw new ScrapeError('Unexpected Daraz response (possible captcha or layout change)', { code: 'BLOCKED' });
  }
  const items = Array.isArray(json.mods.listItems) ? json.mods.listItems : [];
  return items
    .map((it) => {
      const price = parsePrice(it.price ?? it.priceShow);
      if (!price || !it.name || !(it.itemId || it.nid)) return null;
      const originalPrice = parsePrice(it.originalPrice);
      return {
        platform: 'daraz',
        externalId: String(it.itemId || it.nid),
        title: String(it.name).trim(),
        url: absoluteUrl(it.itemUrl || it.productUrl, BASE) || `${BASE}/products/-i${it.itemId}.html`,
        image: it.image || null,
        price,
        originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
        currency: 'PKR',
        rating: parseRating(it.ratingScore),
        reviewCount: parseNumber(it.review) || 0,
        inStock: it.inStock !== false,
        brand: it.brandName && it.brandName !== 'No Brand' ? it.brandName : null,
        sponsored: Boolean(it.isSponsored),
      };
    })
    .filter(Boolean);
}

async function search(query, { page = 1 } = {}) {
  const res = await http.get(searchUrl(query, page), { headers: { Accept: 'application/json' } });
  let body = res.data;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      throw new ScrapeError('Daraz returned HTML instead of JSON (possible captcha)', { code: 'BLOCKED' });
    }
  }
  return parse(body);
}

// Item id of a stored listing: the numeric externalId, or the "-i<id>.html" part of its product URL.
// Sample (seeded) listings have neither, so they cannot be re-fetched.
function itemIdOf(listing) {
  if (/^[0-9]+$/.test(String(listing.externalId || ''))) return String(listing.externalId);
  const m = String(listing.url || '').match(/-i([0-9]+)[.]html/);
  return m ? m[1] : null;
}

const canRefetch = (listing) => Boolean(itemIdOf(listing));

// Re-fetch one stored listing by its item id (Daraz's catalog endpoint returns exactly that item when
// queried with the id). Resolves to the fresh listing, or null if the item is no longer listed.
async function fetchListing(listing) {
  const id = itemIdOf(listing);
  if (!id) throw new ScrapeError('Listing is not linked to a Daraz item', { code: 'UNLINKED' });
  const items = await search(id);
  return items.find((i) => i.externalId === id) || null;
}

module.exports = { name: 'daraz', label: 'Daraz', search, parse, searchUrl, fetchListing, canRefetch, itemIdOf };

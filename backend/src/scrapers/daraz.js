// Daraz adapter: the catalog page returns JSON when called with ajax=true (no browser needed).
const { get, ScrapeError } = require('./http');
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
  const res = await get(searchUrl(query, page), { headers: { Accept: 'application/json' } });
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

module.exports = { name: 'daraz', label: 'Daraz', search, parse, searchUrl };

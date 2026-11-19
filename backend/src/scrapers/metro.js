// Metro Online (Pakistan) adapter. metro.pk runs on Adobe Commerce / Magento (its own storefront
// confirms this in its footer), whose default "Luma" theme renders search results as plain
// server-rendered HTML - the same shape as PriceOye, so this adapter follows that pattern.
//
// Best effort: this has not been checked against a live page from this environment (the sandbox this
// was written in cannot reach metro.pk), so the selectors below are the standard Magento Luma markup,
// not a verified fixture. If metro.pk uses a customized theme, `parse()` will throw a PARSE ScrapeError
// (same as a layout change on any other adapter) rather than silently return nothing - run
// `node scripts/live-check.js "<query>"` after deploying and adjust the selectors here if it fails.
const cheerio = require('cheerio');
const http = require('./http');

const { ScrapeError } = http;
const { parsePrice, parseNumber, parseRating, absoluteUrl } = require('./parse');

const BASE = 'https://www.metro.pk';

function searchUrl(query, page = 1) {
  return `${BASE}/catalogsearch/result/?q=${encodeURIComponent(query)}${page > 1 ? `&p=${page}` : ''}`;
}

// A Magento "towishlist"/"tocompare" action link carries the product id as JSON in data-post:
// {"action":"...","data":{"product":123,...}}.
function productIdFrom(item) {
  const dataPost = item.find('a.towishlist, a.tocompare').first().attr('data-post');
  if (dataPost) {
    try {
      const id = JSON.parse(dataPost).data?.product;
      if (id) return String(id);
    } catch {
      /* fall through to the next source */
    }
  }
  const formInput = item.find('input[name="product"]').first().attr('value');
  if (formInput) return String(formInput);
  return null;
}

function parse(html) {
  const $ = cheerio.load(html);
  if (!$('.products.list.items.product-items, .product-items').length) {
    throw new ScrapeError('Unexpected Metro Online page (layout change?)', { code: 'PARSE' });
  }
  const listings = [];
  $('.product-items > .product-item, .product-items > li.item').each((_i, el) => {
    const item = $(el);
    const link = item.find('.product-item-link, a.product-item-photo').first();
    const title = (item.find('.product-item-link').first().text() || link.attr('title') || '').trim();
    const price = parsePrice(item.find('.special-price .price, .price-final_price .price, .price-box .price').last().text());
    const externalId = productIdFrom(item);
    if (!title || !price || !externalId) return;
    const original = parsePrice(item.find('.old-price .price').first().text());
    const ratingPct = parseNumber(item.find('.rating-summary .rating-result').first().attr('title'));
    listings.push({
      platform: 'metro',
      role: 'retail',
      externalId,
      title,
      url: absoluteUrl(item.find('.product-item-link').first().attr('href'), BASE),
      image: item.find('.product-image-photo').first().attr('src') || null,
      price,
      originalPrice: original && original > price ? original : null,
      currency: 'PKR',
      rating: ratingPct ? Math.round((ratingPct / 100) * 5 * 10) / 10 : null,
      reviewCount: parseNumber(item.find('.reviews-actions .count, .rating-summary .reviews-actions').first().text()) || 0,
      inStock: item.find('.stock.unavailable').length === 0,
      brand: null,
      category: null,
    });
  });
  return listings;
}

async function search(query, { page = 1 } = {}) {
  const res = await http.get(searchUrl(query, page), { headers: { Accept: 'text/html' } });
  const html = String(res.data);
  const out = parse(html);
  out.meta = { total: out.length, pageSize: out.length || 24, approximate: true };
  return out;
}

// A real product page is a plain slug ("/some-product.html"); the search page itself is not one.
function isProductUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('metro.pk') && u.pathname.endsWith('.html');
  } catch {
    return false;
  }
}

const canRefetch = () => false; // on-demand supplier-style check only, like AliExpress/eBay; not re-fetched by the price job
const fetchListing = async () => {
  throw new ScrapeError('Metro Online listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'metro', label: 'Metro Online', search, parse, searchUrl, fetchListing, canRefetch, isProductUrl };

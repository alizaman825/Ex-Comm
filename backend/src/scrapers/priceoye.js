// PriceOye adapter: search results are server-rendered HTML (.productBox cards), parsed with cheerio.
const cheerio = require('cheerio');
const http = require('./http');

const { ScrapeError } = http;
const { parsePrice, parseNumber, parseRating, absoluteUrl } = require('./parse');

const BASE = 'https://priceoye.pk';

function searchUrl(query, page = 1) {
  return `${BASE}/search?q=${encodeURIComponent(query)}${page > 1 ? `&page=${page}` : ''}`;
}

function parse(html) {
  const $ = cheerio.load(html);
  if (!$('#product_list_scroll_identifier, .product-list').length && !$('.productBox').length) {
    throw new ScrapeError('Unexpected PriceOye page (layout change?)', { code: 'PARSE' });
  }
  const listings = [];
  $('.productBox').each((_i, el) => {
    const box = $(el);
    const link = box.find('a.product-card').first();
    const title = (link.attr('data-product-name') || box.find('.p-title').first().text()).trim();
    const price = parsePrice(box.find('.price-box').first().text());
    const externalId = link.attr('data-product-id') || box.attr('data-slug');
    if (!title || !price || !externalId) return;
    const originalPrice = parsePrice(box.find('.price-diff-retail').first().text());
    const ratingSpans = box.find('.user-rating-content span');
    listings.push({
      platform: 'priceoye',
      externalId: String(externalId),
      title,
      url: absoluteUrl(link.attr('href'), BASE),
      image: box.find('amp-img.product-thumbnail, img.product-thumbnail').first().attr('src') || null,
      price,
      originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
      currency: 'PKR',
      rating: parseRating(ratingSpans.eq(0).text()),
      reviewCount: parseNumber(ratingSpans.eq(1).text()) || 0,
      inStock: box.find('[src*="out-of-stock"]').length === 0,
      brand: box.attr('data-brand') || null,
      category: box.attr('data-section') || null,
    });
  });
  return listings;
}

async function search(query, { page = 1 } = {}) {
  const res = await http.get(searchUrl(query, page), { headers: { Accept: 'text/html' } });
  return parse(String(res.data));
}

// A real product page looks like /<category>/<brand>/<slug>; sample listings link to /search?q=...
function isProductUrl(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return u.hostname.endsWith('priceoye.pk') && parts.length >= 3 && parts[0] !== 'search';
  } catch {
    return false;
  }
}

const canRefetch = (listing) => isProductUrl(listing.url);

// Reads the Product JSON-LD (price, availability, rating) from a product page.
function parseProduct(html, url) {
  const $ = cheerio.load(html);
  let product;
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      const data = JSON.parse($(el).html());
      if (data && data['@type'] === 'Product') product = data;
    } catch {
      /* ignore malformed blocks */
    }
  });
  const price = product && parsePrice(product.offers && product.offers.price);
  if (!product || !price) throw new ScrapeError('Unexpected PriceOye product page (layout change?)', { code: 'PARSE' });
  const retail = parsePrice($('[class*="retail"]').first().text());
  const rating = product.aggregateRating || {};
  return {
    platform: 'priceoye',
    externalId: String(product.productID || product.sku),
    title: String(product.name),
    url: absoluteUrl(product.url, BASE) || url,
    image: product.image || null,
    price,
    originalPrice: retail && retail > price ? retail : null,
    currency: 'PKR',
    rating: parseRating(rating.ratingValue),
    reviewCount: parseNumber(rating.ratingCount) || 0,
    inStock: !/OutOfStock|SoldOut|Discontinued/i.test(String((product.offers && product.offers.availability) || '')),
    brand: product.brand || null,
    category: product.category || null,
  };
}

// Re-fetch one stored listing from its product page. Resolves to null if the page no longer exists.
async function fetchListing(listing) {
  if (!isProductUrl(listing.url)) throw new ScrapeError('Listing is not linked to a PriceOye product page', { code: 'UNLINKED' });
  try {
    const res = await http.get(listing.url, { headers: { Accept: 'text/html' } });
    return parseProduct(String(res.data), listing.url);
  } catch (err) {
    if (err.code === 'HTTP' && err.status === 404) return null;
    throw err;
  }
}

module.exports = { name: 'priceoye', label: 'PriceOye', search, parse, searchUrl, fetchListing, canRefetch, parseProduct, isProductUrl };

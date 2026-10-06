// PriceOye adapter: search results are server-rendered HTML (.productBox cards), parsed with cheerio.
const cheerio = require('cheerio');
const { get, ScrapeError } = require('./http');
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
  const res = await get(searchUrl(query, page), { headers: { Accept: 'text/html' } });
  return parse(String(res.data));
}

module.exports = { name: 'priceoye', label: 'PriceOye', search, parse, searchUrl };

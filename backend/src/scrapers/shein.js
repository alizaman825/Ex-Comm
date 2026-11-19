// SHEIN adapter (supplier source, like AliExpress: international catalog, checked on demand, not part
// of the ordinary live search). The Pakistan storefront (pk.shein.com) embeds its search result list as
// JSON inside a <script> tag rather than rendering plain HTML.
//
// Best effort: SHEIN runs an anti-bot "risk" layer that can challenge or block plain HTTP requests at
// any time (worse than AliExpress), and the exact key under which it embeds the product list has moved
// between redesigns. `extractFirstJsonArray` tries several known marker keys in turn; if none match,
// this throws a BLOCKED ScrapeError the same way a captcha page would, which the existing circuit
// breaker already handles. This has not been checked against a live page from this environment (the
// sandbox this was written in cannot reach shein.com) - run `node scripts/live-check.js "<query>"`
// after deploying and add the real marker key here if it differs.
const axios = require('axios');
const { ScrapeError, USER_AGENT } = require('./http');
const { parsePrice, parseNumber, extractFirstJsonArray } = require('./parse');

const BASE = 'https://pk.shein.com';
const TIMEOUT_MS = 20000;
const MARKERS = ['"products":', '"goodsList":', '"goods_list":'];

const asUrl = (u) => (u ? (String(u).startsWith('//') ? `https:${u}` : String(u)) : null);

function parse(html) {
  const items = extractFirstJsonArray(String(html || ''), MARKERS);
  if (!items) throw new ScrapeError('SHEIN did not return a result list (blocked or layout change)', { code: 'BLOCKED' });

  const out = [];
  for (const it of items) {
    const id = it.goods_id ?? it.goodsId ?? it.productId ?? it.id;
    const title = it.goods_name ?? it.goodsName ?? it.productName ?? it.title;
    const rawPrice = it.salePrice?.amount ?? it.salePrice ?? it.price?.amount ?? it.price;
    const price = parsePrice(rawPrice);
    if (!id || !title || !price) continue;
    const rawOriginal = it.retailPrice?.amount ?? it.retailPrice ?? it.originalPrice?.amount ?? it.originalPrice;
    const original = parsePrice(rawOriginal);
    const slug = it.goods_url_name ?? it.goodsUrlName;
    out.push({
      platform: 'shein',
      role: 'supplier',
      externalId: String(id),
      title: String(title).trim(),
      url: slug ? `${BASE}/${slug}-p-${id}.html` : asUrl(it.goods_url ?? it.url) || `${BASE}/pdsearch/${encodeURIComponent(String(title))}/`,
      image: asUrl(it.goods_img ?? it.goodsImg ?? it.image),
      price,
      originalPrice: original && original > price ? original : null,
      currency: 'PKR',
      rating: parseNumber(it.comment_rank_average ?? it.commentRankAverage ?? it.rating) || null,
      reviewCount: parseNumber(it.comment_num ?? it.commentNum ?? it.reviewCount) || 0,
      inStock: it.is_sold_out ? Number(it.is_sold_out) !== 1 : true,
    });
  }
  return out;
}

async function search(query) {
  let res;
  try {
    res = await axios.get(`${BASE}/pdsearch/${encodeURIComponent(query)}/`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) throw new ScrapeError(`Timed out after ${TIMEOUT_MS} ms`, { code: 'TIMEOUT' });
    throw new ScrapeError(err.message);
  }
  if (res.status === 403 || res.status === 429) throw new ScrapeError(`Blocked by SHEIN (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
  if (res.status >= 400) throw new ScrapeError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
  const out = parse(res.data);
  out.meta = { total: out.length, pageSize: out.length };
  return out;
}

// Supplier listings are not re-fetched by the price job (same as AliExpress/eBay).
const canRefetch = () => false;
const fetchListing = async () => {
  throw new ScrapeError('SHEIN listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'shein', label: 'SHEIN', search, parse, canRefetch, fetchListing };

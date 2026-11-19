// SHEIN adapter (supplier source, like AliExpress/Temu: international catalog, checked on demand, not
// part of the ordinary live search). SHEIN has no Pakistan-specific storefront (checked: there is no
// pk.shein.com or shein.com.pk - confirmed by web search, since this environment cannot reach shein.com
// itself to check directly), so this uses the global www.shein.com site and converts its USD prices to
// PKR the same way eBay's and Temu's are (services/sheinCheck.js). It embeds its search result list as
// JSON inside a <script> tag rather than rendering plain HTML.
//
// Verified from a real (GitHub Actions) runner on 2026-11-19: the request itself reaches shein.com, but
// SHEIN's anti-bot "risk" layer rejects it before any product JSON is returned, so none of the MARKERS
// below have been confirmed against a real response yet - they're carried over from public scraping
// write-ups, not observed. `extractFirstJsonArray` tries each in turn; if none match, this throws a
// BLOCKED ScrapeError the same way a captcha page would, which the existing circuit breaker already
// handles. Re-run `.github/workflows/verify-ondemand-scrapers.yml` (or the "Check on SHEIN" button)
// after changing anything here - a 403/challenge response means the request itself needs work (headers,
// a real browser session), not just the marker keys.
const axios = require('axios');
const { ScrapeError, USER_AGENT } = require('./http');
const { parsePrice, parseNumber, extractFirstJsonArray } = require('./parse');

const BASE = 'https://www.shein.com';
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
    const priceUsd = parsePrice(rawPrice);
    if (!id || !title || !priceUsd) continue;
    const slug = it.goods_url_name ?? it.goodsUrlName;
    out.push({
      platform: 'shein',
      role: 'supplier',
      externalId: String(id),
      title: String(title).trim(),
      url: slug ? `${BASE}/${slug}-p-${id}.html` : asUrl(it.goods_url ?? it.url) || `${BASE}/pdsearch/${encodeURIComponent(String(title))}/`,
      image: asUrl(it.goods_img ?? it.goodsImg ?? it.image),
      priceUsd,
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

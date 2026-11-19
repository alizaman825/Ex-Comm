// Temu adapter (supplier source, like AliExpress: international catalog, checked on demand, not part
// of the ordinary live search). Temu's search page embeds its result list as JSON inside a <script>
// tag (variable names reported as window.rawData / __INITIAL_DATA__ depending on build) rather than
// rendering plain HTML, and it has no Pakistan-specific storefront, so prices come back in USD and are
// converted to PKR by the caller (services/temuCheck.js), the same way eBay's are.
//
// Best effort: this has not been checked against a live page from this environment (the sandbox this
// was written in cannot reach temu.com). `extractFirstJsonArray` tries the marker keys reported for
// Temu's listing payload in turn; if none match, this throws a BLOCKED ScrapeError (same as a bot
// challenge page), which the existing circuit breaker already handles. Run
// `node scripts/live-check.js "<query>"` after deploying and add the real marker key here if it differs.
const axios = require('axios');
const { ScrapeError, USER_AGENT } = require('./http');
const { parseNumber, extractFirstJsonArray } = require('./parse');

const BASE = 'https://www.temu.com';
const TIMEOUT_MS = 20000;
const MARKERS = ['"goods_list":', '"goodsList":', '"items":'];

const asUrl = (u) => (u ? (String(u).startsWith('//') ? `https:${u}` : String(u)) : null);

function parse(html) {
  const items = extractFirstJsonArray(String(html || ''), MARKERS);
  if (!items) throw new ScrapeError('Temu did not return a result list (blocked or layout change)', { code: 'BLOCKED' });

  const out = [];
  for (const it of items) {
    const id = it.goods_id ?? it.goodsId ?? it.id;
    const title = it.title ?? it.goods_name ?? it.goodsName;
    const rawPrice = it.price?.price ?? it.price_info?.price ?? it.priceInfo?.price ?? it.price;
    const price = Number(rawPrice) / 100; // Temu's listing payload sends price in cents
    if (!id || !title || !(price > 0)) continue;
    out.push({
      platform: 'temu',
      role: 'supplier',
      externalId: String(id),
      title: String(title).trim(),
      url: `${BASE}/${String(id)}.html`,
      image: asUrl(it.thumb_url ?? it.thumbUrl ?? it.image),
      priceUsd: Math.round(price * 100) / 100,
      rating: parseNumber(it.goods_score ?? it.goodsScore ?? it.rating) || null,
      reviewCount: parseNumber(it.sales_tip ?? it.reviewCount) || 0,
      inStock: true,
    });
  }
  return out;
}

async function search(query) {
  let res;
  try {
    res = await axios.get(`${BASE}/search_result.html`, {
      params: { search_key: query },
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' },
      timeout: TIMEOUT_MS,
      maxRedirects: 3,
      validateStatus: () => true,
    });
  } catch (err) {
    if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) throw new ScrapeError(`Timed out after ${TIMEOUT_MS} ms`, { code: 'TIMEOUT' });
    throw new ScrapeError(err.message);
  }
  if (res.status === 403 || res.status === 429) throw new ScrapeError(`Blocked by Temu (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
  if (res.status >= 400) throw new ScrapeError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
  const out = parse(res.data);
  out.meta = { total: out.length, pageSize: out.length };
  return out;
}

// Supplier listings are not re-fetched by the price job (same as AliExpress/eBay).
const canRefetch = () => false;
const fetchListing = async () => {
  throw new ScrapeError('Temu listings are not re-fetched', { code: 'UNLINKED' });
};

module.exports = { name: 'temu', label: 'Temu', search, parse, canRefetch, fetchListing };

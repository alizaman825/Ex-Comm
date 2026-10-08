// One-off: prints the RAW eBay Browse API item fields (not normalized by scrapers/ebay.js), so we can see
// exactly what eBay returns for seller/location before writing the seller-capturing code for eBay in
// docs/MULTI_SELLER_PLAN.md's Phase 0 (same discipline as Daraz: capture real fields, never guess field
// names like the now-removed Amazon integration had to).
//
// Requires EBAY_CLIENT_ID / EBAY_CLIENT_SECRET in backend/.env (production keys - this hits the real API).
// Usage: node scripts/ebay-field-check.js "iphone 15"
const axios = require('axios');
const { config } = require('../src/config/env');

async function getToken() {
  const basic = Buffer.from(`${config.ebay.clientId}:${config.ebay.clientSecret}`).toString('base64');
  const res = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
    { headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data.access_token;
}

(async () => {
  const q = process.argv[2] || 'iphone 15';
  if (!config.ebay.clientId || !config.ebay.clientSecret) {
    console.error('Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in backend/.env first.');
    process.exit(1);
  }
  const token = await getToken();
  const res = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
    params: { q, limit: 3 },
    headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': config.ebay.marketplaceId },
  });
  const items = res.data.itemSummaries || [];
  console.log(`${items.length} items for "${q}"\n`);
  console.log('--- first item, EVERY field eBay returned (paste this back) ---');
  console.log(JSON.stringify(items[0], null, 2));
  console.log('\n--- the fields this plan specifically needs, across all returned items ---');
  for (const it of items) {
    console.log(JSON.stringify({ itemId: it.itemId, title: (it.title || '').slice(0, 40), seller: it.seller, itemLocation: it.itemLocation }));
  }
  process.exit(0);
})().catch((err) => {
  console.error(err.response ? JSON.stringify(err.response.data, null, 2) : err.message);
  process.exit(1);
});

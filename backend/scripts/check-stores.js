// Checks, from THIS machine, whether Ex-Comm can reach and read each live store.
// Usage: npm run check:stores   (optionally: npm run check:stores -- "samsung a55")
// It prints the reason for any failure (DNS, timeout, blocked, unexpected page) and what to try.
const dns = require('dns').promises;
const { config } = require('../src/config/env');
const adapters = { daraz: require('../src/scrapers/daraz'), priceoye: require('../src/scrapers/priceoye') };
const HOSTS = { daraz: 'www.daraz.pk', priceoye: 'priceoye.pk' };

const query = process.argv.slice(2).join(' ') || 'iphone 15';
const HINTS = {
  DNS: 'The domain name could not be resolved. Check your internet connection, DNS settings, VPN or firewall.',
  TIMEOUT: `No answer within ${config.scraper.timeoutMs / 1000} s. The connection is slow or the site is filtering it. Try again, or raise SCRAPER_TIMEOUT_MS in backend/.env.`,
  BLOCKED: 'The store refused the request (HTTP 403/429 or a captcha page). Wait a while, avoid repeated searches, or try another network.',
  PARSE: 'The store answered but its page layout was not recognised (the site may have changed).',
  HTTP: 'The store answered with an error status.',
};

async function check(platform) {
  const out = { platform, host: HOSTS[platform] };
  const t0 = Date.now();
  try {
    const addr = await dns.lookup(out.host);
    out.dnsMs = Date.now() - t0;
    out.ip = addr.address;
  } catch (err) {
    return { ...out, ok: false, kind: 'DNS', detail: `${err.code || err.message}` };
  }
  const t1 = Date.now();
  try {
    const items = await adapters[platform].search(query);
    return { ...out, ok: true, ms: Date.now() - t1, items: items.length, sample: items.slice(0, 2).map((l) => `${l.title.slice(0, 50)} (Rs ${l.price})`) };
  } catch (err) {
    return { ...out, ok: false, kind: err.code && HINTS[err.code] ? err.code : 'OTHER', ms: Date.now() - t1, detail: err.message };
  }
}

(async () => {
  console.log(`Ex-Comm store check (query: "${query}")`);
  console.log(`DEMO_MODE=${config.demoMode} (must be false for live results)  LIVE_PLATFORMS=${config.scraper.livePlatforms.join(',')}  timeout=${config.scraper.timeoutMs} ms\n`);
  if (config.demoMode) console.log('!! DEMO_MODE is on: the app will never contact the stores. Set DEMO_MODE=false in backend/.env.\n');
  let failures = 0;
  for (const platform of config.scraper.livePlatforms.filter((p) => adapters[p])) {
    // eslint-disable-next-line no-await-in-loop
    const r = await check(platform);
    if (r.ok) {
      console.log(`OK    ${platform.padEnd(9)} ${String(r.ms).padStart(5)} ms  ${r.items} items  (${r.host} -> ${r.ip}, dns ${r.dnsMs} ms)`);
      r.sample.forEach((s) => console.log(`        e.g. ${s}`));
    } else {
      failures += 1;
      console.log(`FAIL  ${platform.padEnd(9)} ${r.kind}: ${r.detail}`);
      console.log(`        -> ${HINTS[r.kind] || 'Unexpected error: see the message above.'}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, 1500)); // be polite between stores
  }
  console.log(failures ? `\n${failures} store(s) failed. If it keeps failing, send this output.` : '\nAll stores reachable: live search should work.');
  process.exit(failures ? 1 : 0);
})();

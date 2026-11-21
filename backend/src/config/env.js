require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: Number(process.env.PORT) || 5000,
  // Proxy hops in front of the API (1 locally/behind one proxy; 2 on Render behind the Vercel frontend) so rate limits see the real client IP.
  trustProxy: Number(process.env.TRUST_PROXY) || 1,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  // Secure cookies need HTTPS. Defaults to on in production; set COOKIE_SECURE=false to run a production build over http://localhost.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : env === 'production',
  autoSeed: (process.env.AUTO_SEED || 'true') === 'true',
  demoMode: process.env.DEMO_MODE === 'true',
  jobs: {
    enabled: (process.env.JOBS_ENABLED || 'true') === 'true',
    priceCheckCron: process.env.PRICE_CHECK_CRON || '0 */6 * * *',
    key: process.env.JOB_KEY || '',
    maxListingsPerRun: Number(process.env.PRICE_CHECK_MAX_LISTINGS) || 60,
    // Phase 1 "stop fake data": simulate mode (fabricated price moves, no real scrape) must never run
    // against production data silently. Allowed by default outside production (local dev/demo); in
    // production it needs this explicit opt-in on top of still being production, so turning it on there
    // is a deliberate, visible choice, not an accident of a stray `{"mode":"simulate"}` call.
    allowSimulate: process.env.ALLOW_SIMULATE === 'true' || env !== 'production',
  },
  // Price points written before this date predate the source field below and have no way to prove they
  // came from a real scrape. Set by the owner (2026-11-20, PLAN.md) from the actual data: the first real
  // scrape ran 2026-10-07T12:25 UTC; everything before 2026-10-07T12:20 UTC is confirmed seed-generated
  // (round, once-a-day timestamps), so that's the cutoff - not the day this field was added. Used by
  // backfill-pricehistory-source.js to label pre-migration points 'unverified' (before) vs 'real' (at/after).
  // See AUDIT.md section 3.
  priceHistory: {
    verifiedCutoff: new Date(process.env.PRICE_HISTORY_VERIFIED_CUTOFF || '2026-10-07T12:20:00.000Z'),
  },
  // Price-status windows, per store (owner decision, 2026-11-20): Daraz/PriceOye/eBay default to 72h
  // "checked recently" and 14 days (336h) "stale", overridable per store with
  // PRICE_STATUS_RECENT_HOURS_<PLATFORM> / PRICE_STATUS_STALE_HOURS_<PLATFORM>. Any platform without its
  // own override falls back to `default`. AliExpress has no window here - services/priceStatus.js always
  // labels it a saved reference instead, regardless of these numbers.
  priceStatus: {
    default: {
      recentHours: Number(process.env.PRICE_STATUS_RECENT_HOURS) || 72,
      staleHours: Number(process.env.PRICE_STATUS_STALE_HOURS) || 336,
    },
    windows: {
      daraz: {
        recentHours: Number(process.env.PRICE_STATUS_RECENT_HOURS_DARAZ) || 72,
        staleHours: Number(process.env.PRICE_STATUS_STALE_HOURS_DARAZ) || 336,
      },
      priceoye: {
        recentHours: Number(process.env.PRICE_STATUS_RECENT_HOURS_PRICEOYE) || 72,
        staleHours: Number(process.env.PRICE_STATUS_STALE_HOURS_PRICEOYE) || 336,
      },
      ebay: {
        recentHours: Number(process.env.PRICE_STATUS_RECENT_HOURS_EBAY) || 72,
        staleHours: Number(process.env.PRICE_STATUS_STALE_HOURS_EBAY) || 336,
      },
      // Telex (Phase 2A): a slow periodic background sync, not a per-search live scrape - its own window
      // so a listing synced a few hours ago still reads "checked recently" rather than borrowing Daraz's.
      telex: {
        recentHours: Number(process.env.PRICE_STATUS_RECENT_HOURS_TELEX) || 72,
        staleHours: Number(process.env.PRICE_STATUS_STALE_HOURS_TELEX) || 336,
      },
    },
  },
  // A listing older than this never shows in public results, cheapest or deals/alerts, even as "unknown"
  // (owner decision, 2026-11-20) - it stays in the database and comes back once it's refreshed.
  listingMaxAgeDays: Number(process.env.LISTING_MAX_AGE_DAYS) || 30,
  catalogSync: {
    // Slow background sync of the sample catalog's store listings (see jobs/catalogSync.js).
    cron: process.env.CATALOG_SYNC_CRON || '*/30 * * * *',
    batch: Number(process.env.CATALOG_SYNC_BATCH) || 8, // tasks per run: gentle enough for Daraz
    pauseMs: Number(process.env.CATALOG_SYNC_PAUSE_MS ?? 5000),
    platforms: (process.env.CATALOG_SYNC_PLATFORMS || 'daraz,priceoye').split(',').map((x) => x.trim()).filter(Boolean),
    refreshHours: Number(process.env.CATALOG_SYNC_REFRESH_HOURS) || 24,
    retryHours: Number(process.env.CATALOG_SYNC_RETRY_HOURS) || 168,
    // Owner decision (2026-11-20): refresh the most popular products (homepage/top search results) before
    // the rest of the catalog. This many of the top-popularity products count as "priority".
    priorityLimit: Number(process.env.CATALOG_SYNC_PRIORITY_LIMIT) || 60,
  },
  // Telex.pk (Telemart) background catalog sync (Phase 2A, docs/SOURCES-REPORT.md): discovers products
  // via /sitemap.xml and reads each product page read-only, honest User-Agent, polite delay, exponential
  // backoff on 429/5xx, immediate stop if blocked. Off by default - SYNC_TELEX_ENABLED must be set to
  // "true" before the scheduler or the manual endpoint actually syncs anything (jobs/telexSync.js).
  telexSync: {
    enabled: process.env.SYNC_TELEX_ENABLED === 'true',
    cron: process.env.TELEX_SYNC_CRON || '0 */6 * * *',
    maxPagesPerRun: Number(process.env.TELEX_MAX_PAGES_PER_RUN) || 10,
    minDelayMs: Number(process.env.TELEX_MIN_DELAY_MS ?? 3000),
    maxDelayMs: Number(process.env.TELEX_MAX_DELAY_MS ?? 5000),
    timeoutMs: Number(process.env.TELEX_TIMEOUT_MS) || 10000,
    maxRetries: Number(process.env.TELEX_MAX_RETRIES) || 3,
    // Owner-confirmed contact (2026-11-20): URL only, no personal email, per agents.md's identification
    // guidance. Points at the real Contact page (Part D) rather than the bare domain.
    userAgent: process.env.TELEX_USER_AGENT || 'Ex-CommBot/1.0 (+https://ex-comm.vercel.app/contact)',
  },
  // How recently a product needs to have been checked to lead a home-page rail (trending/drops). A product
  // whose freshest offer is older than this is left off rather than risk showing stock/price that an idle
  // sync never caught up to - see jobs/catalogSync.js and the daily GitHub Actions trigger in docs/DEPLOY.md.
  home: {
    freshnessHours: Number(process.env.HOME_FRESHNESS_HOURS) || 48,
  },
  // "Biggest price drops" quality rules (C1): a cheap accessory with a big percentage swing was crowding
  // out real deals on real products. Configurable via env rather than magic numbers buried in the query,
  // per the owner's ask - a cheap phone case moving from Rs 200 to Rs 150 is a 25% "drop" that means
  // nothing next to a flagship phone's real Rs 10,000 cut.
  deals: {
    minPrice: Number(process.env.DEALS_MIN_PRICE) || 2000,
    excludedKeywords: (process.env.DEALS_EXCLUDED_KEYWORDS || 'case,cover,screen protector,tempered glass,cable,charger,adapter,strap,pouch,sleeve,skin')
      .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
    // Launch categories only (PLAN.md decisions) - a category slug not in this list never leads the
    // "Biggest price drops" rail even if it technically qualifies on price/history. Matches the real
    // category slugs in services/categories.js (mobiles/laptops/audio/watches/home-appliances); "gpus"
    // is included for when that category exists, and is simply never matched until then.
    categories: (process.env.DEALS_CATEGORIES || 'mobiles,laptops,audio,watches,gpus,home-appliances')
      .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean),
  },
  // Contact form (Phase 2 Part D): recipient address and the pepper used to hash a submitter's IP
  // (never stored raw). CONTACT_RECIPIENT_EMAIL is the owner's own inbox, set only in the deploy
  // environment (Render) - never hardcoded or committed.
  contact: {
    recipientEmail: process.env.CONTACT_RECIPIENT_EMAIL || '',
    ipHashSalt: process.env.CONTACT_IP_HASH_SALT || '',
  },
  // Outbound notification email, HTTP API based (not SMTP - Render's free tier is known to block
  // outbound SMTP ports). One provider (Resend) plus the no-op fallback in services/email.js when
  // either var below is unset.
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFrom: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'Ex-Comm <alerts@excomm.local>',
  },
  search: {
    cacheTtlMs: Number(process.env.SEARCH_CACHE_TTL_MS) || 15 * 60 * 1000, // how long an earlier live search is reused
    emptyCacheTtlMs: Number(process.env.SEARCH_EMPTY_CACHE_TTL_MS) || 10 * 60 * 1000, // a search that found nothing
    liveBudgetMs: Number(process.env.SEARCH_LIVE_BUDGET_MS) || 25000, // slow connections need time for up to 4 polite requests per store
    maxIngestPerPlatform: 40, // one full store page: nothing relevant on it is dropped
    rateLimitMax: Number(process.env.SEARCH_RATE_LIMIT_MAX) || 60,
  },
  scraper: {
    livePlatforms: (process.env.LIVE_PLATFORMS || 'daraz,priceoye').split(',').map((s) => s.trim()).filter(Boolean),
    timeoutMs: Number(process.env.SCRAPER_TIMEOUT_MS) || 8000,
    minDelayMs: Number(process.env.SCRAPER_MIN_DELAY_MS ?? 1500),
    maxDelayMs: Number(process.env.SCRAPER_MAX_DELAY_MS ?? 3000),
    circuitCooldownMs: Number(process.env.SCRAPER_COOLDOWN_MS) || 10 * 60 * 1000,
  },
  // eBay Browse API (OAuth2 client credentials; not scraping). Free keys: developer.ebay.com. On-demand
  // only (like AliExpress), so a missing key just disables the "Check on eBay" button, nothing else.
  ebay: {
    clientId: process.env.EBAY_CLIENT_ID || '',
    clientSecret: process.env.EBAY_CLIENT_SECRET || '',
    marketplaceId: process.env.EBAY_MARKETPLACE_ID || 'EBAY_US',
  },
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    apiMax: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    // Keyed per IP+email (see middleware/rateLimit.js), so this only throttles repeated attempts
    // on the same account, not every login behind a shared IP (campus Wi-Fi, mobile carrier NAT).
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
    // "Report a wrong price or product" has no account, so this is keyed on IP alone - deliberately tight.
    reportMax: Number(process.env.REPORT_RATE_LIMIT_MAX) || 5,
    // Contact form (Part D): its own, tighter hourly window rather than sharing the 15-minute window
    // above - an honest visitor needs at most one or two contact messages ever, not every 15 minutes.
    contactMax: Number(process.env.CONTACT_RATE_LIMIT_MAX) || 3,
    contactWindowMs: Number(process.env.CONTACT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  },
};

function assertConfig() {
  const missing = [];
  if (!config.mongoUri) missing.push('MONGO_URI');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')} (see backend/.env.example)`);
  }
}

module.exports = { config, assertConfig };

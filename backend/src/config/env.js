require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProd: env === 'production',
  isTest: env === 'test',
  port: Number(process.env.PORT) || 5000,
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
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((s) => s.trim()),
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    apiMax: Number(process.env.API_RATE_LIMIT_MAX) || 300,
    authMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
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

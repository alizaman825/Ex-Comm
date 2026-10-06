// Runs before every test file: isolated config, never touches the real Atlas database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-not-used-anywhere-else';
process.env.MONGO_URI = 'mongodb://memory-server-set-at-runtime';
process.env.AUTH_RATE_LIMIT_MAX = '5';
process.env.SCRAPER_MIN_DELAY_MS = '0';
process.env.SCRAPER_MAX_DELAY_MS = '0';
process.env.SEARCH_RATE_LIMIT_MAX = '1000';
process.env.JOB_KEY = 'test-job-key';
process.env.JOBS_ENABLED = 'false';

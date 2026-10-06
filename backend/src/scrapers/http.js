const axios = require('axios');
const { config } = require('../config/env');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

class ScrapeError extends Error {
  constructor(message, { code = 'SCRAPE_FAILED', status } = {}) {
    super(message);
    this.code = code; // TIMEOUT | BLOCKED | HTTP | PARSE | CIRCUIT_OPEN | SCRAPE_FAILED
    this.status = status;
  }
}

const client = axios.create({
  timeout: config.scraper.timeoutMs,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
  },
  maxRedirects: 3,
  validateStatus: () => true,
});

function toScrapeError(err) {
  if (err instanceof ScrapeError) return err;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || /timeout/i.test(err.message)) {
    return new ScrapeError(`Timed out after ${config.scraper.timeoutMs} ms`, { code: 'TIMEOUT' });
  }
  return new ScrapeError(err.message);
}

// GET with one retry on transient network/5xx errors (never on timeouts, to respect the time budget).
async function get(url, { headers, responseType = 'text' } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await client.get(url, { headers, responseType });
      if (res.status === 403 || res.status === 429) {
        throw new ScrapeError(`Blocked by platform (HTTP ${res.status})`, { code: 'BLOCKED', status: res.status });
      }
      if (res.status >= 500 && attempt === 0) continue;
      if (res.status >= 400) throw new ScrapeError(`HTTP ${res.status}`, { code: 'HTTP', status: res.status });
      return res;
    } catch (err) {
      const e = toScrapeError(err);
      const transient = e.code === 'SCRAPE_FAILED' && attempt === 0;
      if (!transient) throw e;
    }
  }
  throw new ScrapeError('Request failed after retry');
}

module.exports = { get, ScrapeError, USER_AGENT };

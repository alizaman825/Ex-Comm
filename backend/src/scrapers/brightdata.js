// Bright Data integration. One API key talks to two different Bright Data products:
//  - Web Unlocker (unlockHtml): a proxy that fetches one URL and returns unblocked HTML. Used as a
//    transport for a site we already know how to parse (AliExpress), so a block only changes how the
//    page is fetched, not how it is read - the existing parser keeps working unchanged.
//  - Scraper API (collectDataset): pre-built site scrapers that take a search keyword and return
//    structured JSON directly (used for Amazon, where we do not parse HTML ourselves). Collection is
//    asynchronous: trigger a job, poll until it is ready, then read the result snapshot.
// Account setup: brightdata.com -> Settings -> API keys (collectDataset and unlockHtml both use it);
// a Web Unlocker zone (Proxies & Scraping -> Add zone) is needed only for unlockHtml.
const axios = require('axios');
const { config } = require('../config/env');
const { ScrapeError } = require('./http');

const BASE = 'https://api.brightdata.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function authHeaders() {
  if (!config.brightdata.apiKey) throw new ScrapeError('Bright Data is not configured (BRIGHTDATA_API_KEY)', { code: 'CONFIG' });
  return { Authorization: `Bearer ${config.brightdata.apiKey}`, 'Content-Type': 'application/json' };
}

function toScrapeError(err) {
  if (err instanceof ScrapeError) return err;
  if (err.code === 'ECONNABORTED' || /timeout/i.test(err.message)) return new ScrapeError(`Timed out after ${config.scraper.timeoutMs} ms`, { code: 'TIMEOUT' });
  return new ScrapeError(err.message);
}

function checkStatus(res, label) {
  if (res.status === 401 || res.status === 403) throw new ScrapeError(`Bright Data rejected the ${label} request (HTTP ${res.status})`, { code: 'AUTH', status: res.status });
  if (res.status >= 400) throw new ScrapeError(`Bright Data ${label} HTTP ${res.status}`, { code: 'HTTP', status: res.status });
}

// Fetches one URL through the Web Unlocker and returns the raw HTML (unblocked, proxy-rotated).
async function unlockHtml(url) {
  if (!config.brightdata.zone) throw new ScrapeError('Bright Data is not configured (BRIGHTDATA_ZONE)', { code: 'CONFIG' });
  let res;
  try {
    res = await axios.post(`${BASE}/request`, { zone: config.brightdata.zone, url, format: 'raw' }, { headers: authHeaders(), timeout: config.scraper.timeoutMs, validateStatus: () => true });
  } catch (err) {
    throw toScrapeError(err);
  }
  checkStatus(res, 'unlock');
  return String(res.data);
}

async function pollSnapshot(snapshotId, headers, pollTimeoutMs, pollIntervalMs) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const prog = await axios.get(`${BASE}/datasets/v3/progress/${snapshotId}`, { headers, timeout: config.scraper.timeoutMs, validateStatus: () => true });
    checkStatus(prog, 'progress');
    const status = prog.data && prog.data.status;
    if (status === 'ready') {
      // eslint-disable-next-line no-await-in-loop
      const snap = await axios.get(`${BASE}/datasets/v3/snapshot/${snapshotId}`, { headers, params: { format: 'json' }, timeout: config.scraper.timeoutMs, validateStatus: () => true });
      checkStatus(snap, 'snapshot');
      return snap.data;
    }
    if (status === 'failed') throw new ScrapeError('Bright Data collection failed', { code: 'HTTP' });
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollIntervalMs);
  }
  throw new ScrapeError(`Bright Data did not finish within ${Math.round(pollTimeoutMs / 1000)}s`, { code: 'BUDGET' });
}

// Triggers a Scraper API dataset job for one input row, polls until it is ready, and returns the
// resulting JSON array of records (empty array if Bright Data reports none).
async function collectDataset(datasetId, input, { pollTimeoutMs = config.brightdata.pollTimeoutMs, pollIntervalMs = 4000 } = {}) {
  const headers = authHeaders();
  let res;
  try {
    res = await axios.post(`${BASE}/datasets/v3/trigger`, [input], { params: { dataset_id: datasetId }, headers, timeout: config.scraper.timeoutMs, validateStatus: () => true });
  } catch (err) {
    throw toScrapeError(err);
  }
  checkStatus(res, 'trigger');
  const snapshotId = res.data && res.data.snapshot_id;
  if (!snapshotId) throw new ScrapeError('Bright Data did not return a snapshot id', { code: 'PARSE' });
  const records = await pollSnapshot(snapshotId, headers, pollTimeoutMs, pollIntervalMs);
  return Array.isArray(records) ? records : [];
}

module.exports = { unlockHtml, collectDataset };

// Per-platform request scheduling: one request at a time, a random polite delay between
// requests, and a circuit breaker that pauses a platform after repeated failures.
const { config } = require('../config/env');
const { ScrapeError } = require('./http');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class PoliteQueue {
  constructor(name, opts = {}) {
    this.name = name;
    this.minDelay = opts.minDelayMs ?? config.scraper.minDelayMs;
    this.maxDelay = opts.maxDelayMs ?? config.scraper.maxDelayMs;
    this.failureThreshold = opts.failureThreshold ?? 3;
    this.cooldownMs = opts.cooldownMs ?? config.scraper.circuitCooldownMs;
    this.tail = Promise.resolve();
    this.lastRequestAt = 0;
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastError = null; // { message, code, at } of the most recent failure
    this.lastSuccessAt = null;
  }

  get circuitOpen() {
    return Date.now() < this.openUntil;
  }

  status() {
    return {
      platform: this.name,
      circuit: this.circuitOpen ? 'open' : 'closed',
      consecutiveFailures: this.consecutiveFailures,
      retryAt: this.circuitOpen ? new Date(this.openUntil).toISOString() : null,
      lastError: this.lastError,
      lastSuccessAt: this.lastSuccessAt,
    };
  }

  // Lets requests through again right away (used when the user explicitly asks to refresh).
  closeCircuit() {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
  }

  // Runs fn() after earlier tasks finish and the polite delay has passed.
  run(fn) {
    const task = this.tail.then(async () => {
      if (this.circuitOpen) {
        const minutes = Math.max(1, Math.ceil((this.openUntil - Date.now()) / 60000));
        throw new ScrapeError(`${this.name} is paused for about ${minutes} more minute${minutes === 1 ? '' : 's'} after repeated failures`, { code: 'CIRCUIT_OPEN' });
      }
      const delay = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
      const wait = this.lastRequestAt + delay - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      try {
        const result = await fn();
        this.consecutiveFailures = 0;
        this.lastSuccessAt = new Date().toISOString();
        return result;
      } catch (err) {
        this.lastError = { message: err.message, code: err.code || 'ERROR', at: new Date().toISOString() };
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.failureThreshold) {
          this.openUntil = Date.now() + this.cooldownMs;
          this.consecutiveFailures = 0;
        }
        throw err;
      }
    });
    this.tail = task.catch(() => {});
    return task;
  }

  reset() {
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastRequestAt = 0;
  }
}

module.exports = { PoliteQueue };

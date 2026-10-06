const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

const handler = (_req, res) =>
  res.status(429).json({ error: { message: 'Too many requests, please try again later.' } });

// Factories so every app instance (and every test file) gets fresh counters.
const apiLimiter = () =>
  rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.apiMax, standardHeaders: 'draft-7', legacyHeaders: false, handler });

const authLimiter = () =>
  rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.authMax, standardHeaders: 'draft-7', legacyHeaders: false, handler });

// Search can trigger live scraping, so it gets a tighter limit than the rest of the API.
const searchLimiter = () =>
  rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.search.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false, handler });

module.exports = { apiLimiter, authLimiter, searchLimiter };

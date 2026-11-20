const rateLimit = require('express-rate-limit');
const { config } = require('../config/env');

const handler = (_req, res) =>
  res.status(429).json({ error: { message: 'Too many attempts. Please wait a few minutes and try again.' } });

// Factories so every app instance (and every test file) gets fresh counters.
const apiLimiter = () =>
  rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.rateLimit.apiMax, standardHeaders: 'draft-7', legacyHeaders: false, handler });

// Keyed on IP + the submitted email (not IP alone): students on the same campus/mobile-carrier
// NAT share one public IP, and a request proxied through the frontend's rewrite can also collapse
// many users onto one apparent IP. Without the email in the key, one busy account locks out
// everyone else behind the same IP.
const authLimiter = () =>
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    limit: config.rateLimit.authMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      return email ? `${req.ip}:${email}` : req.ip;
    },
  });

// Search can trigger live scraping, so it gets a tighter limit than the rest of the API.
const searchLimiter = () =>
  rateLimit({ windowMs: config.rateLimit.windowMs, limit: config.search.rateLimitMax, standardHeaders: 'draft-7', legacyHeaders: false, handler });

module.exports = { apiLimiter, authLimiter, searchLimiter };

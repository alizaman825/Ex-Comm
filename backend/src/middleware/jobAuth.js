const crypto = require('crypto');
const { config } = require('../config/env');
const AppError = require('../utils/AppError');

// Shared key auth (x-job-key header), not user accounts - used by scheduled/manual jobs and by the
// owner-only endpoints (e.g. reading submitted reports) that don't have an admin UI yet.
function requireJobKey(req, _res, next) {
  const expected = config.jobs.key;
  const given = String(req.headers['x-job-key'] || '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (!expected || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return next(new AppError(403, 'Invalid or missing job key'));
  }
  return next();
}

module.exports = { requireJobKey };

const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const { config } = require('../config/env');
const { JobRun } = require('../models');
const { runPriceCheck, isRunning } = require('../jobs/priceCheck');
const validate = require('../middleware/validate');
const AppError = require('../utils/AppError');
const ah = require('../utils/asyncHandler');

const bodySchema = z.object({ mode: z.enum(['live', 'simulate']).default('live') });

// Jobs are protected by a shared key (x-job-key header), not by user accounts.
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

module.exports = () => {
  const router = express.Router();
  router.use(requireJobKey);

  // POST /api/jobs/price-check  {mode: "live" | "simulate"}
  router.post(
    '/price-check',
    validate({ body: bodySchema }),
    ah(async (req, res) => {
      const result = await runPriceCheck({ mode: req.body.mode, trigger: 'manual' });
      res.status(result.reason ? 409 : 200).json(result);
    })
  );

  // GET /api/jobs/status: recent runs
  router.get(
    '/status',
    ah(async (_req, res) => {
      const runs = await JobRun.find({ name: 'price-check' }).sort({ startedAt: -1 }).limit(10).lean();
      res.json({ running: isRunning(), schedule: config.jobs.enabled ? config.jobs.priceCheckCron : null, runs });
    })
  );

  return router;
};

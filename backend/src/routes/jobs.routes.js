const express = require('express');
const { z } = require('zod');
const { config } = require('../config/env');
const { JobRun } = require('../models');
const { runPriceCheck, isRunning } = require('../jobs/priceCheck');
const { runCatalogSync, isRunning: syncRunning, catalogSyncProgress } = require('../jobs/catalogSync');
const { runTelexSync, isRunning: telexRunning } = require('../jobs/telexSync');
const validate = require('../middleware/validate');
const { requireJobKey } = require('../middleware/jobAuth');
const ah = require('../utils/asyncHandler');

const bodySchema = z.object({ mode: z.enum(['live', 'simulate']).default('live') });

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

  // POST /api/jobs/catalog-sync: one batch of the background catalog sync (same as a scheduled run)
  router.post(
    '/catalog-sync',
    ah(async (_req, res) => {
      const result = await runCatalogSync({ trigger: 'manual' });
      res.status(result.reason ? 409 : 200).json(result);
    })
  );

  // POST /api/jobs/telex-sync: one batch of the Telex.pk background sync (off unless SYNC_TELEX_ENABLED=true)
  router.post(
    '/telex-sync',
    ah(async (_req, res) => {
      const result = await runTelexSync({ trigger: 'manual' });
      res.status(result.reason ? 409 : 200).json(result);
    })
  );

  // GET /api/jobs/status: recent runs
  router.get(
    '/status',
    ah(async (_req, res) => {
      const runs = await JobRun.find({ name: 'price-check' }).sort({ startedAt: -1 }).limit(10).lean();
      const syncRuns = await JobRun.find({ name: 'catalog-sync' }).sort({ startedAt: -1 }).limit(10).lean();
      const telexRuns = await JobRun.find({ name: 'telex-sync' }).sort({ startedAt: -1 }).limit(10).lean();
      res.json({
        running: isRunning(),
        schedule: config.jobs.enabled ? config.jobs.priceCheckCron : null,
        runs,
        catalogSync: { running: syncRunning(), schedule: config.jobs.enabled ? config.catalogSync.cron : null, progress: await catalogSyncProgress(), runs: syncRuns },
        telexSync: { running: telexRunning(), enabled: config.telexSync.enabled, schedule: config.telexSync.enabled ? config.telexSync.cron : null, runs: telexRuns },
      });
    })
  );

  return router;
};

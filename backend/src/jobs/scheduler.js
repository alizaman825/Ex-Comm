const cron = require('node-cron');
const { config } = require('../config/env');
const { runPriceCheck } = require('./priceCheck');
const { runCatalogSync } = require('./catalogSync');

let task;
let syncTask;

// Starts the recurring price check (default every 6 hours). In DEMO_MODE nothing is scraped.
function startScheduler() {
  if (!config.jobs.enabled) return null;
  if (!cron.validate(config.jobs.priceCheckCron)) {
    console.error(`Invalid PRICE_CHECK_CRON "${config.jobs.priceCheckCron}", scheduler not started`);
    return null;
  }
  task = cron.schedule(config.jobs.priceCheckCron, () => {
    runPriceCheck({ mode: 'live', trigger: 'schedule' }).catch((err) => console.error('Scheduled price check error:', err));
  });
  console.log(`Price check scheduled: ${config.jobs.priceCheckCron}`);
  if (cron.validate(config.catalogSync.cron)) {
    syncTask = cron.schedule(config.catalogSync.cron, () => {
      runCatalogSync({ trigger: 'schedule' }).catch((err) => console.error('Scheduled catalog sync error:', err));
    });
    console.log(`Catalog sync scheduled: ${config.catalogSync.cron} (${config.catalogSync.batch} items per run)`);
  } else console.error(`Invalid CATALOG_SYNC_CRON "${config.catalogSync.cron}", catalog sync not started`);
  return task;
}

function stopScheduler() {
  if (task) task.stop();
  if (syncTask) syncTask.stop();
  task = undefined;
  syncTask = undefined;
}

module.exports = { startScheduler, stopScheduler };

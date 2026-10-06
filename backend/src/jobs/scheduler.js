const cron = require('node-cron');
const { config } = require('../config/env');
const { runPriceCheck } = require('./priceCheck');

let task;

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
  return task;
}

function stopScheduler() {
  if (task) task.stop();
  task = undefined;
}

module.exports = { startScheduler, stopScheduler };

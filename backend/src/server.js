const { config, assertConfig } = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { Product } = require('./models');
const { seedDatabase } = require('./seed/seed');
const { startScheduler, stopScheduler } = require('./jobs/scheduler');

async function start() {
  assertConfig();
  await connectDB(config.mongoUri);
  if (config.autoSeed && (await Product.estimatedDocumentCount()) === 0) {
    console.log('Database is empty: loading sample data (AUTO_SEED=true)');
    await seedDatabase({ reset: false });
  }
  const app = createApp();
  startScheduler();
  const server = app.listen(config.port, () => {
    console.log(`Ex-Comm API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    stopScheduler();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

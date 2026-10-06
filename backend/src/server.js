const { config, assertConfig } = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');

async function start() {
  assertConfig();
  await connectDB(config.mongoUri);
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Ex-Comm API listening on http://localhost:${config.port} (${config.env})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
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

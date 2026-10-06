const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const { config } = require('./config/env');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.get('/', (_req, res) => res.json({ name: 'Ex-Comm API', health: '/api/health' }));
  app.use('/api', apiLimiter(), require('./routes')());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

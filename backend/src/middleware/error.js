const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const { config } = require('../config/env');

function notFound(req, _res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details = err.details;

  if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || 'Validation failed';
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    if (config.isProd) message = 'Internal server error';
  }

  res.status(status).json({ error: { message, ...(details ? { details } : {}) } });
}

module.exports = { notFound, errorHandler, AppError };

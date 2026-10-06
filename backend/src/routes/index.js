const express = require('express');
const mongoose = require('mongoose');

module.exports = () => {
  const api = express.Router();

  api.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      time: new Date().toISOString(),
    });
  });

  const meta = require('../controllers/meta.controller');
  const ah = require('../utils/asyncHandler');
  api.get('/categories', ah(meta.listCategories));
  api.get('/platforms', meta.listPlatforms);

  api.use('/auth', require('./auth.routes')());
  api.use('/users', require('./user.routes')());
  api.use('/search', require('./search.routes')());

  return api;
};

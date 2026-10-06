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

  const { productsRouter, compareRouter } = require('./products.routes');
  const { wishlistRouter, alertsRouter, notificationsRouter } = require('./account.routes');
  api.use('/products', productsRouter());
  api.use('/compare', compareRouter());
  api.use('/wishlist', wishlistRouter());
  api.use('/alerts', alertsRouter());
  api.use('/notifications', notificationsRouter());
  api.use('/jobs', require('./jobs.routes')());

  return api;
};

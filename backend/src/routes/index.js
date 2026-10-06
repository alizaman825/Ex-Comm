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

  api.use('/auth', require('./auth.routes')());
  api.use('/users', require('./user.routes')());
  api.use('/search', require('./search.routes')());

  return api;
};

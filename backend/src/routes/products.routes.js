const express = require('express');
const ctrl = require('../controllers/products.controller');
const validate = require('../middleware/validate');
const { optionalAuth } = require('../middleware/auth');
const ah = require('../utils/asyncHandler');

// Mounted at /api/products
function productsRouter() {
  const router = express.Router();
  router.get('/trending', validate({ query: ctrl.listQuerySchema }), ah(ctrl.trending));
  router.get('/drops', validate({ query: ctrl.listQuerySchema }), ah(ctrl.drops));
  router.get('/:id', validate({ params: ctrl.idParams }), optionalAuth, ah(ctrl.getProduct));
  router.get('/:id/history', validate({ params: ctrl.idParams, query: ctrl.historyQuerySchema }), ah(ctrl.getHistory));
  router.get('/:id/similar', validate({ params: ctrl.idParams }), ah(ctrl.similar));
  return router;
}

// Mounted at /api/compare
function compareRouter() {
  const router = express.Router();
  router.get('/', validate({ query: ctrl.compareQuerySchema }), ah(ctrl.compare));
  return router;
}

module.exports = { productsRouter, compareRouter };

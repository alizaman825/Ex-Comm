const express = require('express');
const ctrl = require('../controllers/search.controller');
const validate = require('../middleware/validate');
const { searchLimiter } = require('../middleware/rateLimit');
const meta = require('../controllers/meta.controller');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  router.get('/trending', ah(meta.trending));
  router.get('/', searchLimiter(), validate({ query: ctrl.searchQuerySchema }), ah(ctrl.searchProducts));
  return router;
};

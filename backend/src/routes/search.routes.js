const express = require('express');
const ctrl = require('../controllers/search.controller');
const validate = require('../middleware/validate');
const { searchLimiter } = require('../middleware/rateLimit');
const ah = require('../utils/asyncHandler');

module.exports = () => {
  const router = express.Router();
  router.get('/', searchLimiter(), validate({ query: ctrl.searchQuerySchema }), ah(ctrl.searchProducts));
  return router;
};
